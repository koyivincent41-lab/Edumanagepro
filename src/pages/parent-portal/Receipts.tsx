import React, { useState, useEffect } from 'react';
import ParentLayout from '../../components/ParentLayout';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../../types';
import { Loader2, Download, Printer, Eye, X } from 'lucide-react';

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
        
        if (parentsSnapshot.empty) {
          setLoading(false);
          return;
        }
        
        const parentId = parentsSnapshot.docs[0].id;

        const q = query(
          collection(db, 'schools', profile.schoolId!, 'payments'), 
          where('parentId', '==', parentId),
          where('status', '==', 'paid')
        );
        
        unsubReceipts = onSnapshot(q, (snap) => {
          setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

  const handleDownload = (receipt: any) => {
    const content = `
      RECEIPT: ${receipt.receiptNumber}
      School: ${school?.name || 'EduManagePro'}
      Student: ${receipt.studentName}
      Amount Paid: ${formatCurrency(receipt.amount)}
      Payment Method: ${receipt.paymentMethod}
      Reference: ${receipt.reference}
      Date: ${new Date(receipt.paymentDate).toLocaleDateString()}
    `;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_${receipt.receiptNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

      {/* Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:p-0 print:bg-white print:static">
          <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:w-full print:max-w-none">
            <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between print:hidden">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">Receipt Details</h2>
              <button onClick={() => setSelectedReceipt(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-10 space-y-8 print:p-0">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-4xl font-black text-primary mb-2">{school?.name || 'EduManagePro'}</h1>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{school?.address}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{school?.phone}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Receipt</h2>
                  <p className="text-gray-500 dark:text-gray-400 font-bold">#{selectedReceipt.receiptNumber}</p>
                  <p className="text-gray-400 text-xs mt-1">{new Date(selectedReceipt.paymentDate).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-10 py-8 border-y border-gray-100 dark:border-gray-800">
                <div>
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Received From</h3>
                  <p className="font-black text-gray-900 dark:text-white text-lg">{profile.fullName}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Parent of {selectedReceipt.studentName}</p>
                </div>
                <div className="text-right">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Payment Method</h3>
                  <p className="font-black text-gray-900 dark:text-white uppercase text-sm">{selectedReceipt.paymentMethod?.replace('_', ' ')}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Ref: {selectedReceipt.reference}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-4 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-widest">Amount Received</span>
                  <span className="text-4xl font-black text-green-600">{formatCurrency(selectedReceipt.amount)}</span>
                </div>
              </div>

              <div className="pt-10 flex gap-4 print:hidden">
                <button
                  onClick={handlePrint}
                  className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print Receipt
                </button>
                <button
                  onClick={() => handleDownload(selectedReceipt)}
                  className="flex-1 py-4 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
              </div>
              
              <div className="hidden print:block pt-20 text-center border-t border-dashed border-gray-300 mt-20">
                <p className="text-xs text-gray-400 uppercase tracking-widest font-black">This is a computer generated receipt</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </ParentLayout>
  );
}
