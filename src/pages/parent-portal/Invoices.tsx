import React, { useState, useEffect } from 'react';
import ParentLayout from '../../components/ParentLayout';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../../types';
import { Loader2, Download, Printer, FileText, Eye, X } from 'lucide-react';
import { exportInvoiceToPDF } from '../../lib/reportUtils';

export default function Invoices({ profile }: { profile: UserProfile }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [school, setSchool] = useState<any>(null);

  useEffect(() => {
    if (!profile || !profile.schoolId) return;

    let unsubInvoices: () => void;

    const setup = async () => {
      try {
        const schoolDoc = await getDoc(doc(db, 'schools', profile.schoolId!));
        const schoolData = schoolDoc.data();
        setSchool(schoolData);
        if (schoolData?.currency) {
          setCurrency(schoolData.currency);
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

        // Fetch students directly linked to this parent to get admission numbers and names
        const studentsQuery = query(
          collection(db, 'schools', profile.schoolId!, 'students'),
          where('parentId', '==', parentId)
        );
        const studentsSnap = await getDocs(studentsQuery);
        const studentsMap = new Map();
        studentsSnap.forEach(doc => {
          const studentData = doc.data();
          studentsMap.set(doc.id, {
            admissionNumber: studentData.admissionNumber || 'N/A',
            fullName: studentData.fullName || 'N/A'
          });
        });

        const q = query(
          collection(db, 'schools', profile.schoolId!, 'invoices'), 
          where('parentId', '==', parentId)
        );
        
        unsubInvoices = onSnapshot(q, (snap) => {
          setInvoices(snap.docs.map(d => {
            const data = d.data();
            const studentInfo = studentsMap.get(data.studentId) || {};
            return { 
              id: d.id, 
              ...data,
              studentName: data.studentName || studentInfo.fullName || 'N/A',
              admissionNumber: data.admissionNumber || studentInfo.admissionNumber || 'N/A'
            };
          }));
          setLoading(false);
        });
      } catch (error) {
        console.error("Error fetching invoices:", error);
        setLoading(false);
      }
    };

    setup();

    return () => {
      if (unsubInvoices) unsubInvoices();
    };
  }, [profile]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async (invoice: any) => {
    try {
      const mockStudent = { fullName: invoice.studentName, admissionNumber: invoice.admissionNumber || 'N/A' } as any;
      const mockParent = { fullName: profile.fullName } as any;
      await exportInvoiceToPDF(invoice, mockStudent, mockParent, school);
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  if (loading) return <ParentLayout profile={profile}><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></ParentLayout>;

  return (
    <ParentLayout profile={profile}>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-xl md:text-3xl font-black text-gray-900 dark:text-white">Invoices</h1>
      </div>
      
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="p-4 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-400">Invoice #</th>
              <th className="p-4 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-400">Student</th>
              <th className="p-4 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-400">Amount</th>
              <th className="p-4 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-400">Balance</th>
              <th className="p-4 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-400">Status</th>
              <th className="p-4 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="p-4 font-bold text-gray-900 dark:text-white">{invoice.invoiceNumber}</td>
                <td className="p-4 text-gray-600 dark:text-gray-400">{invoice.studentName || 'N/A'}</td>
                <td className="p-4 text-gray-600 dark:text-gray-400">{formatCurrency(invoice.totalAmount || invoice.amount || 0)}</td>
                <td className="p-4 font-bold text-red-600 dark:text-red-400">{formatCurrency(invoice.balanceDue || 0)}</td>
                <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${invoice.status === 'paid' || invoice.status === 'Paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>{invoice.status}</span></td>
                <td className="p-4 flex gap-2">
                  <button 
                    onClick={() => setSelectedInvoice(invoice)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    title="View"
                  >
                    <Eye className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </button>
                  <button 
                    onClick={() => handleDownload(invoice)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    title="Download"
                  >
                    <Download className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedInvoice(invoice);
                      setTimeout(handlePrint, 100);
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    title="Print"
                  >
                    <Printer className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 md:p-8 text-center text-gray-500 dark:text-gray-400">No invoices found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Preview Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-[calc(100%-2rem)] md:w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 bg-gray-50/50 print:hidden">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-school-gradient/10 rounded-xl text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Invoice Preview</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleDownload(selectedInvoice)}
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
                  className="p-3 bg-gray-900 text-white hover:bg-gray-800 rounded-xl transition-colors flex items-center gap-2 font-bold text-sm shadow-md"
                >
                  <X className="h-5 w-5" />
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 bg-white print:p-0" id="printable-invoice">
              {/* Letterhead */}
              <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start mb-8 sm:mb-12 border-b-4 pb-6 sm:pb-8 gap-6 sm:gap-0" style={{ borderColor: school?.primaryColor || '#800000' }}>
                <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6">
                  {school?.logo ? (
                    <img src={school.logo || undefined} alt="Logo" className="h-16 w-16 md:h-24 md:w-24 object-contain rounded-2xl shadow-sm shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-16 w-16 md:h-24 md:w-24 bg-primary rounded-2xl flex items-center justify-center text-white font-bold text-2xl md:text-4xl shadow-lg shrink-0">
                      {school?.name?.charAt(0) || 'E'}
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl md:text-3xl font-black tracking-tighter text-gray-900 dark:text-white uppercase break-words px-2 sm:px-0">{school?.name || 'EduManagePro'}</h1>
                    <p className="text-primary font-bold italic text-lg">{school?.motto}</p>
                    <div className="mt-2 md:mt-3 text-xs md:text-sm text-gray-500 space-y-0.5 font-medium break-words px-2 sm:px-0">
                      <p>{school?.address}</p>
                      <p className="break-words">Tel: {school?.phone} | Email: {school?.email}</p>
                    </div>
                  </div>
                </div>
                <div className="text-center sm:text-right w-full sm:w-auto mt-4 sm:mt-0">
                  <div className="inline-block px-4 md:px-6 py-2 rounded-full text-white font-black text-sm uppercase tracking-widest mb-4" style={{ backgroundColor: school?.primaryColor || '#800000' }}>
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
                    <p className="text-xl font-black text-gray-900">{selectedInvoice.studentName}</p>
                    <p className="text-sm font-bold text-gray-600">Adm: {selectedInvoice.admissionNumber || 'N/A'}</p>
                    <p className="text-sm font-medium text-gray-500 mt-2">Parent: {profile.fullName}</p>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-gray-100 dark:border-gray-800 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Due Date:</span>
                    <span className="text-sm font-black text-red-600">{selectedInvoice.dueDate ? new Date(selectedInvoice.dueDate).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Status:</span>
                    <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${selectedInvoice.status === 'paid' || selectedInvoice.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
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
                      <th className="py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Amount ({school?.currency || currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {selectedInvoice.items?.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="py-5 text-sm font-bold text-gray-700">{item.name}</td>
                        <td className="py-5 text-right text-sm font-black text-gray-900">{item.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-900">
                      <td className="py-4 md:py-6 text-sm md:text-lg font-black text-gray-900 uppercase tracking-tighter">Total Amount</td>
                      <td className="py-4 md:py-6 text-right text-lg md:text-2xl font-black text-gray-900" style={{ color: school?.primaryColor || '#800000' }}>
                        {school?.currency || currency} {selectedInvoice.totalAmount?.toLocaleString() || selectedInvoice.amount?.toLocaleString() || '0'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-sm font-bold text-gray-400 uppercase tracking-widest">Balance Due</td>
                      <td className="py-2 text-right text-lg font-black text-red-600">
                        {school?.currency || currency} {selectedInvoice.balanceDue?.toLocaleString() || '0'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedInvoice.notes && (
                <div className="mb-12 p-4 md:p-6 bg-yellow-50/50 rounded-2xl border border-yellow-100">
                  <p className="text-[10px] font-black text-yellow-700 uppercase tracking-widest mb-2">Notes:</p>
                  <p className="text-yellow-900 text-sm font-medium">{selectedInvoice.notes}</p>
                </div>
              )}

              <div className="mt-16 text-center text-gray-400 text-xs font-bold uppercase tracking-widest print:mt-auto">
                <p>{school?.invoiceFooter || 'Thank you for your continued support.'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </ParentLayout>
  );
}
