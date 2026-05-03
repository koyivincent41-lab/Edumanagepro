import React, { useState, useEffect } from 'react';
import ParentLayout from '../../components/ParentLayout';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../../types';
import { Loader2, Download, Printer, CheckCircle2, Eye, X } from 'lucide-react';
import { exportReceiptToPDF } from '../../lib/reportUtils';

export default function Receipts({ profile }: { profile: UserProfile }) {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [school, setSchool] = useState<any>(null);

  useEffect(() => {
    if (!profile || !profile.schoolId) return;

    let unsubReceipts: () => void;

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

        // Fetch all invoices for parent's children to resolve invoice numbers if missing
        const invoicesQuery = query(
          collection(db, 'schools', profile.schoolId!, 'invoices'),
          where('parentId', '==', parentId)
        );
        const invoicesSnap = await getDocs(invoicesQuery);
        const invoicesMap = new Map();
        invoicesSnap.forEach(doc => {
          invoicesMap.set(doc.id, doc.data().invoiceNumber);
        });

        const q = query(
          collection(db, 'schools', profile.schoolId!, 'payments'), 
          where('parentId', '==', parentId),
          where('status', '==', 'paid')
        );
        
        unsubReceipts = onSnapshot(q, (snap) => {
          setReceipts(snap.docs.map(d => {
            const data = d.data();
            const studentInfo = studentsMap.get(data.studentId) || {};
            return { 
              id: d.id, 
              ...data,
              studentName: data.studentName || studentInfo.fullName || 'N/A',
              admissionNumber: data.admissionNumber || studentInfo.admissionNumber || 'N/A',
              invoiceNumber: data.invoiceNumber || invoicesMap.get(data.invoiceId) || 'N/A'
            };
          }));
          setLoading(false);
        });
      } catch (error) {
        console.error("Error fetching receipts:", error);
        setLoading(false);
      }
    };

    setup();

    return () => {
      if (unsubReceipts) unsubReceipts();
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

  const handleDownload = async (receipt: any) => {
    try {
      const mockStudent = { fullName: receipt.studentName, admissionNumber: receipt.admissionNumber || 'N/A' } as any;
      const mockInvoice = { invoiceNumber: receipt.invoiceNumber || 'N/A' } as any;
      await exportReceiptToPDF(receipt, mockStudent, mockInvoice, school);
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  if (loading) return <ParentLayout profile={profile}><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></ParentLayout>;

  return (
    <ParentLayout profile={profile}>
      <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-8">Receipts</h1>
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="p-4 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-400">Receipt #</th>
              <th className="p-4 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-400">Student</th>
              <th className="p-4 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-400">Amount</th>
              <th className="p-4 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-400">Date</th>
              <th className="p-4 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-400">Status</th>
              <th className="p-4 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {receipts.map((receipt) => (
              <tr key={receipt.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="p-4 font-bold text-gray-900 dark:text-white">{receipt.receiptNumber || 'N/A'}</td>
                <td className="p-4 text-gray-600 dark:text-gray-400">{receipt.studentName || 'N/A'}</td>
                <td className="p-4 text-gray-600 dark:text-gray-400">{formatCurrency(receipt.amount || 0)}</td>
                <td className="p-4 text-gray-600 dark:text-gray-400">{new Date(receipt.paymentDate).toLocaleDateString()}</td>
                <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${receipt.status === 'paid' || receipt.status === 'Paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>{receipt.status}</span></td>
                <td className="p-4 flex gap-2">
                  <button 
                    onClick={() => setSelectedReceipt(receipt)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    title="View"
                  >
                    <Eye className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </button>
                  <button 
                    onClick={() => handleDownload(receipt)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    title="Download"
                  >
                    <Download className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedReceipt(receipt);
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
            {receipts.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500 dark:text-gray-400">No receipts found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Preview Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 print:hidden">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-school-gradient/10 rounded-xl text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Official Receipt</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleDownload(selectedReceipt)}
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
                  className="p-3 bg-gray-900 text-white hover:bg-gray-800 rounded-xl transition-colors flex items-center gap-2 font-bold text-sm shadow-md"
                >
                  <X className="h-5 w-5" />
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-12 bg-white print:p-0" id="printable-receipt">
              {/* Letterhead */}
              <div className="flex justify-between items-start mb-12 border-b-4 pb-8" style={{ borderColor: school?.primaryColor || '#800000' }}>
                <div className="flex items-center gap-6">
                  {school?.logo ? (
                    <img src={school.logo || undefined} alt="Logo" className="h-20 w-20 object-contain rounded-2xl shadow-sm" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-20 w-20 bg-school-gradient rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                      {school?.name?.charAt(0) || 'E'}
                    </div>
                  )}
                  <div>
                    <h1 className="text-2xl font-black tracking-tighter text-gray-900 uppercase">{school?.name || 'EduManagePro'}</h1>
                    <p className="text-primary font-bold italic text-sm">{school?.motto}</p>
                    <div className="mt-2 text-xs text-gray-500 space-y-0.5 font-medium">
                      <p>{school?.address}</p>
                      <p>Tel: {school?.phone} | Email: {school?.email}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block px-5 py-1.5 rounded-full text-white font-black text-[10px] uppercase tracking-widest mb-3" style={{ backgroundColor: school?.primaryColor || '#800000' }}>
                    Official Receipt
                  </div>
                  <p className="text-3xl font-black text-gray-900 tracking-tighter">{selectedReceipt.receiptNumber}</p>
                  <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Date: {new Date(selectedReceipt.paymentDate).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="bg-gray-50 p-8 rounded-[2rem] border border-gray-100 mb-12">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Received From:</p>
                    <div className="space-y-1">
                      <p className="text-lg font-black text-gray-900">{selectedReceipt.studentName}</p>
                      <p className="text-xs font-bold text-gray-600">Adm: {selectedReceipt.admissionNumber || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Payment Method:</p>
                    <p className="text-lg font-black text-gray-900 uppercase">{selectedReceipt.paymentMethod?.replace('_', ' ')}</p>
                    {selectedReceipt.reference && (
                      <p className="text-xs font-bold text-gray-500 mt-1">Ref: {selectedReceipt.reference}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-12">
                <div className="flex justify-between items-center py-6 border-y-2 border-gray-100">
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Payment For:</p>
                    <p className="text-lg font-bold text-gray-900">
                      Invoice {selectedReceipt.invoiceNumber || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Amount Paid:</p>
                    <p className="text-4xl font-black text-green-600">
                      {school?.currency || currency} {selectedReceipt.amount?.toLocaleString() || '0'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-12 border-t border-gray-100 relative">
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-400 italic">{school?.receiptFooter || 'Thank you for your payment.'}</p>
                  <div className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    For technical support, contact: support@{school?.email?.split('@')[1] || 'edumanagepro.com'}
                  </div>
                  <div className="mt-6 flex justify-center gap-8 text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">
                    <span>Official Receipt</span>
                    <span>•</span>
                    <span>{school?.name || 'EduManagePro'}</span>
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
                    <span className="text-[8px] font-black uppercase tracking-widest leading-none mb-1">{school?.name || 'EduManagePro'}</span>
                    <span className="text-xl font-black uppercase tracking-tighter leading-none">Approved</span>
                    <span className="text-[10px] font-bold my-1">{selectedReceipt.receiptNumber}</span>
                    <span className="text-[8px] font-bold">{new Date().toLocaleDateString()}</span>
                    <div className="absolute inset-0 rounded-full border border-dashed opacity-50 m-1" style={{ borderColor: school?.primaryColor || '#800000' }}></div>
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
