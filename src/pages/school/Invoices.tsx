import React, { useState, useEffect, useMemo } from 'react';
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
  RefreshCw,
  Filter,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs, 
  writeBatch,
  setDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Invoice, Student, Parent, School, FeeType, Term, InvoiceStatus } from '../../types';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useBranch } from '../../context/BranchContext';
import { exportInvoiceToPDF } from '../../lib/reportUtils';

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

const TERMS: Term[] = ['Term 1', 'Term 2', 'Term 3'];

export default function Invoices({ schoolId, school }: { schoolId: string; school: School | null }) {
  const { currentBranch } = useBranch();

  // Active academic year & term state (can be switched locally to view/manage any term or synchronized with school)
  const activeSchoolYear = school?.academicYear || new Date().getFullYear().toString();
  const activeSchoolTerm = (school?.currentTerm as Term) || 'Term 1';

  const [selectedYear, setSelectedYear] = useState<string>(activeSchoolYear);
  const [selectedTerm, setSelectedTerm] = useState<Term>(activeSchoolTerm);

  // Sync with global school updates (e.g. from top navbar)
  useEffect(() => {
    if (school?.academicYear) {
      setSelectedYear(school.academicYear);
    }
  }, [school?.academicYear]);

  useEffect(() => {
    if (school?.currentTerm) {
      setSelectedTerm(school.currentTerm as Term);
    }
  }, [school?.currentTerm]);

  // Data states
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);

  // Loading states
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  // Selection & Modal states
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedBulkFees, setSelectedBulkFees] = useState<string[]>([]);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isUpdatingSchoolTerm, setIsUpdatingSchoolTerm] = useState(false);

  const primaryColor = school?.primaryColor || '#800000';

  // React Hook Form for Invoice creation / editing
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
      studentId: '',
      items: [{ name: '', amount: 0 }],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      term: selectedTerm,
      notes: '',
    },
  });

  const items = watch('items');

  // =========================================================================
  // 1. LEARNERS & PARENTS DATA SUBSCRIPTION (Real-time & Term-Resilient)
  // Learners are loaded from the database directly and never lost on term switch
  // =========================================================================
  useEffect(() => {
    if (!schoolId) return;
    setLoadingStudents(true);

    let studentsQuery = query(collection(db, 'schools', schoolId, 'students'));
    if (currentBranch) {
      studentsQuery = query(studentsQuery, where('branchId', '==', currentBranch.id));
    }

    const unsubStudents = onSnapshot(
      studentsQuery,
      (snapshot) => {
        const loadedStudents = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        setStudents(loadedStudents);
        setLoadingStudents(false);
      },
      (error) => {
        console.error('Error fetching students:', error);
        setLoadingStudents(false);
      }
    );

    let parentsQuery = query(collection(db, 'schools', schoolId, 'parents'));
    if (currentBranch) {
      parentsQuery = query(parentsQuery, where('branchId', '==', currentBranch.id));
    }

    const unsubParents = onSnapshot(
      parentsQuery,
      (snapshot) => {
        const loadedParents = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Parent));
        setParents(loadedParents);
      },
      (error) => {
        console.error('Error fetching parents:', error);
      }
    );

    let feeTypesQuery = query(collection(db, 'schools', schoolId, 'feeTypes'));
    if (currentBranch) {
      feeTypesQuery = query(feeTypesQuery, where('branchId', '==', currentBranch.id));
    }

    const unsubFeeTypes = onSnapshot(feeTypesQuery, (snap) => {
      setFeeTypes(snap.docs.map(d => ({ id: d.id, ...d.data() } as FeeType)).filter(f => f.status === 'active'));
    });

    return () => {
      unsubStudents();
      unsubParents();
      unsubFeeTypes();
    };
  }, [schoolId, currentBranch?.id]);

  // =========================================================================
  // 2. INVOICES DATA SUBSCRIPTION (STRICTLY ISOLATED BY ACADEMIC YEAR & TERM)
  // Each academic term has its own independent invoice list
  // Old term invoices are immediately cleared upon switching terms
  // =========================================================================
  useEffect(() => {
    if (!schoolId) return;

    // Immediately clear previous term invoices and selections to prevent stale display
    setInvoices([]);
    setSelectedInvoices([]);
    setCurrentPage(1);
    setLoadingInvoices(true);

    let invoicesQuery = query(
      collection(db, 'schools', schoolId, 'invoices'),
      where('academicYear', '==', selectedYear),
      where('term', '==', selectedTerm)
    );

    if (currentBranch) {
      invoicesQuery = query(invoicesQuery, where('branchId', '==', currentBranch.id));
    }

    const unsubscribe = onSnapshot(
      invoicesQuery,
      (snapshot) => {
        const loaded = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
        // Sort newest first by createdAt
        loaded.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setInvoices(loaded);
        setLoadingInvoices(false);
      },
      (error) => {
        console.error(`Error loading invoices for ${selectedYear} ${selectedTerm}:`, error);
        setLoadingInvoices(false);
        toast.error(`Failed to load invoices for ${selectedTerm}`);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [schoolId, selectedYear, selectedTerm, currentBranch?.id]);

  // Filter eligible active learners for the Create Invoice dropdown
  const eligibleStudents = useMemo(() => {
    // Exclude withdrawn, transferred, inactive or graduated learners
    const active = students.filter(s => 
      s.status !== 'inactive' && 
      s.status !== 'graduated' && 
      s.status !== 'transferred' && 
      (s as any).status !== 'withdrawn'
    );

    // If students have academicYear assigned, match the active year; otherwise allow all active
    const yearMatched = active.filter(s => !s.academicYear || s.academicYear === selectedYear);
    const result = yearMatched.length > 0 ? yearMatched : active;

    return [...result].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [students, selectedYear]);

  // Invoices filtered by search term and status
  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'unpaid' && (invoice.status === 'paid' || invoice.status === 'cancelled')) return false;
        if (statusFilter !== 'unpaid' && invoice.status !== statusFilter) return false;
      }

      // Search filter
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const student = students.find(s => s.id === invoice.studentId);
      const parent = parents.find(p => p.id === invoice.parentId);

      const matchesNumber = invoice.invoiceNumber?.toLowerCase().includes(term);
      const matchesStudent = student?.fullName?.toLowerCase().includes(term) || invoice.studentName?.toLowerCase().includes(term);
      const matchesAdmission = student?.admissionNumber?.toLowerCase().includes(term) || invoice.admissionNumber?.toLowerCase().includes(term);
      const matchesParent = parent?.fullName?.toLowerCase().includes(term);
      const matchesStatus = invoice.status?.toLowerCase().includes(term);

      return matchesNumber || matchesStudent || matchesAdmission || matchesParent || matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter, students, parents]);

  // Term financial statistics
  const termTotals = useMemo(() => {
    const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const balanceDue = invoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
    const totalCollected = totalInvoiced - balanceDue;
    const paidCount = invoices.filter(inv => inv.status === 'paid').length;
    const partialCount = invoices.filter(inv => inv.status === 'partially_paid').length;
    const pendingCount = invoices.filter(inv => inv.status === 'sent' || inv.status === 'draft').length;
    const overdueCount = invoices.filter(inv => inv.status === 'overdue').length;

    return {
      totalInvoiced,
      totalCollected,
      balanceDue,
      invoiceCount: invoices.length,
      paidCount,
      partialCount,
      pendingCount,
      overdueCount
    };
  }, [invoices]);

  // Pagination slice
  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredInvoices.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredInvoices, currentPage]);

  const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE) || 1;

  // Handlers for switching term / setting active term
  const handleTermSelect = (term: Term) => {
    setSelectedTerm(term);
    setSearchTerm('');
    setStatusFilter('all');
  };

  const handleSetSchoolActiveTerm = async (term: Term) => {
    if (!schoolId) return;
    setIsUpdatingSchoolTerm(true);
    try {
      await setDoc(doc(db, 'schools', schoolId), {
        currentTerm: term
      }, { merge: true });
      toast.success(`Active school term changed to ${term}`);
    } catch (error) {
      console.error('Error updating school active term:', error);
      toast.error('Failed to update school active term');
    } finally {
      setIsUpdatingSchoolTerm(false);
    }
  };

  // PDF Export
  const handleExportPDF = async (invoice: Invoice) => {
    const student = students.find(s => s.id === invoice.studentId);
    const parent = parents.find(p => p.id === invoice.parentId);
    await exportInvoiceToPDF(invoice, student, parent, school);
  };

  // Bulk Print
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

  // Open Create Invoice Modal with fresh default values for the selected term
  const handleOpenCreateModal = () => {
    setEditingInvoice(null);
    reset({
      studentId: '',
      items: [{ name: '', amount: 0 }],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      term: selectedTerm,
      notes: '',
    });
    setIsModalOpen(true);
  };

  // Open Edit Invoice Modal
  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setValue('studentId', invoice.studentId);
    setValue('dueDate', invoice.dueDate);
    setValue('term', invoice.term || selectedTerm);
    setValue('items', invoice.items && invoice.items.length > 0 ? invoice.items : [{ name: '', amount: 0 }]);
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
                <p><strong>Academic Term:</strong> ${invoice.term || selectedTerm} (${invoice.academicYear || selectedYear})</p>
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

  // Submit Invoice Form
  const onSubmit = async (data: InvoiceForm) => {
    try {
      const student = students.find(s => s.id === data.studentId);
      if (!student) {
        toast.error('Selected learner not found. Please choose a learner from the list.');
        return;
      }

      const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);

      if (editingInvoice) {
        const amountPaid = editingInvoice.totalAmount - editingInvoice.balanceDue;
        const newBalanceDue = totalAmount - amountPaid;
        const newStatus: InvoiceStatus = newBalanceDue <= 0 ? 'paid' : (amountPaid > 0 ? 'partially_paid' : 'sent');

        await updateDoc(doc(db, 'schools', schoolId, 'invoices', editingInvoice.id), {
          studentId: data.studentId,
          studentName: student.fullName,
          admissionNumber: student.admissionNumber,
          parentId: student.parentId || '',
          totalAmount,
          balanceDue: newBalanceDue,
          status: newStatus,
          dueDate: data.dueDate,
          notes: data.notes || '',
          term: data.term || selectedTerm,
          academicYear: editingInvoice.academicYear || selectedYear,
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
      const assignedTerm = data.term || selectedTerm;
      const assignedYear = selectedYear;

      await addDoc(collection(db, 'schools', schoolId, 'invoices'), {
        schoolId,
        ...(currentBranch ? { branchId: currentBranch.id } : {}),
        invoiceNumber,
        studentId: data.studentId,
        studentName: student.fullName,
        admissionNumber: student.admissionNumber,
        parentId: student.parentId || '',
        totalAmount,
        balanceDue: totalAmount,
        status: 'sent',
        dueDate: data.dueDate,
        notes: data.notes || '',
        items: data.items,
        academicYear: assignedYear,
        term: assignedTerm,
        createdAt: new Date().toISOString(),
      });

      if (student.parentId) {
        await addDoc(collection(db, 'schools', schoolId, 'notifications'), {
          schoolId,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          parentId: student.parentId,
          title: 'New Invoice',
          message: `A new invoice (${invoiceNumber}) for ${assignedTerm} has been generated for ${student.fullName}.`,
          type: 'new_invoice',
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      toast.success(`Invoice created successfully for ${assignedTerm}`);
      setIsModalOpen(false);
      reset();
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Failed to create invoice');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'partially_paid': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'overdue': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'cancelled': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  // Carry forward arrears safely chunked
  const handleCarryForward = async () => {
    if (!window.confirm('Are you sure you want to carry forward all outstanding balances from PREVIOUS terms/years as arrears? This will update students\' arrears field and mark previous outstanding invoices as carried forward.')) return;
    
    setLoadingInvoices(true);
    try {
      const allInvoicesSnap = await getDocs(collection(db, 'schools', schoolId, 'invoices'));
      const allInvs = allInvoicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
      const termOrder: Record<string, number> = { 'Term 1': 1, 'Term 2': 2, 'Term 3': 3 };
      const currentTermOrder = termOrder[selectedTerm] || 1;
      const currentYearNum = parseInt(selectedYear || '0');

      const studentBalances: Record<string, number> = {};
      const invoicesToUpdate: Invoice[] = [];

      allInvs.forEach(inv => {
        const invYearNum = parseInt(inv.academicYear || '0');
        const invTermOrder = termOrder[inv.term || 'Term 1'] || 1;
        const isPreviousYear = invYearNum < currentYearNum;
        const isPreviousTermSameYear = invYearNum === currentYearNum && invTermOrder < currentTermOrder;

        if ((isPreviousYear || isPreviousTermSameYear) && (inv.balanceDue || 0) > 0) {
          studentBalances[inv.studentId] = (studentBalances[inv.studentId] || 0) + inv.balanceDue;
          invoicesToUpdate.push(inv);
        }
      });

      // Commit in safe chunks of 400 operations
      let batch = writeBatch(db);
      let opCount = 0;

      for (const student of students) {
        const balance = studentBalances[student.id];
        if (balance && balance > 0) {
          batch.update(doc(db, 'schools', schoolId, 'students', student.id), {
            arrears: (student.arrears || 0) + balance
          });
          opCount++;
          if (opCount >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            opCount = 0;
          }
        }
      }

      for (const inv of invoicesToUpdate) {
        batch.update(doc(db, 'schools', schoolId, 'invoices', inv.id), {
          balanceDue: 0,
          status: 'paid',
          notes: (inv.notes || '') + `\n[Carried forward to arrears for ${selectedTerm} ${selectedYear}]`
        });
        opCount++;
        if (opCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }

      if (opCount > 0) {
        await batch.commit();
      }

      toast.success('Outstanding balances carried forward to learner arrears successfully');
    } catch (error) {
      console.error('Error carrying forward arrears:', error);
      toast.error('Failed to carry forward arrears');
    } finally {
      setLoadingInvoices(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with gradient styling */}
      <div className="bg-school-gradient p-5 md:p-8 rounded-[2.5rem] shadow-xl shadow-maroon/20 relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-full border border-white/20">
                {selectedYear} Academic Year
              </span>
              <span className="px-3 py-1 bg-white text-maroon text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">
                {selectedTerm}
              </span>
              {selectedTerm === activeSchoolTerm ? (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Current Active School Term
                </span>
              ) : (
                <button
                  onClick={() => handleSetSchoolActiveTerm(selectedTerm)}
                  disabled={isUpdatingSchoolTerm}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold rounded-full border border-white/20 transition-all flex items-center gap-1"
                >
                  {isUpdatingSchoolTerm && <Loader2 className="w-3 h-3 animate-spin" />}
                  Make This Current School Term
                </button>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Fee Invoices</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide mt-1">
              Independent term-based invoice lists, fee tracking, and billing management.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={handleCarryForward}
              className="px-4 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-white/20 transition-all flex items-center gap-2"
              title="Carry forward previous term balances to learner arrears"
            >
              <AlertCircle className="h-4 w-4 text-yellow-300" />
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
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 bg-white text-maroon font-black uppercase tracking-widest text-[11px] rounded-xl shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              Create Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Term Switcher & Filter Toolbar */}
      <div className="bg-white p-4 md:p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Term Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-xs font-black uppercase tracking-widest text-gray-400 mr-2 flex items-center gap-1 shrink-0">
            <Layers className="h-3.5 w-3.5 text-primary" />
            Term:
          </span>
          {TERMS.map((term) => {
            const isSelected = selectedTerm === term;
            const isSchoolActive = activeSchoolTerm === term;
            return (
              <button
                key={term}
                onClick={() => handleTermSelect(term)}
                className={`relative px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                  isSelected
                    ? 'bg-school-gradient text-white shadow-md shadow-maroon/20 scale-105'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200/60'
                }`}
              >
                <span>{term}</span>
                {isSchoolActive && (
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'}`} title="Current School Term" />
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Status Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${selectedTerm} invoices...`}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder:text-gray-400 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none cursor-pointer hover:bg-gray-100"
            >
              <option value="all">All Statuses</option>
              <option value="sent">Sent / Pending</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="unpaid">Any Unpaid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Term-Specific Financial Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white p-4 md:p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Total Billed ({selectedTerm})</span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-lg md:text-2xl font-black text-gray-900">
              {school?.currency || 'KES'} {termTotals.totalInvoiced.toLocaleString()}
            </p>
            <p className="text-[11px] font-bold text-gray-500 mt-0.5">
              {termTotals.invoiceCount} invoices issued in {selectedTerm}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Collected ({selectedTerm})</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-lg md:text-2xl font-black text-emerald-600">
              {school?.currency || 'KES'} {termTotals.totalCollected.toLocaleString()}
            </p>
            <p className="text-[11px] font-bold text-emerald-700/80 mt-0.5">
              {termTotals.paidCount} fully paid • {termTotals.partialCount} partial
            </p>
          </div>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">Outstanding Balance</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-lg md:text-2xl font-black text-rose-600">
              {school?.currency || 'KES'} {termTotals.balanceDue.toLocaleString()}
            </p>
            <p className="text-[11px] font-bold text-rose-700/80 mt-0.5">
              {termTotals.pendingCount + termTotals.partialCount} invoices pending collection
            </p>
          </div>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Available Learners</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-lg md:text-2xl font-black text-gray-900">
              {loadingStudents ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary inline" />
              ) : (
                eligibleStudents.length
              )}
            </p>
            <p className="text-[11px] font-bold text-gray-500 mt-0.5">
              Active learners ready for billing
            </p>
          </div>
        </div>
      </div>

      {/* Invoices Table Card */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[750px] w-full text-left">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="px-4 md:px-6 py-4">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    checked={selectedInvoices.length === paginatedInvoices.length && paginatedInvoices.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedInvoices(paginatedInvoices.map(i => i.id));
                      } else {
                        setSelectedInvoices([]);
                      }
                    }}
                  />
                </th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Invoice</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Learner / Parent</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Due Date</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingInvoices ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-bold text-gray-600">Loading {selectedTerm} invoices...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="max-w-md mx-auto flex flex-col items-center justify-center gap-3">
                      <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 border border-gray-100">
                        <FileText className="w-7 h-7" />
                      </div>
                      <h3 className="text-base font-bold text-gray-900">
                        {searchTerm ? 'No invoices match your search' : `No invoices found for ${selectedTerm}`}
                      </h3>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {searchTerm 
                          ? `No invoices match "${searchTerm}" in ${selectedTerm} (${selectedYear}). Try clearing the filter.`
                          : `Each academic term maintains its own separate invoice records. Currently, there are no invoices created for ${selectedTerm} in the ${selectedYear} academic year.`
                        }
                      </p>
                      {!searchTerm && (
                        <button
                          onClick={handleOpenCreateModal}
                          className="mt-2 px-5 py-2.5 bg-school-gradient text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-maroon/20 hover:scale-105 transition-all flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4 stroke-[3]" />
                          Create First {selectedTerm} Invoice
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((invoice) => {
                  const student = students.find(s => s.id === invoice.studentId);
                  const parent = parents.find(p => p.id === invoice.parentId);
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50/70 transition-colors group">
                      <td className="px-4 md:px-6 py-4">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                          checked={selectedInvoices.includes(invoice.id)}
                          onChange={() => toggleInvoiceSelection(invoice.id)}
                        />
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-school-gradient/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-gray-500">{new Date(invoice.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <p className="text-sm font-bold text-gray-900">
                          {student?.fullName || invoice.studentName || 'Learner'}
                        </p>
                        <p className="text-xs text-gray-500">
                          Adm: {student?.admissionNumber || invoice.admissionNumber || 'N/A'} • Parent: {parent?.fullName || 'N/A'}
                        </p>
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <p className="text-sm font-extrabold text-gray-900">
                          {school?.currency || 'KES'} {invoice.totalAmount.toLocaleString()}
                        </p>
                        <p className="text-xs text-rose-500 font-medium">
                          Bal: {school?.currency || 'KES'} {invoice.balanceDue.toLocaleString()}
                        </p>
                        <span className="inline-block mt-0.5 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                          {invoice.term || selectedTerm}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(invoice.status)}`}>
                          {invoice.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                          <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                          {new Date(invoice.dueDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setSelectedInvoice(invoice)}
                            className="p-2 text-gray-700 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors" 
                            title="View Preview"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleExportPDF(invoice)}
                            className="p-2 text-gray-700 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors" 
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleSendEmail(invoice)}
                            disabled={isSendingEmail}
                            className="p-2 text-gray-700 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors" 
                            title="Email Invoice to Parent"
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleEdit(invoice)}
                            className="p-2 text-gray-700 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors" 
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(invoice.id)}
                            className="p-2 text-gray-700 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" 
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {filteredInvoices.length > PAGE_SIZE && (
          <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50">
            <span className="text-xs font-bold text-gray-500">
              Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, filteredInvoices.length)} of {filteredInvoices.length} invoices
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white border border-gray-200 text-xs font-bold text-gray-700 rounded-xl hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <span className="text-xs font-black text-gray-700 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white border border-gray-200 text-xs font-bold text-gray-700 rounded-xl hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-[calc(100%-2rem)] md:w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-school-gradient/10 rounded-xl text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-gray-900">Invoice Preview</h2>
                  <p className="text-xs text-gray-500 font-bold">{selectedInvoice.term || selectedTerm} • {selectedInvoice.academicYear || selectedYear}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleExportPDF(selectedInvoice)}
                  className="p-2.5 hover:bg-gray-200 rounded-xl transition-colors text-primary flex items-center gap-1.5 font-bold text-xs"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
                <button 
                  onClick={() => window.print()}
                  className="p-2.5 hover:bg-gray-200 rounded-xl transition-colors text-gray-600 flex items-center gap-1.5 font-bold text-xs"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                <button 
                  onClick={() => setSelectedInvoice(null)} 
                  className="p-2.5 hover:bg-gray-200 rounded-xl transition-colors text-gray-400"
                >
                  <X className="h-5 w-5" />
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
                    <h1 className="text-xl md:text-3xl font-black tracking-tighter text-gray-900 uppercase break-words px-2 sm:px-0">{school?.name}</h1>
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
                  <p className="text-xs font-bold text-primary mt-1 uppercase tracking-wider">{selectedInvoice.term || selectedTerm} ({selectedInvoice.academicYear || selectedYear})</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-12 mb-8 md:mb-12">
                <div className="bg-gray-50 p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Bill To:</p>
                  <div className="space-y-1">
                    <p className="text-xl font-black text-gray-900">
                      {students.find(s => s.id === selectedInvoice.studentId)?.fullName || selectedInvoice.studentName}
                    </p>
                    <p className="text-sm font-bold text-gray-600">
                      Adm: {students.find(s => s.id === selectedInvoice.studentId)?.admissionNumber || selectedInvoice.admissionNumber}
                    </p>
                    <p className="text-sm font-medium text-gray-500 mt-2">
                      Parent: {parents.find(p => p.id === selectedInvoice.parentId)?.fullName || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="bg-gray-50 p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-gray-100 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Due Date:</span>
                    <span className="text-sm font-black text-red-600">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Academic Term:</span>
                    <span className="text-sm font-black text-gray-800">{selectedInvoice.term || selectedTerm}</span>
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
                      <th className="py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Amount ({school?.currency || 'KES'})</th>
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
                        {school?.currency || 'KES'} {selectedInvoice.totalAmount.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-sm font-bold text-gray-400 uppercase tracking-widest">Balance Due</td>
                      <td className="py-2 text-right text-lg font-black text-red-600">
                        {school?.currency || 'KES'} {selectedInvoice.balanceDue.toLocaleString()}
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

                <div className="absolute right-0 bottom-12 opacity-20 print:opacity-100 pointer-events-none">
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

      {/* Create / Edit Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-[calc(100%-2rem)] md:w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 bg-gray-50/50">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                  {editingInvoice ? 'Edit Invoice' : `Create Invoice (${selectedTerm})`}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-primary">{selectedYear} Academic Year</span>
                  <span className="text-gray-300">•</span>
                  <span className="text-xs font-bold text-gray-500">{selectedTerm}</span>
                </div>
              </div>
              <button 
                onClick={() => { setIsModalOpen(false); setEditingInvoice(null); reset(); }} 
                className="p-2 hover:bg-gray-200 rounded-xl transition-colors text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-4 md:p-8 space-y-6 max-h-[72vh] overflow-y-auto">
              {/* Learner Dropdown - ALWAYS populated and resilient */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Select Learner
                  </label>
                  <span className="text-xs font-bold text-primary">
                    {loadingStudents ? 'Loading learners...' : `${eligibleStudents.length} eligible learners`}
                  </span>
                </div>
                <select
                  {...register('studentId')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all bg-white font-medium"
                >
                  <option value="">Choose a learner...</option>
                  {eligibleStudents.length === 0 ? (
                    <option value="" disabled>No active learners found for {selectedYear}</option>
                  ) : (
                    eligibleStudents.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.admissionNumber || 'No Adm#'})
                      </option>
                    ))
                  )}
                </select>
                {errors.studentId && <p className="mt-1 text-xs text-red-500 font-bold">{errors.studentId.message}</p>}
              </div>

              {/* Fee Items Section */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Fee Items</h3>
                  <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setIsBulkModalOpen(true)}
                      className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      Bulk Add Fees
                    </button>
                    <button 
                      type="button"
                      onClick={() => setValue('items', [...items, { name: '', amount: 0 }])}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Item
                    </button>
                  </div>
                </div>

                {items.map((_, index) => (
                  <div key={index} className="grid grid-cols-12 gap-3 items-start">
                    <div className="col-span-7">
                      <select
                        value={feeTypes.find(f => f.name === items[index].name && f.amount === items[index].amount)?.id || ""}
                        onChange={(e) => handleFeeTypeChange(index, e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary outline-none bg-white text-sm font-bold text-gray-800"
                      >
                        <option value="">Select Predefined Fee Type...</option>
                        {feeTypes.map(f => (
                          <option key={f.id} value={f.id}>{f.name} ({school?.currency || 'KES'} {f.amount.toLocaleString()})</option>
                        ))}
                      </select>
                      <input
                        {...register(`items.${index}.name`)}
                        type="text"
                        placeholder="Or type custom fee description"
                        className="w-full px-3 py-1.5 mt-1.5 rounded-lg border border-gray-200 focus:border-primary outline-none text-xs text-gray-600"
                      />
                    </div>
                    <div className="col-span-4">
                      <input
                        {...register(`items.${index}.amount`, { valueAsNumber: true })}
                        type="number"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary outline-none text-sm font-bold"
                        placeholder="Amount"
                      />
                    </div>
                    <div className="col-span-1 pt-2.5">
                      {items.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => setValue('items', items.filter((__, i) => i !== index))}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Term & Due Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Academic Term</label>
                  <select
                    {...register('term')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all bg-white font-bold text-gray-800"
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
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none font-medium"
                  />
                  {errors.dueDate && <p className="mt-1 text-xs text-red-500 font-bold">{errors.dueDate.message}</p>}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notes / Billing Instructions (Optional)</label>
                <textarea
                  {...register('notes')}
                  rows={2}
                  placeholder="e.g. Please pay by bank deposit or M-Pesa paybill..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none text-sm text-gray-700"
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingInvoice(null); reset(); }}
                  className="flex-1 py-3.5 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 bg-school-gradient text-white font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingInvoice ? 'Update Invoice' : `Create ${selectedTerm} Invoice`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Add Fees Modal */}
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
                <p className="text-center text-gray-500 py-8 text-sm">No fee types found. Please configure fee types in settings.</p>
              ) : (
                feeTypes.map(fee => (
                  <button
                    key={fee.id}
                    type="button"
                    onClick={() => {
                      setSelectedBulkFees(prev => 
                        prev.includes(fee.id) 
                          ? prev.filter(id => id !== fee.id) 
                          : [...prev, fee.id]
                      );
                    }}
                    className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between group text-left ${
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
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{fee.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{fee.frequency}</p>
                      </div>
                    </div>
                    <p className="font-black text-primary text-sm">{school?.currency || 'KES'} {fee.amount.toLocaleString()}</p>
                  </button>
                ))
              )}
            </div>
            <div className="p-4 md:p-6 bg-gray-50 flex gap-3">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="flex-1 py-3 bg-white text-gray-600 font-bold rounded-xl border border-gray-200 hover:bg-gray-50 transition-all text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkAdd}
                disabled={selectedBulkFees.length === 0}
                className="flex-1 py-3 bg-school-gradient text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50 text-xs"
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

