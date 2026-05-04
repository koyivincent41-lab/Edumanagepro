import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  CreditCard, 
  Loader2,
  Calendar,
  X,
  DollarSign,
  User,
  ChevronDown
} from 'lucide-react';
import { collection, onSnapshot, addDoc, doc, updateDoc, getDoc, runTransaction, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Invoice, Student, Payment, School } from '../../types';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useBranch } from '../../context/BranchContext';

const paymentSchema = z.object({
  studentId: z.string().min(1, 'Please select a student'),
  invoiceId: z.string().optional(),
  isArrearsPayment: z.boolean(),
  amount: z.number().min(1, 'Amount must be greater than 0'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'mobile_money', 'cheque']),
  reference: z.string().optional(),
  paymentDate: z.string().min(1, 'Payment date is required'),
  term: z.enum(['Term 1', 'Term 2', 'Term 3']),
});

type PaymentForm = z.infer<typeof paymentSchema>;

export default function Payments({ schoolId, school }: { schoolId: string; school: School | null }) {
  const { currentBranch } = useBranch();
  const [searchParams, setSearchParams] = useSearchParams();
  const studentIdFromQuery = searchParams.get('studentId');
  
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allUnpaidInvoices, setAllUnpaidInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'cash',
      term: school?.currentTerm || 'Term 1',
      isArrearsPayment: false,
    },
  });

  const selectedStudentId = watch('studentId');
  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const studentInvoices = allUnpaidInvoices.filter(inv => inv.studentId === selectedStudentId);

  useEffect(() => {
    if (!schoolId) return;
    
    let paymentsQuery = query(
      collection(db, 'schools', schoolId, 'payments'),
      where('academicYear', '==', school?.academicYear || ''),
      where('term', '==', school?.currentTerm || 'Term 1'),
      where('status', '==', 'paid')
    );
    if (currentBranch) paymentsQuery = query(paymentsQuery, where('branchId', '==', currentBranch.id));

    const unsubPayments = onSnapshot(
      paymentsQuery, 
      (snap) => {
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
        setLoading(false);
      }
    );

    // Fetch ALL unpaid invoices for the school to allow paying any outstanding balance
    let invoicesQuery = query(
      collection(db, 'schools', schoolId, 'invoices'),
      where('balanceDue', '>', 0)
    );
    if (currentBranch) invoicesQuery = query(invoicesQuery, where('branchId', '==', currentBranch.id));

    const unsubInvoices = onSnapshot(
      invoicesQuery, 
      (snap) => {
        const invs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
        setAllUnpaidInvoices(invs);
        // Also keep the current term ones for other logic if needed
        setInvoices(invs.filter(inv => inv.academicYear === school?.academicYear && inv.term === school?.currentTerm));
      }
    );

    let studentsQuery = query(collection(db, 'schools', schoolId, 'students'));
    if (currentBranch) studentsQuery = query(studentsQuery, where('branchId', '==', currentBranch.id));

    const unsubStudents = onSnapshot(studentsQuery, (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    });

    return () => {
      unsubPayments();
      unsubInvoices();
      unsubStudents();
    };
  }, [schoolId, school?.academicYear, school?.currentTerm]);

  // Handle studentId from query
  useEffect(() => {
    if (studentIdFromQuery && students.length > 0) {
      const student = students.find(s => s.id === studentIdFromQuery);
      if (student) {
        setValue('studentId', student.id);
        const studentInvoices = allUnpaidInvoices.filter(inv => inv.studentId === student.id);
        if (studentInvoices.length > 0) {
          setValue('invoiceId', studentInvoices[0].id);
          setValue('amount', studentInvoices[0].balanceDue);
          setValue('isArrearsPayment', false);
        } else if (student.arrears > 0) {
          setValue('invoiceId', 'arrears');
          setValue('isArrearsPayment', true);
          setValue('amount', student.arrears);
        }
        setIsModalOpen(true);
        // Clear the query param so it doesn't reopen on refresh
        setSearchParams({}, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }
  }, [studentIdFromQuery, allUnpaidInvoices, students, setValue, setSearchParams]);

  const onSubmit = async (data: PaymentForm) => {
    try {
      if (!data.invoiceId && !data.isArrearsPayment) {
        throw new Error('Please select an invoice or choose to pay arrears');
      }

      await runTransaction(db, async (transaction) => {
        const studentRef = doc(db, 'schools', schoolId, 'students', data.studentId);
        const studentDoc = await transaction.get(studentRef);
        if (!studentDoc.exists()) throw new Error("Student does not exist!");
        const studentData = studentDoc.data() as Student;

        let invoiceDoc: any = null;
        if (data.isArrearsPayment) {
          const newArrears = (studentData.arrears || 0) - data.amount;
          if (newArrears < 0) throw new Error("Payment amount exceeds arrears balance!");
          
          transaction.update(studentRef, { arrears: newArrears });
        } else if (data.invoiceId) {
          const invoiceRef = doc(db, 'schools', schoolId, 'invoices', data.invoiceId);
          invoiceDoc = await transaction.get(invoiceRef);
          if (!invoiceDoc.exists()) throw new Error("Invoice does not exist!");

          const invoiceData = invoiceDoc.data() as Invoice;
          const invoiceNumber = invoiceData.invoiceNumber;
          const newBalance = invoiceData.balanceDue - data.amount;

          if (newBalance < 0) throw new Error("Payment amount exceeds balance due!");

          transaction.update(invoiceRef, {
            balanceDue: newBalance,
            status: newBalance === 0 ? 'paid' : 'partially_paid',
            updatedAt: new Date().toISOString(),
          });
        }

        const paymentRef = doc(collection(db, 'schools', schoolId, 'payments'));
        const receiptNumber = `RCP-${Date.now().toString().slice(-6)}`;

        transaction.set(paymentRef, {
          schoolId,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          invoiceId: data.invoiceId || 'arrears',
          invoiceNumber: (data.invoiceId ? (invoiceDoc?.data() as any)?.invoiceNumber : null) || 'N/A',
          studentId: data.studentId,
          studentName: studentData.fullName,
          admissionNumber: studentData.admissionNumber,
          parentId: studentData.parentId,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          reference: data.reference || '',
          paymentDate: data.paymentDate,
          receiptNumber,
          status: 'paid',
          academicYear: school?.academicYear || '',
          term: data.term,
          createdAt: new Date().toISOString(),
        });
        
        if (studentData.parentId) {
          const notificationRef = doc(collection(db, 'schools', schoolId, 'notifications'));
          transaction.set(notificationRef, {
            schoolId,
            ...(currentBranch ? { branchId: currentBranch.id } : {}),
            parentId: studentData.parentId,
            title: 'New Receipt',
            message: `A new payment receipt (${receiptNumber}) has been generated for ${studentData.fullName}.`,
            type: 'new_receipt',
            read: false,
            createdAt: new Date().toISOString(),
          });
        }
      });

      toast.success('Payment recorded successfully');
      setIsModalOpen(false);
      reset();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error.message || 'Failed to record payment');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Payments</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Record and track fee payments.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                type="text"
                placeholder="Search payments..."
                className="pl-10 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder:text-white/40 focus:bg-white/20 outline-none w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2.5 bg-white text-maroon font-black uppercase tracking-widest text-[10px] rounded-xl shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Record Payment
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Receipt #</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Student</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Method</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((payment) => {
                const student = students.find(s => s.id === payment.studentId);
                return (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-900">{payment.receiptNumber}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-900">{student?.fullName || payment.studentName || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-extrabold text-green-600">{school?.currency} {payment.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{payment.term}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold uppercase text-gray-600">
                        {payment.paymentMethod.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-500">{payment.reference || '-'}</p>
                    </td>
                  </tr>
                );
              })}
              {payments.length > 0 && (
                <tr className="bg-gray-50 font-bold">
                  <td className="px-6 py-4 text-gray-900" colSpan={2}>TOTAL</td>
                  <td className="px-6 py-4 text-green-600">
                    {school?.currency} {payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Record Payment</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Select Student</label>
                  <select
                    {...register('studentId')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all bg-white"
                  >
                    <option value="">Choose a student...</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.fullName} ({s.admissionNumber})</option>
                    ))}
                  </select>
                  {errors.studentId && <p className="mt-1 text-xs text-red-500">{errors.studentId.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Select Invoice / Arrears</label>
                  <select
                    {...register('invoiceId', {
                      onChange: (e) => {
                        const val = e.target.value;
                        if (val === 'arrears') {
                          setValue('isArrearsPayment', true);
                          setValue('amount', selectedStudent?.arrears || 0);
                        } else {
                          setValue('isArrearsPayment', false);
                          const inv = studentInvoices.find(i => i.id === val);
                          if (inv) setValue('amount', inv.balanceDue);
                        }
                      }
                    })}
                    disabled={!selectedStudentId}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all bg-white disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Choose an option...</option>
                    {selectedStudent && selectedStudent.arrears > 0 && (
                      <option value="arrears">Previous Arrears (Bal: {school?.currency} {selectedStudent.arrears.toLocaleString()})</option>
                    )}
                    {studentInvoices.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} - {inv.term} {inv.academicYear} (Bal: {school?.currency} {inv.balanceDue.toLocaleString()})
                      </option>
                    ))}
                  </select>
                  {errors.invoiceId && <p className="mt-1 text-xs text-red-500">{errors.invoiceId.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Term</label>
                  <select
                    {...register('term')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all bg-white"
                  >
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Date</label>
                  <input
                    {...register('paymentDate')}
                    type="date"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Amount Paid</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    {...register('amount', { valueAsNumber: true })}
                    type="number"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none"
                    placeholder="0.00"
                  />
                </div>
                {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-2 gap-3">
                  {['cash', 'bank_transfer', 'mobile_money', 'cheque'].map((method) => (
                    <label key={method} className="relative flex items-center p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-all overflow-hidden">
                      <input
                        type="radio"
                        {...register('paymentMethod')}
                        value={method}
                        className="sr-only peer"
                      />
                      <div className="w-full text-center peer-checked:text-white z-10">
                        <span className="text-xs font-bold uppercase">{method.replace('_', ' ')}</span>
                      </div>
                      <div className="absolute inset-0 bg-school-gradient opacity-0 peer-checked:opacity-100 transition-all"></div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Reference / Transaction ID</label>
                <input
                  {...register('reference')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none"
                  placeholder="e.g. MPESA-ABC123XYZ"
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-school-gradient text-white font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
