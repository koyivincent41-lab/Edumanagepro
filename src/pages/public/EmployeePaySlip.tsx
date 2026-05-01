import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { Loader2, Search, FileText, Download, Printer, ArrowLeft, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import PublicLayout from '../../components/PublicLayout';
import { exportPayslipToPDF } from '../../lib/reportUtils';

export default function EmployeePaySlip() {
  const [step, setStep] = useState<'id' | 'month' | 'view'>('id');
  const [staffNumber, setStaffNumber] = useState('');
  const [employee, setEmployee] = useState<any>(null);
  const [school, setSchool] = useState<any>(null);
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [payslip, setPayslip] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleVerifyId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffNumber) return;

    setLoading(true);
    try {
      const q = query(collection(db, 'employees'), where('staffNumber', '==', staffNumber));
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error('Invalid Employee Unique ID. Please check and try again.');
        setLoading(false);
        return;
      }

      const empData = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
      setEmployee(empData);

      // Fetch school details
      const schoolSnap = await getDoc(doc(db, 'schools', empData.schoolId));
      if (schoolSnap.exists()) {
        setSchool({ id: schoolSnap.id, ...schoolSnap.data() });
      }

      // Fetch payroll periods for this school
      const periodsSnap = await getDocs(
        query(
          collection(db, 'schools', empData.schoolId, 'payroll_periods'),
          where('status', 'in', ['approved', 'paid'])
        )
      );
      
      const periodsData = periodsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort manually to avoid composite index requirement
      periodsData.sort((a: any, b: any) => {
        if (b.year !== a.year) return b.year - a.year;
        return b.month - a.month;
      });

      setPeriods(periodsData);

      if (periodsData.length === 0) {
        toast.error('No approved or paid payslips found for your school.');
        setLoading(false);
        return;
      }

      setStep('month');
    } catch (error) {
      console.error('Error verifying ID:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchPayslip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeriodId || !employee || !school) return;

    setLoading(true);
    try {
      // Find the payroll entry for this employee in this period
      // Note: We need to check if the employeeId in payroll_entries matches the root employee ID
      // or if we need to search by name/staffId if they weren't synced yet.
      const q = query(
        collection(db, 'schools', school.id, 'payroll_entries'),
        where('periodId', '==', selectedPeriodId),
        where('employeeId', '==', employee.id)
      );
      let snap = await getDocs(q);

      // Fallback: If not found by ID, try by name (for non-migrated data)
      if (snap.empty) {
        const q2 = query(
          collection(db, 'schools', school.id, 'payroll_entries'),
          where('periodId', '==', selectedPeriodId),
          where('employeeName', '==', employee.fullName)
        );
        snap = await getDocs(q2);
      }

      if (snap.empty) {
        toast.error('Payslip not found for the selected month.');
        setLoading(false);
        return;
      }

      setPayslip({ id: snap.docs[0].id, ...snap.docs[0].data() });
      setStep('view');
    } catch (error) {
      console.error('Error fetching payslip:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (month: number) => {
    const date = new Date();
    date.setMonth(month - 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  const handleDownload = async () => {
    if (payslip && selectedPeriodId && school) {
      const period = periods.find(p => p.id === selectedPeriodId);
      if (period) {
        await exportPayslipToPDF(payslip, period, school);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 no-print">
            <GraduationCap className="h-12 w-12 text-maroon mx-auto mb-4" />
            <h1 className="text-3xl font-black text-gray-900">Employee <span className="text-maroon">Pay Slip</span> Portal</h1>
            <p className="text-gray-500 mt-2">Access your monthly payslips securely.</p>
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
            {step === 'id' && (
              <div className="p-8 lg:p-12 max-w-md mx-auto">
                <form onSubmit={handleVerifyId} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Employee Unique ID</label>
                    <div className="relative group/input">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within/input:text-maroon transition-colors" />
                      <input
                        type="text"
                        value={staffNumber}
                        onChange={(e) => setStaffNumber(e.target.value.toUpperCase().trim())}
                        className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-gray-900 uppercase"
                        placeholder="e.g. 12AB"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-maroon text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-maroon/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify Identity'}
                  </button>
                </form>
              </div>
            )}

            {step === 'month' && employee && (
              <div className="p-8 lg:p-12 max-w-md mx-auto">
                <div className="mb-8 text-center">
                  <div className="w-20 h-20 bg-maroon/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-black text-maroon">{employee.fullName.charAt(0)}</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{employee.fullName}</h2>
                  <p className="text-sm text-gray-500">{employee.jobTitle} • {staffNumber}</p>
                </div>

                <form onSubmit={handleFetchPayslip} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Select Pay Period</label>
                    <select
                      value={selectedPeriodId}
                      onChange={(e) => setSelectedPeriodId(e.target.value)}
                      className="w-full px-4 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-gray-900"
                      required
                    >
                      <option value="">Select Month</option>
                      {periods.map(p => (
                        <option key={p.id} value={p.id}>
                          {getMonthName(p.month)} {p.year}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('id')}
                      className="flex-1 py-4 border border-gray-200 text-gray-600 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-gray-50 transition-all"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-2 py-4 bg-maroon text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-maroon/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 px-8"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'View Payslip'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {step === 'view' && payslip && school && (
              <div className="p-4 lg:p-8">
                <div className="flex justify-between items-center mb-8 no-print">
                  <button
                    onClick={() => setStep('month')}
                    className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-maroon transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Selection
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-bold text-sm"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </button>
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-2 px-4 py-2 bg-maroon text-white rounded-xl hover:bg-maroon/90 transition-all font-bold text-sm shadow-lg shadow-maroon/20"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </button>
                  </div>
                </div>

                {/* Payslip Content */}
                <div className="bg-white border-2 border-gray-100 rounded-3xl p-6 lg:p-10 print:border-0 print:p-0">
                  <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-10 border-b pb-10">
                    <div className="flex items-center gap-4">
                      {school.logo ? (
                        <img src={school.logo} alt={school.name} className="h-16 w-16 object-contain" />
                      ) : (
                        <div className="h-16 w-16 bg-maroon rounded-2xl flex items-center justify-center">
                          <GraduationCap className="h-8 w-8 text-white" />
                        </div>
                      )}
                      <div>
                        <h2 className="text-2xl font-black text-gray-900 uppercase">{school.name}</h2>
                        <p className="text-sm text-gray-500 font-medium">{school.address}</p>
                        <p className="text-sm text-gray-500 font-medium">{school.phone} • {school.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="inline-block px-4 py-1 bg-maroon text-white text-[10px] font-black uppercase tracking-widest rounded-full mb-2">
                        Official Pay Slip
                      </div>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Period</p>
                      <p className="text-xl font-black text-gray-900">
                        {getMonthName(periods.find(p => p.id === payslip.periodId)?.month)} {periods.find(p => p.id === payslip.periodId)?.year}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b pb-2">Employee Details</h3>
                      <div className="grid grid-cols-2 gap-y-3">
                        <p className="text-xs font-bold text-gray-500 uppercase">Full Name</p>
                        <p className="text-sm font-black text-gray-900">{employee.fullName}</p>
                        <p className="text-xs font-bold text-gray-500 uppercase">Staff ID</p>
                        <p className="text-sm font-black text-gray-900">{staffNumber}</p>
                        <p className="text-xs font-bold text-gray-500 uppercase">Payslip No</p>
                        <p className="text-sm font-black text-gray-900">{payslip.payslipNumber || 'N/A'}</p>
                        <p className="text-xs font-bold text-gray-500 uppercase">Designation</p>
                        <p className="text-sm font-black text-gray-900">{employee.jobTitle}</p>
                        <p className="text-xs font-bold text-gray-500 uppercase">Department</p>
                        <p className="text-sm font-black text-gray-900">{employee.department}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b pb-2">Payment Info</h3>
                      <div className="grid grid-cols-2 gap-y-3">
                        <p className="text-xs font-bold text-gray-500 uppercase">Basic Salary</p>
                        <p className="text-sm font-black text-gray-900">{school.currency} {payslip.basicSalary.toLocaleString()}</p>
                        <p className="text-xs font-bold text-gray-500 uppercase">Gross Pay</p>
                        <p className="text-sm font-black text-gray-900">{school.currency} {payslip.grossPay.toLocaleString()}</p>
                        <p className="text-xs font-bold text-gray-500 uppercase">Total Deductions</p>
                        <p className="text-sm font-black text-red-600">-{school.currency} {(payslip.grossPay - payslip.netPay).toLocaleString()}</p>
                        <p className="text-xs font-bold text-gray-500 uppercase">Net Pay</p>
                        <p className="text-xl font-black text-maroon">{school.currency} {payslip.netPay.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b pb-2">Allowances</h3>
                      <div className="space-y-2">
                        {payslip.allowances.map((allow: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center py-1">
                            <p className="text-sm font-medium text-gray-600">{allow.name}</p>
                            <p className="text-sm font-bold text-green-600">+{school.currency} {allow.amount.toLocaleString()}</p>
                          </div>
                        ))}
                        {payslip.allowances.length === 0 && <p className="text-xs text-gray-400 italic">No allowances this period</p>}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b pb-2">Deductions</h3>
                      <div className="space-y-2">
                        {payslip.deductions.map((ded: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center py-1">
                            <p className="text-sm font-medium text-gray-600">{ded.name}</p>
                            <p className="text-sm font-bold text-red-600">-{school.currency} {ded.amount.toLocaleString()}</p>
                          </div>
                        ))}
                        {payslip.deductions.length === 0 && <p className="text-xs text-gray-400 italic">No deductions this period</p>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-16 pt-10 border-t flex flex-col md:flex-row justify-between items-end gap-8">
                    <div className="text-center">
                      <div className="w-48 border-b-2 border-gray-200 mb-2"></div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Employee Signature</p>
                    </div>
                    <div className="text-center">
                      {school.signature && (
                        <img src={school.signature} alt="Authorized Signature" className="h-12 object-contain mx-auto mb-2" />
                      )}
                      <div className="w-48 border-b-2 border-gray-200 mb-2"></div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Authorized Signature</p>
                    </div>
                  </div>
                  
                  <div className="mt-10 text-center">
                    <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em]">This is a computer generated document</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 text-center no-print">
            <Link to="/login" className="text-sm font-bold text-maroon hover:underline decoration-2 underline-offset-4">
              Return to Login
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .bg-gray-50 { background: white !important; }
          .shadow-xl { shadow: none !important; }
          .border { border: none !important; }
        }
      `}</style>
    </PublicLayout>
  );
}
