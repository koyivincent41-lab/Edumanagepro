import React, { useState, useEffect } from 'react';
import ParentLayout from '../../components/ParentLayout';
import { db } from '../../firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../../types';
import { Loader2, Eye, Download, Printer, X, CheckCircle2 } from 'lucide-react';
import { exportReceiptToPDF } from '../../lib/reportUtils';
import { toast } from 'sonner';

export default function PaymentHistory({ profile }: { profile: UserProfile }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const [school, setSchool] = useState<any>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [childInvoices, setChildInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (!profile || !profile.schoolId) return;

    let unsubPayments: () => void;

    const setup = async () => {
      try {
        // Fetch school data
        const schoolDoc = await getDoc(doc(db, 'schools', profile.schoolId!));
        const schoolData = schoolDoc.data();
        setSchool(schoolData);
        if (schoolData?.currency) {
          setCurrency(schoolData.currency);
        }

        // Find the parent document
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

        // Fetch all invoices for the parent's children to resolve invoice numbers
        const invoicesQuery = query(
          collection(db, 'schools', profile.schoolId!, 'invoices'),
          where('parentId', '==', parentId)
        );
        const invoicesSnapshot = await getDocs(invoicesQuery);
        setChildInvoices(invoicesSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));

        // Listen for payments
        const q = query(
          collection(db, 'schools', profile.schoolId!, 'payments'), 
          where('parentId', '==', parentId),
          orderBy('paymentDate', 'desc')
        );
        
        unsubPayments = onSnapshot(q, (snap) => {
          setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        });
      } catch (error) {
        console.error("Error setting up payment history:", error);
        setLoading(false);
      }
    };

    setup();

    return () => {
      if (unsubPayments) unsubPayments();
    };
  }, [profile]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const handleDownload = async (payment: any) => {
    try {
      const invoice = childInvoices.find(inv => inv.id === payment.invoiceId);
      // We need a student object for the PDF export
      const student = {
        fullName: payment.studentName,
        admissionNumber: payment.admissionNumber || 'N/A'
      };
      await exportReceiptToPDF(payment, student as any, invoice, school);
      toast.success('Receipt downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download receipt');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <ParentLayout profile={profile}><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></ParentLayout>;

  return (
    <ParentLayout profile={profile}>
      <div className="flex items-center justify-between mb-8 print:hidden">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Payment History Report</h1>
        <div className="text-sm text-gray-500 font-bold uppercase tracking-widest">
          Total Collected: <span className="text-green-600 ml-2">{formatCurrency(payments.filter(p => p.status === 'paid' || p.status === 'Confirmed').reduce((sum, p) => sum + (p.amount || 0), 0))}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden print:shadow-none print:border-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-4 text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-widest">Receipt #</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-widest">Child Name</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-widest">Date</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-widest">Amount</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-widest">Method</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-widest">Status</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-widest text-right print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="p-4 font-bold text-gray-900 dark:text-white">{payment.receiptNumber || 'N/A'}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-400 font-medium">{payment.studentName || 'N/A'}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-400">{new Date(payment.paymentDate).toLocaleDateString()}</td>
                  <td className="p-4 font-black text-gray-900 dark:text-white">{formatCurrency(payment.amount || 0)}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-400 uppercase text-[10px] font-black tracking-widest">{payment.paymentMethod?.replace('_', ' ')}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      (payment.status === 'paid' || payment.status === 'Confirmed') 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="p-4 text-right print:hidden">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setSelectedReceipt(payment)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-primary"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDownload(payment)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-primary"
                        title="Download Receipt"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedReceipt(payment);
                          setTimeout(handlePrint, 100);
                        }}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-primary"
                        title="Print Receipt"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500 dark:text-gray-400 font-medium">
                    No payment records found for your children.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:p-0 print:bg-white print:static">
          <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:w-full print:max-w-none animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">Official Receipt</h2>
              </div>
              <button onClick={() => setSelectedReceipt(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <X className="h-6 w-6 text-gray-400" />
              </button>
            </div>
            <div className="p-10 space-y-8 print:p-0">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-black text-primary mb-2 uppercase tracking-tighter">{school?.name || 'EduManagePro'}</h1>
                  <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">{school?.address}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">{school?.phone}</p>
                </div>
                <div className="text-right">
                  <div className="inline-block px-4 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full mb-3">Receipt</div>
                  <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">#{selectedReceipt.receiptNumber}</p>
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">{new Date(selectedReceipt.paymentDate).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-10 py-8 border-y border-gray-100 dark:border-gray-800">
                <div>
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Received From</h3>
                  <p className="font-black text-gray-900 dark:text-white text-lg">{profile.fullName}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Parent of {selectedReceipt.studentName}</p>
                </div>
                <div className="text-right">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Payment Method</h3>
                  <p className="font-black text-gray-900 dark:text-white uppercase text-sm tracking-widest">{selectedReceipt.paymentMethod?.replace('_', ' ')}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Ref: {selectedReceipt.reference || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-6 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">Amount Received</span>
                  <span className="text-4xl font-black text-green-600 tracking-tighter">{formatCurrency(selectedReceipt.amount)}</span>
                </div>
              </div>

              <div className="pt-10 flex gap-4 print:hidden">
                <button
                  onClick={handlePrint}
                  className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print Receipt
                </button>
                <button
                  onClick={() => handleDownload(selectedReceipt)}
                  className="flex-1 py-4 bg-primary text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
              </div>
              
              <div className="hidden print:block pt-20 text-center border-t border-dashed border-gray-300 mt-20">
                <p className="text-[10px] text-gray-400 uppercase tracking-[0.3em] font-black">This is a computer generated receipt • {school?.name}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </ParentLayout>
  );
}
