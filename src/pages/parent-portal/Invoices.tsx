import React, { useState, useEffect } from 'react';
import ParentLayout from '../../components/ParentLayout';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../../types';
import { Loader2, Download, Printer, Eye, X } from 'lucide-react';

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
        
        if (parentsSnapshot.empty) {
          setLoading(false);
          return;
        }
        
        const parentId = parentsSnapshot.docs[0].id;

        const q = query(
          collection(db, 'schools', profile.schoolId!, 'invoices'), 
          where('parentId', '==', parentId)
        );
        
        unsubInvoices = onSnapshot(q, (snap) => {
          setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

  const handleDownload = (invoice: any) => {
    const content = `
      INVOICE: ${invoice.invoiceNumber}
      School: ${school?.name || 'EduManagePro'}
      Student: ${invoice.studentName}
      Amount: ${formatCurrency(invoice.totalAmount || invoice.amount || 0)}
      Balance Due: ${formatCurrency(invoice.balanceDue || 0)}
      Status: ${invoice.status}
      Date: ${new Date(invoice.createdAt).toLocaleDateString()}
    `;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_${invoice.invoiceNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return <ParentLayout profile={profile}><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></ParentLayout>;

  return (
    <ParentLayout profile={profile}>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Invoices</h1>
      </div>
      
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
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
                <td colSpan={6} className="p-8 text-center text-gray-500 dark:text-gray-400">No invoices found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:p-0 print:bg-white print:static">
          <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:w-full print:max-w-none">
            <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between print:hidden">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">Invoice Details</h2>
              <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
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
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Invoice</h2>
                  <p className="text-gray-500 dark:text-gray-400 font-bold">#{selectedInvoice.invoiceNumber}</p>
                  <p className="text-gray-400 text-xs mt-1">{new Date(selectedInvoice.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-10 py-8 border-y border-gray-100 dark:border-gray-800">
                <div>
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Bill To</h3>
                  <p className="font-black text-gray-900 dark:text-white text-lg">{profile.fullName}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Parent of {selectedInvoice.studentName}</p>
                </div>
                <div className="text-right">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Status</h3>
                  <span className={`px-4 py-1 rounded-full text-xs font-black uppercase ${selectedInvoice.status === 'paid' || selectedInvoice.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {selectedInvoice.status}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600 dark:text-gray-400 font-bold">Total Amount</span>
                  <span className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(selectedInvoice.totalAmount || selectedInvoice.amount || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600 dark:text-gray-400 font-bold">Amount Paid</span>
                  <span className="text-xl font-black text-green-600">{formatCurrency(selectedInvoice.amountPaid || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-4 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-lg font-black text-gray-900 dark:text-white">Balance Due</span>
                  <span className="text-3xl font-black text-red-600">{formatCurrency(selectedInvoice.balanceDue || 0)}</span>
                </div>
              </div>

              <div className="pt-10 flex gap-4 print:hidden">
                <button
                  onClick={handlePrint}
                  className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print Invoice
                </button>
                <button
                  onClick={() => handleDownload(selectedInvoice)}
                  className="flex-1 py-4 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ParentLayout>
  );
}
