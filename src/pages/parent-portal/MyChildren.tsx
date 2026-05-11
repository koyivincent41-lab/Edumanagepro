import React, { useState, useEffect } from 'react';
import ParentLayout from '../../components/ParentLayout';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { UserProfile } from '../../types';
import { Loader2, FileText, Receipt, X, Eye, Download, Printer, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { exportInvoiceToPDF, exportReceiptToPDF } from '../../lib/reportUtils';

export default function MyChildren({ profile }: { profile: UserProfile }) {
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const [school, setSchool] = useState<any | null>(null);

  // Modal State
  const [activeModal, setActiveModal] = useState<'invoices' | 'receipts' | null>(null);
  const [selectedChild, setSelectedChild] = useState<any | null>(null);
  const [modalData, setModalData] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Preview Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [childInvoices, setChildInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (!profile || !profile.schoolId) return;

    const fetchData = async () => {
      try {
        // Fetch school
        const schoolDoc = await getDoc(doc(db, 'schools', profile.schoolId!));

        if (schoolDoc.exists()) {
          setSchool({ id: schoolDoc.id, ...schoolDoc.data() });
          if (schoolDoc.data().currency) {
            setCurrency(schoolDoc.data().currency);
          }
        }
        
        const parentsQuery = query(
          collection(db, 'schools', profile.schoolId!, 'parents'), 
          where('uid', '==', profile.uid)
        );
        const parentsSnapshot = await getDocs(parentsQuery);
        
        let parentId = '';
        if (!parentsSnapshot.empty) {
          parentId = parentsSnapshot.docs[0].id;
        } else {
          // Check if profile.uid is actually the parent document ID (from localStorage login)
          const parentDoc = await getDoc(doc(db, 'schools', profile.schoolId!, 'parents', profile.uid));
          if (parentDoc.exists()) {
            parentId = parentDoc.id;
          }
        }

        if (!parentId) {
          setLoading(false);
          return;
        }

        // Parallelize children, invoices, classes, and streams fetch
        const [childrenSnapshot, invoicesSnapshot, classesSnapshot, streamsSnapshot] = await Promise.all([
          getDocs(query(
            collection(db, 'schools', profile.schoolId!, 'students'), 
            where('parentId', '==', parentId)
          )),
          getDocs(query(
            collection(db, 'schools', profile.schoolId!, 'invoices'),
            where('parentId', '==', parentId)
          )),
          getDocs(collection(db, 'schools', profile.schoolId!, 'classes')),
          getDocs(collection(db, 'schools', profile.schoolId!, 'streams'))
        ]);
        
        const classesData = classesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const streamsData = streamsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

        const childrenData = childrenSnapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        const invoicesData = invoicesSnapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        } as any));

        const childrenWithInvoices = childrenData.map((child: any) => {
          const childInvoices = invoicesData.filter(inv => inv.studentId === child.id && inv.status !== 'cancelled');
          const balance = childInvoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
          
          childInvoices.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          const latestInvoice = childInvoices.length > 0 ? childInvoices[0] : null;
          
          let status = 'No Invoices';
          if (latestInvoice) {
            status = (latestInvoice.status === 'paid' || latestInvoice.status === 'Paid') ? 'Paid' : 'Not Paid';
          }

          const className = classesData.find((c: any) => c.id === child.classId)?.name || 'N/A';
          const streamName = streamsData.find((s: any) => s.id === child.streamId)?.name || 'N/A';

          return {
            ...child,
            arrears: balance,
            className,
            streamName,
            latestInvoiceStatus: status
          };
        });
        
        setChildren(childrenWithInvoices);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (['paid', 'confirmed', 'successful'].includes(s)) {
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    }
    if (['not paid', 'unpaid', 'overdue', 'failed', 'rejected'].includes(s)) {
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    }
    if (['awaiting_approval', 'pending'].includes(s)) {
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    }
    return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
  };

  const handleAction = async (action: string, item: any) => {
    if (action === 'print') {
      if (activeModal === 'invoices') {
        setSelectedInvoice(item);
      } else {
        setSelectedReceipt(item);
      }
      setTimeout(() => window.print(), 500);
    } else if (action === 'View') {
      if (activeModal === 'invoices') {
        setSelectedInvoice(item);
      } else {
        setSelectedReceipt(item);
      }
    } else if (action === 'Download') {
      try {
        if (activeModal === 'invoices') {
          await exportInvoiceToPDF(item, selectedChild, profile as any, school);
        } else {
          // Fetch invoice if needed for receipt
          let invoiceData = undefined;
          if (item.invoiceId) {
            const invDoc = await getDoc(doc(db, 'schools', profile.schoolId!, 'invoices', item.invoiceId));
            if (invDoc.exists()) invoiceData = { id: invDoc.id, ...invDoc.data() };
          }
          await exportReceiptToPDF(item, selectedChild, invoiceData as any, school);
        }
        toast.success('Downloaded successfully');
      } catch (error) {
        console.error('Download error:', error);
        toast.error('Failed to download');
      }
    }
  };

  const openInvoicesModal = async (child: any) => {
    setSelectedChild(child);
    setActiveModal('invoices');
    setModalLoading(true);
    try {
      const q = query(
        collection(db, 'schools', profile.schoolId!, 'invoices'),
        where('studentId', '==', child.id)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setModalData(data);
    } catch (error) {
      console.error("Error fetching child invoices:", error);
    } finally {
      setModalLoading(false);
    }
  };

  const openReceiptsModal = async (child: any) => {
    setSelectedChild(child);
    setActiveModal('receipts');
    setModalLoading(true);
    try {
      // Fetch payments
      const q = query(
        collection(db, 'schools', profile.schoolId!, 'payments'),
        where('studentId', '==', child.id)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      data.sort((a, b) => new Date(b.paymentDate || 0).getTime() - new Date(a.paymentDate || 0).getTime());
      setModalData(data);

      // Fetch invoices to resolve invoice numbers in receipts
      const invQ = query(
        collection(db, 'schools', profile.schoolId!, 'invoices'),
        where('studentId', '==', child.id)
      );
      const invSnap = await getDocs(invQ);
      setChildInvoices(invSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching child receipts:", error);
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) return <ParentLayout profile={profile}><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></ParentLayout>;

  return (
    <ParentLayout profile={profile}>
      <h1 className="print:hidden text-xl md:text-3xl font-black text-gray-900 dark:text-white mb-8">My Children</h1>
      <div className="print:hidden grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {children.map((child) => (
          <div key={child.id} className="bg-white dark:bg-gray-900 p-4 md:p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-4">{child.fullName}</h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
              <p><span className="font-bold">Admission:</span> {child.admissionNumber}</p>
              <p><span className="font-bold">Class:</span> {child.className}</p>
              <p><span className="font-bold">Stream:</span> {child.streamName}</p>
              <p><span className="font-bold">Current Fee Balance:</span> <span className="text-red-600 dark:text-red-400 font-bold">{formatCurrency(child.arrears || 0)}</span></p>
              <p className="flex items-center gap-2">
                <span className="font-bold">Latest Invoice Status:</span> 
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${child.latestInvoiceStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {child.latestInvoiceStatus}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => openInvoicesModal(child)} 
                className="flex-1 flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <FileText className="h-4 w-4" /> Invoices
              </button>
              <button 
                onClick={() => openReceiptsModal(child)} 
                className="flex-1 flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Receipt className="h-4 w-4" /> Receipts
              </button>
            </div>
          </div>
        ))}
        {children.length === 0 && (
          <div className="col-span-full p-4 md:p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800">
            No children linked to your account.
          </div>
        )}
      </div>

      {/* Modal Overlay */}
      {activeModal && (
        <div className="print:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-[calc(100%-2rem)] md:w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 bg-gray-50 dark:bg-gray-800/50">
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white">
                  {activeModal === 'invoices' ? 'Invoices' : 'Receipts'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  For {selectedChild?.fullName}
                </p>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 md:p-6 overflow-y-auto flex-1">
              {modalLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : modalData.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  No {activeModal} found for this child.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[700px] w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        {activeModal === 'invoices' ? (
                          <>
                            <th className="pb-3 font-bold text-gray-500 dark:text-gray-400 text-sm">Invoice #</th>
                            <th className="pb-3 font-bold text-gray-500 dark:text-gray-400 text-sm">Date</th>
                            <th className="pb-3 font-bold text-gray-500 dark:text-gray-400 text-sm">Amount</th>
                            <th className="pb-3 font-bold text-gray-500 dark:text-gray-400 text-sm">Status</th>
                            <th className="pb-3 font-bold text-gray-500 dark:text-gray-400 text-sm text-right">Actions</th>
                          </>
                        ) : (
                          <>
                            <th className="pb-3 font-bold text-gray-500 dark:text-gray-400 text-sm">Receipt #</th>
                            <th className="pb-3 font-bold text-gray-500 dark:text-gray-400 text-sm">Date</th>
                            <th className="pb-3 font-bold text-gray-500 dark:text-gray-400 text-sm">Amount</th>
                            <th className="pb-3 font-bold text-gray-500 dark:text-gray-400 text-sm">Status</th>
                            <th className="pb-3 font-bold text-gray-500 dark:text-gray-400 text-sm text-right">Actions</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {modalData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          {activeModal === 'invoices' ? (
                            <>
                              <td className="py-4 font-bold text-gray-900 dark:text-white">{item.invoiceNumber}</td>
                              <td className="py-4 text-gray-600 dark:text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</td>
                              <td className="py-4 font-bold text-gray-900 dark:text-white">{formatCurrency(item.amount || item.totalAmount || 0)}</td>
                              <td className="py-4">
                                <span className={`px-2 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold ${getStatusColor(item.status)}`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="py-4">
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => handleAction('View', item)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="View">
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => handleAction('Download', item)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Download">
                                    <Download className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => handleAction('print', item)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Print">
                                    <Printer className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-4 font-bold text-gray-900 dark:text-white">{item.receiptNumber || 'N/A'}</td>
                              <td className="py-4 text-gray-600 dark:text-gray-400">{new Date(item.paymentDate).toLocaleDateString()}</td>
                              <td className="py-4 font-bold text-gray-900 dark:text-white">{formatCurrency(item.amount || 0)}</td>
                              <td className="py-4">
                                <span className={`px-2 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold ${getStatusColor(item.status)}`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="py-4">
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => handleAction('View', item)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="View">
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => handleAction('Download', item)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Download">
                                    <Download className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => handleAction('print', item)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Print">
                                    <Printer className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Invoice Preview Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300 print:bg-transparent print:p-0 print:static print:block">
          <div className="bg-white dark:bg-gray-900 w-[calc(100%-2rem)] md:w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh] print:shadow-none print:max-h-none print:rounded-none">
            <div className="print:hidden p-4 md:p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 bg-gray-50/50 dark:bg-gray-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Invoice Preview</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleAction('Download', selectedInvoice)}
                  className="p-3 hover:bg-gray-200 rounded-xl transition-colors text-primary flex items-center gap-2 font-bold text-sm"
                >
                  <Download className="h-5 w-5" />
                  Download
                </button>
                <button 
                  onClick={() => window.print()}
                  className="p-3 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-600 dark:text-gray-300 flex items-center gap-2 font-bold text-sm"
                >
                  <Printer className="h-5 w-5" />
                  Print
                </button>
                <button 
                  onClick={() => setSelectedInvoice(null)} 
                  className="p-3 bg-gray-900 text-white hover:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors flex items-center gap-2 font-bold text-sm shadow-md"
                >
                  <X className="h-5 w-5" />
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 bg-white dark:bg-gray-900 print:p-0" id="printable-invoice">
              {/* Letterhead */}
              <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start mb-8 sm:mb-12 border-b-4 pb-6 sm:pb-8 gap-6 sm:gap-0" style={{ borderColor: school?.primaryColor || '#800000' }}>
                <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6">
                  {school?.logo ? (
                    <img src={school.logo || undefined} alt="Logo" className="h-16 w-16 md:h-24 md:w-24 object-contain rounded-2xl shadow-sm shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-16 w-16 md:h-24 md:w-24 bg-primary rounded-2xl flex items-center justify-center text-white font-bold text-2xl md:text-4xl shadow-lg shrink-0">
                      {school?.name?.charAt(0) || 'S'}
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl md:text-3xl font-black tracking-tighter text-gray-900 dark:text-white uppercase break-words px-2 sm:px-0">{school?.name || 'School Name'}</h1>
                    <p className="text-primary font-bold italic text-lg">{school?.motto}</p>
                    <div className="mt-2 md:mt-3 text-xs md:text-sm text-gray-500 dark:text-gray-400 space-y-0.5 font-medium break-words px-2 sm:px-0">
                      <p>{school?.address}</p>
                      <p className="break-words">Tel: {school?.phone} | Email: {school?.email}</p>
                    </div>
                  </div>
                </div>
                <div className="text-center sm:text-right w-full sm:w-auto mt-4 sm:mt-0">
                  <div className="inline-block px-4 md:px-6 py-2 rounded-full text-white font-black text-sm uppercase tracking-widest mb-4" style={{ backgroundColor: school?.primaryColor || '#800000' }}>
                    Invoice
                  </div>
                  <p className="text-2xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tighter">{selectedInvoice.invoiceNumber}</p>
                  <p className="text-sm font-bold text-gray-400 mt-1 uppercase tracking-widest">Date: {new Date(selectedInvoice.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-12 mb-8 md:mb-12">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 md:p-8 rounded-[2rem] border border-gray-100 dark:border-gray-700">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Bill To:</p>
                  <div className="space-y-1">
                    <p className="text-xl font-black text-gray-900 dark:text-white">{selectedChild?.fullName}</p>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400">Adm: {selectedChild?.admissionNumber}</p>
                    <p className="text-sm font-medium text-gray-500 mt-2">Parent: {profile?.fullName}</p>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 md:p-8 rounded-[2rem] border border-gray-100 dark:border-gray-700 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Due Date:</span>
                    <span className="text-sm font-black text-red-600 dark:text-red-400">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</span>
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
                    <tr className="border-b-2 border-gray-100 dark:border-gray-800">
                      <th className="py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Description</th>
                      <th className="py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Amount ({currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {selectedInvoice.items?.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="py-5 text-sm font-bold text-gray-700 dark:text-gray-300">{item.name}</td>
                        <td className="py-5 text-right text-sm font-black text-gray-900 dark:text-white">{item.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-900 dark:border-gray-700">
                      <td className="py-4 md:py-6 text-sm md:text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">Total Amount</td>
                      <td className="py-4 md:py-6 text-right text-lg md:text-2xl font-black text-gray-900 dark:text-white" style={{ color: school?.primaryColor || '#800000' }}>
                        {currency} {selectedInvoice.totalAmount.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-sm font-bold text-gray-400 uppercase tracking-widest">Balance Due</td>
                      <td className="py-2 text-right text-lg font-black text-red-600 dark:text-red-400">
                        {currency} {selectedInvoice.balanceDue.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedInvoice.notes && (
                <div className="mb-12 p-4 md:p-6 bg-yellow-50/50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-100 dark:border-yellow-900/50">
                  <p className="text-[10px] font-black text-yellow-700 dark:text-yellow-500 uppercase tracking-widest mb-2">Notes:</p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-400 font-medium italic">{selectedInvoice.notes}</p>
                </div>
              )}

              <div className="mt-auto pt-12 border-t border-gray-100 dark:border-gray-800 relative">
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-400 italic">{school?.invoiceFooter || 'Thank you for your continued support.'}</p>
                  <div className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    For technical support, contact: support@edumanagepro.com
                  </div>
                  <div className="mt-6 flex justify-center gap-4 md:gap-8 text-[10px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-[0.3em]">
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
                    style={{ borderColor: school?.primaryColor || '#800000', color: school?.primaryColor || '#800000' }}
                  >
                    <span className="text-[8px] font-black uppercase tracking-widest leading-none mb-1">{school?.name}</span>
                    <span className="text-xl font-black uppercase tracking-tighter leading-none">Approved</span>
                    <span className="text-[10px] font-bold my-1">{selectedInvoice.invoiceNumber}</span>
                    <span className="text-[8px] font-bold">{new Date().toLocaleDateString()}</span>
                    <div className="absolute inset-0 rounded-full border border-dashed opacity-50 m-1" style={{ borderColor: school?.primaryColor || '#800000' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300 print:bg-transparent print:p-0 print:static print:block">
          <div className="bg-white dark:bg-gray-900 w-[calc(100%-2rem)] md:w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh] print:shadow-none print:max-h-none print:rounded-none">
            <div className="print:hidden p-4 md:p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 bg-gray-50/50 dark:bg-gray-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Official Receipt</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleAction('Download', selectedReceipt)}
                  className="p-3 hover:bg-gray-200 rounded-xl transition-colors text-primary flex items-center gap-2 font-bold text-sm"
                >
                  <Download className="h-5 w-5" />
                  Download
                </button>
                <button 
                  onClick={() => window.print()}
                  className="p-3 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-600 dark:text-gray-300 flex items-center gap-2 font-bold text-sm"
                >
                  <Printer className="h-5 w-5" />
                  Print
                </button>
                <button 
                  onClick={() => setSelectedReceipt(null)} 
                  className="p-3 bg-gray-900 text-white hover:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors flex items-center gap-2 font-bold text-sm shadow-md"
                >
                  <X className="h-5 w-5" />
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 bg-white dark:bg-gray-900 print:p-0" id="printable-receipt">
              {/* Letterhead */}
              <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start mb-8 sm:mb-12 border-b-4 pb-6 sm:pb-8 gap-6 sm:gap-0" style={{ borderColor: school?.primaryColor || '#800000' }}>
                <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6">
                  {school?.logo ? (
                    <img src={school.logo || undefined} alt="Logo" className="h-20 w-20 object-contain rounded-2xl shadow-sm" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-20 w-20 bg-primary rounded-2xl flex items-center justify-center text-white font-bold text-xl md:text-3xl shadow-lg">
                      {school?.name?.charAt(0) || 'S'}
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl md:text-2xl font-black tracking-tighter text-gray-900 dark:text-white uppercase">{school?.name || 'School Name'}</h1>
                    <p className="text-primary font-bold italic text-sm">{school?.motto}</p>
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5 font-medium">
                      <p>{school?.address}</p>
                      <p className="break-words">Tel: {school?.phone} | Email: {school?.email}</p>
                    </div>
                  </div>
                </div>
                <div className="text-center sm:text-right w-full sm:w-auto mt-4 sm:mt-0">
                  <div className="inline-block px-5 py-1.5 rounded-full text-white font-black text-[10px] uppercase tracking-widest mb-3" style={{ backgroundColor: school?.primaryColor || '#800000' }}>
                    Official Receipt
                  </div>
                  <p className="text-xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tighter">{selectedReceipt.receiptNumber}</p>
                  <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Date: {new Date(selectedReceipt.paymentDate).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 md:p-8 rounded-[2rem] border border-gray-100 dark:border-gray-700 mb-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Received From:</p>
                    <div className="space-y-1">
                      <p className="text-lg font-black text-gray-900 dark:text-white">{selectedChild?.fullName}</p>
                      <p className="text-xs font-bold text-gray-600 dark:text-gray-400">Adm: {selectedChild?.admissionNumber}</p>
                    </div>
                  </div>
                  <div className="text-center sm:text-right w-full sm:w-auto mt-4 sm:mt-0">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Payment Method:</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white uppercase">{selectedReceipt.paymentMethod.replace('_', ' ')}</p>
                    {selectedReceipt.reference && (
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">Ref: {selectedReceipt.reference}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-8 md:mb-12 overflow-x-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center sm:items-center py-6 border-y-2 border-gray-100 dark:border-gray-800 gap-4 sm:gap-0">
                  <div className="text-center sm:text-left">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Payment For:</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {selectedReceipt.invoiceId ? (
                        `Invoice ${childInvoices.find(i => i.id === selectedReceipt.invoiceId)?.invoiceNumber || 'N/A'}`
                      ) : (
                        'School Fees'
                      )}
                    </p>
                  </div>
                  <div className="text-center sm:text-right">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Amount Paid:</p>
                    <p className="text-3xl md:text-4xl font-black text-green-600 dark:text-green-400">
                      {currency} {selectedReceipt.amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-12 border-t border-gray-100 dark:border-gray-800 relative">
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-400 italic">{school?.receiptFooter || 'Thank you for your payment.'}</p>
                  <div className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    For technical support, contact: support@edumanagepro.com
                  </div>
                  <div className="mt-6 flex justify-center gap-4 md:gap-8 text-[10px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-[0.3em]">
                    <span>Official Receipt</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ParentLayout>
  );
}
