import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Receipt as ReceiptIcon, 
  Download, 
  Printer, 
  MoreVertical, 
  Loader2,
  Calendar,
  User,
  FileText,
  X,
  CheckCircle2
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Payment, Student, Invoice, School } from '../../types';
import { toast } from 'sonner';
import { useBranch } from '../../context/BranchContext';

import { exportReceiptToPDF } from '../../lib/reportUtils';

export default function Receipts({ schoolId, school }: { schoolId: string; school: School | null }) {
  const { currentBranch } = useBranch();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null);
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);

  const primaryColor = school?.primaryColor || '#800000';

  const handleExportPDF = async (payment: Payment) => {
    const student = students.find(s => s.id === payment.studentId);
    const invoice = invoices.find(i => i.id === payment.invoiceId);
    await exportReceiptToPDF(payment, student, invoice, school);
  };

  const handleBulkPrint = async () => {
    if (selectedReceipts.length === 0) {
      toast.error('Please select receipts to print');
      return;
    }
    
    toast.info(`Generating ${selectedReceipts.length} receipts...`);
    
    for (const id of selectedReceipts) {
      const payment = payments.find(p => p.id === id);
      if (payment) {
        await handleExportPDF(payment);
      }
    }
    
    toast.success('All receipts exported successfully');
  };

  const toggleReceiptSelection = (id: string) => {
    setSelectedReceipts(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredPayments = payments.filter(p => {
    const student = students.find(s => s.id === p.studentId);
    const invoice = invoices.find(i => i.id === p.invoiceId);
    const search = searchTerm.toLowerCase();
    return (
      p.receiptNumber.toLowerCase().includes(search) ||
      student?.fullName.toLowerCase().includes(search) ||
      student?.admissionNumber.toLowerCase().includes(search) ||
      invoice?.invoiceNumber.toLowerCase().includes(search)
    );
  });

  useEffect(() => {
    if (!schoolId) return;
    
    let paymentsQuery = query(
      collection(db, 'schools', schoolId, 'payments'),
      where('academicYear', '==', school?.academicYear || '')
    );
    if (currentBranch) paymentsQuery = query(paymentsQuery, where('branchId', '==', currentBranch.id));

    const unsubPayments = onSnapshot(
      paymentsQuery, 
      (snap) => {
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
        setLoading(false);
      }
    );

    let studentsQuery = query(
      collection(db, 'schools', schoolId, 'students'),
      where('academicYear', '==', school?.academicYear || '')
    );
    if (currentBranch) studentsQuery = query(studentsQuery, where('branchId', '==', currentBranch.id));

    const unsubStudents = onSnapshot(
      studentsQuery, 
      (snap) => {
        setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
      }
    );

    let invoicesQuery = query(
      collection(db, 'schools', schoolId, 'invoices'),
      where('academicYear', '==', school?.academicYear || '')
    );
    if (currentBranch) invoicesQuery = query(invoicesQuery, where('branchId', '==', currentBranch.id));

    const unsubInvoices = onSnapshot(
      invoicesQuery, 
      (snap) => {
        setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
      }
    );

    return () => {
      unsubPayments();
      unsubStudents();
      unsubInvoices();
    };
  }, [schoolId, school?.academicYear, currentBranch]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-4 md:p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white">Payment Receipts</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">View and print official payment receipts.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                type="text"
                placeholder="Search receipts..."
                className="pl-10 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder:text-white/40 focus:bg-white/20 outline-none w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={handleBulkPrint}
              disabled={selectedReceipts.length === 0}
              className="px-4 md:px-6 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-white/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              Bulk Print ({selectedReceipts.length})
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
                    checked={selectedReceipts.length === filteredPayments.length && filteredPayments.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedReceipts(filteredPayments.map(p => p.id));
                      } else {
                        setSelectedReceipts([]);
                      }
                    }}
                  />
                </th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Receipt #</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Student</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Invoice #</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Amount Paid</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPayments.map((payment) => {
                const student = students.find(s => s.id === payment.studentId);
                const invoice = invoices.find(i => i.id === payment.invoiceId);
                return (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 md:px-6 py-4">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                        checked={selectedReceipts.includes(payment.id)}
                        onChange={() => toggleReceiptSelection(payment.id)}
                      />
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-school-gradient/10 rounded-xl flex items-center justify-center text-green-600">
                          <ReceiptIcon className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-bold text-gray-900">{payment.receiptNumber}</p>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <p className="text-sm font-bold text-gray-900">{student?.fullName || 'N/A'}</p>
                      <p className="text-xs text-gray-500">{student?.admissionNumber}</p>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <p className="text-sm text-gray-600 font-medium">{invoice?.invoiceNumber || 'N/A'}</p>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <p className="text-sm font-extrabold text-green-600">{school?.currency} {payment.amount.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">{payment.paymentMethod.replace('_', ' ')}</p>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setSelectedReceipt(payment)}
                          className="p-2 text-black hover:bg-gray-200 rounded-lg transition-colors" 
                          title="View Receipt"
                        >
                          <ReceiptIcon className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => handleExportPDF(payment)}
                          className="p-2 text-black hover:bg-gray-200 rounded-lg transition-colors" 
                          title="Download Receipt"
                        >
                          <Download className="h-5 w-5" />
                        </button>
                        <button className="p-2 text-black hover:bg-gray-200 rounded-lg transition-colors" title="Print Receipt">
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

      {/* Preview Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-[calc(100%-2rem)] md:w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-school-gradient/10 rounded-xl text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Official Receipt</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleExportPDF(selectedReceipt)}
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
                  onClick={() => setSelectedReceipt(null)} 
                  className="p-3 hover:bg-gray-200 rounded-xl transition-colors text-gray-400"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 bg-white print:p-0" id="printable-receipt">
              {/* Letterhead */}
              <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start mb-8 sm:mb-12 border-b-4 pb-6 sm:pb-8 gap-6 sm:gap-0" style={{ borderColor: primaryColor }}>
                <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6">
                  {school?.logo ? (
                    <img src={school.logo || undefined} alt="Logo" className="h-20 w-20 object-contain rounded-2xl shadow-sm" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-20 w-20 bg-school-gradient rounded-2xl flex items-center justify-center text-white font-bold text-xl md:text-3xl shadow-lg">
                      {school?.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl md:text-2xl font-black tracking-tighter text-gray-900 uppercase">{school?.name}</h1>
                    <p className="text-primary font-bold italic text-sm">{school?.motto}</p>
                    <div className="mt-2 text-xs text-gray-500 space-y-0.5 font-medium">
                      <p>{school?.address}</p>
                      <p className="break-words">Tel: {school?.phone} | Email: {school?.email}</p>
                    </div>
                  </div>
                </div>
                <div className="text-center sm:text-right w-full sm:w-auto mt-4 sm:mt-0">
                  <div className="inline-block px-5 py-1.5 rounded-full text-white font-black text-[10px] uppercase tracking-widest mb-3" style={{ backgroundColor: primaryColor }}>
                    Official Receipt
                  </div>
                  <p className="text-xl md:text-3xl font-black text-gray-900 tracking-tighter">{selectedReceipt.receiptNumber}</p>
                  <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Date: {new Date(selectedReceipt.paymentDate).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 md:p-8 rounded-[2rem] border border-gray-100 mb-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Received From:</p>
                    <div className="space-y-1">
                      <p className="text-lg font-black text-gray-900">{students.find(s => s.id === selectedReceipt.studentId)?.fullName}</p>
                      <p className="text-xs font-bold text-gray-600">Adm: {students.find(s => s.id === selectedReceipt.studentId)?.admissionNumber}</p>
                    </div>
                  </div>
                  <div className="text-center sm:text-right w-full sm:w-auto mt-4 sm:mt-0">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Payment Method:</p>
                    <p className="text-lg font-black text-gray-900 uppercase">{selectedReceipt.paymentMethod.replace('_', ' ')}</p>
                    {selectedReceipt.reference && (
                      <p className="text-xs font-bold text-gray-500 mt-1">Ref: {selectedReceipt.reference}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-8 md:mb-12 overflow-x-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center sm:items-center py-6 border-y-2 border-gray-100 gap-4 sm:gap-0">
                  <div className="text-center sm:text-left">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Payment For:</p>
                    <p className="text-lg font-bold text-gray-900">
                      Invoice {invoices.find(i => i.id === selectedReceipt.invoiceId)?.invoiceNumber || 'N/A'}
                    </p>
                  </div>
                  <div className="text-center sm:text-right">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Amount Paid:</p>
                    <p className="text-3xl md:text-4xl font-black text-green-600">
                      {school?.currency} {selectedReceipt.amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-12 border-t border-gray-100 relative">
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-400 italic">{school?.receiptFooter || 'Thank you for your payment.'}</p>
                  <div className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    For technical support, contact: support@edumanagepro.com
                  </div>
                  <div className="mt-6 flex justify-center gap-4 md:gap-8 text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">
                    <span>Official Receipt</span>
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
                    <span className="text-[10px] font-bold my-1">{selectedReceipt.receiptNumber}</span>
                    <span className="text-[8px] font-bold">{new Date().toLocaleDateString()}</span>
                    <div className="absolute inset-0 rounded-full border border-dashed opacity-50 m-1" style={{ borderColor: primaryColor }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
