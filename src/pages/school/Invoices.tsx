import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  FileText, 
  Download, 
  Printer, 
  MoreVertical, 
  Loader2,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  X,
  CheckSquare,
  Square,
  Mail,
  Edit2,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, where, getDocs, limit, startAfter } from 'firebase/firestore';
import { db } from '../../firebase';
import { Invoice, Student, Parent, Class, School, FeeType } from '../../types';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useBranch } from '../../context/BranchContext';

const invoiceSchema = z.object({
  studentId: z.string().min(1, 'Please select a student'),
  dueDate: z.string().min(1, 'Due date is required'),
  term: z.enum(['Term 1', 'Term 2', 'Term 3']),
  items: z.array(z.object({
    name: z.string().min(1, 'Item name is required'),
    amount: z.number().min(0, 'Amount must be positive'),
  })).min(1, 'At least one fee item is required'),
  notes: z.string().optional(),
});

type InvoiceForm = z.infer<typeof invoiceSchema>;

import { jsPDF } from 'jspdf';
import { exportInvoiceToPDF } from '../../lib/reportUtils';

export default function Invoices({ schoolId, school }: { schoolId: string; school: School | null }) {
  const { currentBranch } = useBranch();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedBulkFees, setSelectedBulkFees] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);

  const primaryColor = school?.primaryColor || '#800000';

  const handleExportPDF = async (invoice: Invoice) => {
    const student = students.find(s => s.id === invoice.studentId);
    const parent = parents.find(p => p.id === invoice.parentId);
    await exportInvoiceToPDF(invoice, student, parent, school);
  };

  const handleBulkPrint = async () => {
    if (selectedInvoices.length === 0) {
      toast.error('Please select invoices to print');
      return;
    }
    
    toast.info(`Generating ${selectedInvoices.length} invoices...`);
    
    for (const id of selectedInvoices) {
      const invoice = invoices.find(inv => inv.id === id);
      if (invoice) {
        await handleExportPDF(invoice);
      }
    }
    
    toast.success('All invoices exported successfully');
  };

  const toggleInvoiceSelection = (id: string) => {
    setSelectedInvoices(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      items: [{ name: '', amount: 0 }],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      term: school?.currentTerm || 'Term 1',
    },
  });

  const items = watch('items');

  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  const fetchInvoicesData = async (isLoadMore = false) => {
    if (!schoolId) return;
    setLoading(true);

    let invoicesQuery = query(
      collection(db, 'schools', schoolId, 'invoices'),
      where('academicYear', '==', school?.academicYear || ''),
      where('term', '==', school?.currentTerm || 'Term 1'),
      limit(PAGE_SIZE)
    );
    if (currentBranch) invoicesQuery = query(invoicesQuery, where('branchId', '==', currentBranch.id));
    if (isLoadMore && lastVisible) invoicesQuery = query(invoicesQuery, startAfter(lastVisible));

    try {
      const snap = await getDocs(invoicesQuery);
      const newInvoices = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));

      if (isLoadMore) {
        setInvoices(prev => [...prev, ...newInvoices]);
      } else {
        setInvoices(newInvoices);
      }

      setLastVisible(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === PAGE_SIZE);

      // Fetch students for these invoices
      const studentIds = [...new Set(newInvoices.map(inv => inv.studentId))];
      let newStudents: Student[] = [];
      if (studentIds.length > 0) {
        const sChunks = [];
        for (let i = 0; i < studentIds.length; i += 10) sChunks.push(studentIds.slice(i, i + 10));
        const sPromises = sChunks.map(chunk =>
          getDocs(query(collection(db, 'schools', schoolId, 'students'), where('__name__', 'in', chunk)))
        );
        const sSnaps = await Promise.all(sPromises);
        newStudents = sSnaps.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
        setStudents(prev => {
          const merged = [...prev];
          newStudents.forEach(ns => { if (!merged.find(s => s.id === ns.id)) merged.push(ns); });
          return merged;
        });
      }

      // Fetch parents for these students
      const parentIds = [...new Set(newStudents.map(s => s.parentId).filter(Boolean))];
      if (parentIds.length > 0) {
        const pChunks = [];
        for (let i = 0; i < parentIds.length; i += 10) pChunks.push(parentIds.slice(i, i + 10));
        const pPromises = pChunks.map(chunk =>
          getDocs(query(collection(db, 'schools', schoolId, 'parents'), where('__name__', 'in', chunk)))
        );
        const pSnaps = await Promise.all(pPromises);
        const newParents = pSnaps.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() } as Parent)));
        setParents(prev => {
          const merged = [...prev];
          newParents.forEach(np => { if (!merged.find(p => p.id === np.id)) merged.push(np); });
          return merged;
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!lastVisible) fetchInvoicesData();

    let feeTypesQuery = query(collection(db, 'schools', schoolId, 'feeTypes'));
    if (currentBranch) feeTypesQuery = query(feeTypesQuery, where('branchId', '==', currentBranch.id));

    const unsubFeeTypes = onSnapshot(feeTypesQuery, (snap) => {
      setFeeTypes(snap.docs.map(d => ({ id: d.id, ...d.data() } as FeeType)).filter(f => f.status === 'active'));
    });

    return () => {
      unsubFeeTypes();
    };
  }, [schoolId, school?.academicYear, school?.currentTerm, currentBranch]);

  const handleFeeTypeChange = (index: number, feeTypeId: string) => {
    const feeType = feeTypes.find(f => f.id === feeTypeId);
    if (feeType) {
      setValue(`items.${index}.name`, feeType.name);
      setValue(`items.${index}.amount`, feeType.amount);
    }
  };

  const handleBulkAdd = () => {
    const selectedFees = feeTypes.filter(f => selectedBulkFees.includes(f.id));
    const newItems = selectedFees.map(f => ({ name: f.name, amount: f.amount }));
    
    // Filter out the initial empty item if it's the only one
    const currentItems = items.filter(item => item.name !== '' || item.amount !== 0);
    setValue('items', [...currentItems, ...newItems]);
    
    setIsBulkModalOpen(false);
    setSelectedBulkFees([]);
  };

  const handleSendEmail = async (invoice: Invoice) => {
    const student = students.find(s => s.id === invoice.studentId);
    const parent = parents.find(p => p.id === invoice.parentId);
    
    if (!parent?.email) {
      toast.error('Parent email not found');
      return;
    }

    setIsSendingEmail(true);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: parent.email,
          subject: `Invoice ${invoice.invoiceNumber} from ${school?.name}`,
          text: `Hello ${parent.fullName},\n\nPlease find the invoice ${invoice.invoiceNumber} for ${student?.fullName}. Total amount: ${school?.currency} ${invoice.totalAmount.toLocaleString()}.\n\nDue date: ${new Date(invoice.dueDate).toLocaleDateString()}\n\nThank you.`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: ${primaryColor};">${school?.name}</h2>
              <p>Hello <strong>${parent.fullName}</strong>,</p>
              <p>Please find the invoice details for <strong>${student?.fullName}</strong> below:</p>
              <div style="background: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
                <p><strong>Total Amount:</strong> ${school?.currency} ${invoice.totalAmount.toLocaleString()}</p>
                <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
              </div>
              <p>You can view the full details by logging into the school portal.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 12px; color: #999;">${school?.invoiceFooter || 'Thank you for your continued support.'}</p>
            </div>
          `,
        }),
      });

      if (!response.ok) throw new Error('Failed to send email');

      // Save to System Emails (Outbox)
      await addDoc(collection(db, 'system_emails'), {
        from: 'support@edumanagepro.com',
        to: parent.email,
        subject: `Invoice ${invoice.invoiceNumber} from ${school?.name}`,
        message: `Invoice ${invoice.invoiceNumber} sent to ${parent.fullName} for ${student?.fullName}.`,
        type: 'outgoing',
        status: 'sent',
        read: true,
        createdAt: new Date().toISOString(),
        recipientName: parent.fullName,
        schoolId: schoolId
      });

      toast.success('Invoice sent via email successfully');
    } catch (error) {
      console.error('Error sending invoice email:', error);
      toast.error('Failed to send invoice email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const onSubmit = async (data: InvoiceForm) => {
    try {
      const student = students.find(s => s.id === data.studentId);
      if (!student) return;

      const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);

      if (editingInvoice) {
        // Find existing payments to adjust the balance due correctly
        const amountPaid = editingInvoice.totalAmount - editingInvoice.balanceDue;
        const newBalanceDue = totalAmount - amountPaid;
        const newStatus = newBalanceDue <= 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'sent');

        await updateDoc(doc(db, 'schools', schoolId, 'invoices', editingInvoice.id), {
          studentId: data.studentId,
          studentName: student.fullName,
          admissionNumber: student.admissionNumber,
          parentId: student.parentId,
          totalAmount,
          balanceDue: newBalanceDue,
          status: newStatus,
          dueDate: data.dueDate,
          notes: data.notes || '',
          term: data.term,
          academicYear: school?.academicYear,
          items: data.items,
          updatedAt: new Date().toISOString()
        });
        toast.success('Invoice updated successfully');
        setIsModalOpen(false);
        setEditingInvoice(null);
        reset();
        return;
      }

      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

      await addDoc(collection(db, 'schools', schoolId, 'invoices'), {
        schoolId,
        ...(currentBranch ? { branchId: currentBranch.id } : {}),
        invoiceNumber,
        studentId: data.studentId,
        studentName: student.fullName,
        admissionNumber: student.admissionNumber,
        parentId: student.parentId,
        totalAmount,
        balanceDue: totalAmount,
        status: 'sent',
        dueDate: data.dueDate,
        notes: data.notes || '',
        items: data.items,
        academicYear: school?.academicYear || '',
        term: data.term,
        createdAt: new Date().toISOString(),
      });

      if (student.parentId) {
        await addDoc(collection(db, 'schools', schoolId, 'notifications'), {
          schoolId,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          parentId: student.parentId,
          title: 'New Invoice',
          message: `A new invoice (${invoiceNumber}) has been generated for ${student.fullName}.`,
          type: 'new_invoice',
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      toast.success('Invoice created successfully');
      setIsModalOpen(false);
      reset();
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Failed to create invoice');
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setValue('studentId', invoice.studentId);
    setValue('dueDate', invoice.dueDate);
    setValue('term', invoice.term || 'Term 1');
    setValue('items', invoice.items);
    setValue('notes', invoice.notes || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (invoiceId: string) => {
    if (window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'schools', schoolId, 'invoices', invoiceId));
        toast.success('Invoice deleted successfully');
      } catch (error) {
        console.error('Error deleting invoice:', error);
        toast.error('Failed to delete invoice');
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-600';
      case 'partially_paid': return 'bg-blue-100 text-blue-600';
      case 'overdue': return 'bg-red-100 text-red-600';
      case 'cancelled': return 'bg-gray-100 text-gray-600';
      default: return 'bg-yellow-100 text-yellow-600';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-4 md:p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white">Fee Invoices</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Manage school fee billing and tracking.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                type="text"
                placeholder="Search invoices..."
                className="pl-10 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder:text-white/40 focus:bg-white/20 outline-none w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={async () => {
                if (!window.confirm('Are you sure you want to carry forward all outstanding balances from PREVIOUS terms/years as arrears? This will update all students\' arrears field.')) return;
                
                setLoading(true);
                try {
                  const allInvoicesSnap = await getDocs(collection(db, 'schools', schoolId, 'invoices'));
                  const allInvs = allInvoicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
                  const termOrder: Record<string, number> = { 'Term 1': 1, 'Term 2': 2, 'Term 3': 3 };
                  const currentTermOrder = termOrder[school?.currentTerm || 'Term 1'] || 1;
                  const currentYear = parseInt(school?.academicYear || '0');
                  const studentBalances: Record<string, number> = {};
                  allInvs.forEach(inv => {
                    const invYear = parseInt(inv.academicYear || '0');
                    const invTermOrder = termOrder[inv.term || 'Term 1'] || 1;
                    const isPreviousYear = invYear < currentYear;
                    const isPreviousTermSameYear = invYear === currentYear && invTermOrder < currentTermOrder;
                    if ((isPreviousYear || isPreviousTermSameYear) && inv.balanceDue > 0) {
                      studentBalances[inv.studentId] = (studentBalances[inv.studentId] || 0) + inv.balanceDue;
                    }
                  });
                  const batch = students.map(student => {
                    const balance = studentBalances[student.id] || 0;
                    return updateDoc(doc(db, 'schools', schoolId, 'students', student.id), {
                      arrears: (student.arrears || 0) + balance
                    });
                  });
                  const invoiceUpdates = allInvs.filter(inv => {
                    const invYear = parseInt(inv.academicYear || '0');
                    const invTermOrder = termOrder[inv.term || 'Term 1'] || 1;
                    const isPreviousYear = invYear < currentYear;
                    const isPreviousTermSameYear = invYear === currentYear && invTermOrder < currentTermOrder;
                    return (isPreviousYear || isPreviousTermSameYear) && inv.balanceDue > 0;
                  }).map(inv => {
                    return updateDoc(doc(db, 'schools', schoolId, 'invoices', inv.id), {
                      balanceDue: 0,
                      status: 'paid',
                      notes: (inv.notes || '') + '\n[Carried forward to student arrears]'
                    });
                  });
                  await Promise.all([...batch, ...invoiceUpdates]);
                  toast.success('Outstanding balances carried forward to student arrears successfully');
                } catch (error) {
                  console.error('Error carrying forward arrears:', error);
                  toast.error('Failed to carry forward arrears');
                } finally {
                  setLoading(false);
                }
              }}
              className="px-4 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-white/20 transition-all flex items-center gap-2"
            >
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              Carry Forward
            </button>
            <button 
              onClick={handleBulkPrint}
              disabled={selectedInvoices.length === 0}
              className="px-4 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-white/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              Bulk Print ({selectedInvoices.length})
            </button>
            <button 
              onClick={() => { setEditingInvoice(null); reset(); setIsModalOpen(true); }}
              className="px-4 md:px-6 py-2.5 bg-white text-maroon font-black uppercase tracking-widest text-[10px] rounded-xl shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Invoice
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[700px] w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 md:px-6 py-4">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                    checked={selectedInvoices.length === invoices.length && invoices.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedInvoices(invoices.map(i => i.id));
                      } else {
                        setSelectedInvoices([]);
                      }
                    }}
                  />
                </th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Invoice</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Student / Parent</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Due Date</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((invoice) => {
                const student = students.find(s => s.id === invoice.studentId);
                const parent = parents.find(p => p.id === invoice.parentId);
                return (
                  <tr key={invoice.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 md:px-6 py-4">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                        checked={selectedInvoices.includes(invoice.id)}
                        onChange={() => toggleInvoiceSelection(invoice.id)}
                      />
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-school-gradient/10 rounded-xl flex items-center justify-center text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{invoice.invoiceNumber}</p>
                          <p className="text-xs text-gray-500">{new Date(invoice.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <p className="text-sm font-bold text-gray-900">{student?.fullName || 'N/A'}</p>
                      <p className="text-xs text-gray-500">{parent?.fullName || 'N/A'}</p>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <p className="text-sm font-extrabold text-gray-900">{school?.currency} {invoice.totalAmount.toLocaleString()}</p>
                      <p className="text-xs text-red-500 font-medium">Bal: {school?.currency} {invoice.balanceDue.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{invoice.term}</p>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(invoice.status)}`}>
                        {invoice.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {new Date(invoice.dueDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setSelectedInvoice(invoice)}
                          className="p-2 text-black hover:bg-gray-200 rounded-lg transition-colors" 
                          title="View Invoice"
                        >
                          <FileText className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => handleExportPDF(invoice)}
                          className="p-2 text-black hover:bg-gray-200 rounded-lg transition-colors" 
                          title="Download PDF"
                        >
                          <Download className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => handleEdit(invoice)}
                          className="p-2 text-black hover:bg-gray-200 hover:text-primary rounded-lg transition-colors" 
                          title="Edit"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(invoice.id)}
                          className="p-2 text-black hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors" 
                          title="Delete"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                        <button className="p-2 text-black hover:bg-gray-200 rounded-lg transition-colors" title="Print">
                          <Printer className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => fetchInvoicesData(true)}
            disabled={loading}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
            Load More Invoices
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-[calc(100%-2rem)] md:w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-school-gradient/10 rounded-xl text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Invoice Preview</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleExportPDF(selectedInvoice)}
                  className="p-3 hover:bg-gray-200 rounded-xl transition-colors text-primary flex items-center gap-2 font-bold text-sm"
                >
                  <Download className="h-5 w-5" />
                  Download
                </button>
                <button 
                  onClick={() => window.print()}
                  className="p-3 hover:bg-gray-200 rounded-xl transition-colors text-gray-600 flex items-center gap-2 font-bold text-sm"
                >
                  <Printer className="h-5 w-5" />
                  Print
                </button>
                <button 
                  onClick={() => setSelectedInvoice(null)} 
                  className="p-3 hover:bg-gray-200 rounded-xl transition-colors text-gray-400"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 bg-white print:p-0" id="printable-invoice">
              {/* Letterhead */}
              <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start mb-8 sm:mb-12 border-b-4 pb-6 sm:pb-8 gap-6 sm:gap-0" style={{ borderColor: primaryColor }}>
                <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6">
                  {school?.logo ? (
                    <img src={school.logo || undefined} alt="Logo" className="h-16 w-16 md:h-24 md:w-24 object-contain rounded-2xl shadow-sm shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-16 w-16 md:h-24 md:w-24 bg-primary rounded-2xl flex items-center justify-center text-white font-bold text-2xl md:text-4xl shadow-lg shrink-0">
                      {school?.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl md:text-3xl font-black tracking-tighter text-gray-900 dark:text-white uppercase break-words px-2 sm:px-0">{school?.name}</h1>
                    <p className="text-primary font-bold italic text-lg">{school?.motto}</p>
                    <div className="mt-2 md:mt-3 text-xs md:text-sm text-gray-500 space-y-0.5 font-medium break-words px-2 sm:px-0">
                      <p>{school?.address}</p>
                      <p className="break-words">Tel: {school?.phone} | Email: {school?.email}</p>
                    </div>
                  </div>
                </div>
                <div className="text-center sm:text-right w-full sm:w-auto mt-4 sm:mt-0">
                  <div className="inline-block px-4 md:px-6 py-2 rounded-full text-white font-black text-sm uppercase tracking-widest mb-4" style={{ backgroundColor: primaryColor }}>
                    Invoice
                  </div>
                  <p className="text-2xl md:text-4xl font-black text-gray-900 tracking-tighter">{selectedInvoice.invoiceNumber}</p>
                  <p className="text-sm font-bold text-gray-400 mt-1 uppercase tracking-widest">Date: {new Date(selectedInvoice.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-12 mb-8 md:mb-12">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Bill To:</p>
                  <div className="space-y-1">
                    <p className="text-xl font-black text-gray-900">{students.find(s => s.id === selectedInvoice.studentId)?.fullName}</p>
                    <p className="text-sm font-bold text-gray-600">Adm: {students.find(s => s.id === selectedInvoice.studentId)?.admissionNumber}</p>
                    <p className="text-sm font-medium text-gray-500 mt-2">Parent: {parents.find(p => p.id === selectedInvoice.parentId)?.fullName}</p>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-gray-100 dark:border-gray-800 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Due Date:</span>
                    <span className="text-sm font-black text-red-600">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Status:</span>
                    <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${getStatusColor(selectedInvoice.status)}`}>
                      {selectedInvoice.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-8 md:mb-12 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Description</th>
                      <th className="py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Amount ({school?.currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {selectedInvoice.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-5 text-sm font-bold text-gray-700">{item.name}</td>
                        <td className="py-5 text-right text-sm font-black text-gray-900">{item.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-900">
                      <td className="py-4 md:py-6 text-sm md:text-lg font-black text-gray-900 uppercase tracking-tighter">Total Amount</td>
                      <td className="py-4 md:py-6 text-right text-lg md:text-2xl font-black text-gray-900" style={{ color: primaryColor }}>
                        {school?.currency} {selectedInvoice.totalAmount.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-sm font-bold text-gray-400 uppercase tracking-widest">Balance Due</td>
                      <td className="py-2 text-right text-lg font-black text-red-600">
                        {school?.currency} {selectedInvoice.balanceDue.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedInvoice.notes && (
                <div className="mb-12 p-4 md:p-6 bg-yellow-50/50 rounded-2xl border border-yellow-100">
                  <p className="text-[10px] font-black text-yellow-700 uppercase tracking-widest mb-2">Notes:</p>
                  <p className="text-sm text-yellow-800 font-medium italic">{selectedInvoice.notes}</p>
                </div>
              )}

              <div className="mt-auto pt-12 border-t border-gray-100 relative">
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-400 italic">{school?.invoiceFooter || 'Thank you for your continued support.'}</p>
                  <div className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    For technical support, contact: support@edumanagepro.com
                  </div>
                  <div className="mt-6 flex justify-center gap-4 md:gap-8 text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">
                    <span>Official Document</span>
                    <span>•</span>
                    <span>{school?.name}</span>
                    <span>•</span>
                    <span>{new Date().getFullYear()}</span>
                  </div>
                </div>

                {/* Approved Seal */}
                <div className="absolute right-0 bottom-12 opacity-20 print:opacity-100">
                  <div 
                    className="w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center rotate-[-15deg] p-2 text-center"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    <span className="text-[8px] font-black uppercase tracking-widest leading-none mb-1">{school?.name}</span>
                    <span className="text-xl font-black uppercase tracking-tighter leading-none">Approved</span>
                    <span className="text-[10px] font-bold my-1">{selectedInvoice.invoiceNumber}</span>
                    <span className="text-[8px] font-bold">{new Date().toLocaleDateString()}</span>
                    <div className="absolute inset-0 rounded-full border border-dashed opacity-50 m-1" style={{ borderColor: primaryColor }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-[calc(100%-2rem)] md:w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">{editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}</h2>
              <button onClick={() => { setIsModalOpen(false); setEditingInvoice(null); reset(); }} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-4 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Student</label>
                <select
                  {...register('studentId')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all bg-white"
                >
                  <option value="">Choose a student...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.fullName} ({s.admissionNumber})</option>)}
                </select>
                {errors.studentId && <p className="mt-1 text-xs text-red-500">{errors.studentId.message}</p>}
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Fee Items</h3>
                  <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setIsBulkModalOpen(true)}
                      className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <CheckSquare className="h-3 w-3" />
                      Bulk Add Fees
                    </button>
                    <button 
                      type="button"
                      onClick={() => setValue('items', [...items, { name: '', amount: 0 }])}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>
                {items.map((_, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 items-start">
                    <div className="col-span-7">
                      <select
                        value={feeTypes.find(f => f.name === items[index].name && f.amount === items[index].amount)?.id || ""}
                        onChange={(e) => handleFeeTypeChange(index, e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none bg-white font-bold"
                      >
                        <option value="">Select Fee Type...</option>
                        {feeTypes.map(f => (
                          <option key={f.id} value={f.id}>{f.name} ({school?.currency} {f.amount.toLocaleString()})</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-4">
                      <input
                        {...register(`items.${index}.amount`, { valueAsNumber: true })}
                        type="number"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none"
                        placeholder="Amount"
                      />
                    </div>
                    <div className="col-span-1 pt-3">
                      {items.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => setValue('items', items.filter((__, i) => i !== index))}
                          className="text-red-400 hover:text-red-600"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
                  <input
                    {...register('dueDate')}
                    type="date"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingInvoice(null); reset(); }}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-school-gradient text-white font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
                  {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Bulk Add Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-[calc(100%-2rem)] md:w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
              <h2 className="text-xl font-bold text-gray-900">Bulk Add Fees</h2>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 md:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {feeTypes.length === 0 ? (
                <p className="text-center text-gray-500 py-4 md:py-8">No fee types found. Please create some first.</p>
              ) : (
                feeTypes.map(fee => (
                  <button
                    key={fee.id}
                    onClick={() => {
                      setSelectedBulkFees(prev => 
                        prev.includes(fee.id) 
                          ? prev.filter(id => id !== fee.id) 
                          : [...prev, fee.id]
                      );
                    }}
                    className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between group ${
                      selectedBulkFees.includes(fee.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg transition-colors ${
                        selectedBulkFees.includes(fee.id) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {selectedBulkFees.includes(fee.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-gray-900">{fee.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{fee.frequency}</p>
                      </div>
                    </div>
                    <p className="font-black text-primary">{school?.currency} {fee.amount.toLocaleString()}</p>
                  </button>
                ))
              )}
            </div>
            <div className="p-4 md:p-6 bg-gray-50 flex gap-3">
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="flex-1 py-3 bg-white text-gray-600 font-bold rounded-xl border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAdd}
                disabled={selectedBulkFees.length === 0}
                className="flex-1 py-3 bg-school-gradient text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50"
              >
                Add {selectedBulkFees.length} Items
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
