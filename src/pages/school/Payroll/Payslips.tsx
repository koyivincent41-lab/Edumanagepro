import React, { useState, useEffect } from 'react';
import { School, PayrollPeriod, PayrollEntry, Employee } from '../../../types';
import { collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FileText, Download, Mail, Search, Printer } from 'lucide-react';
import { exportPayslipToPDF } from '../../../lib/reportUtils';
import QRCode from 'qrcode';

interface Props {
  schoolId: string;
  school: School | null;
}

export default function Payslips({ schoolId, school }: Props) {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<PayrollEntry | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    if (school?.schoolNumber) {
      QRCode.toDataURL(`${school.name}\nID: ${school.schoolNumber}`, { margin: 1, width: 100 })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error('Error generating QR code:', err));
    }
  }, [school]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'schools', schoolId, 'payroll_periods'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollPeriod));
      data.sort((a, b) => b.year - a.year || b.month - a.month);
      setPeriods(data);
      if (data.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(data[0].id);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [schoolId]);

  useEffect(() => {
    if (!selectedPeriodId) return;
    
    const q = query(collection(db, 'schools', schoolId, 'payroll_entries'), where('periodId', '==', selectedPeriodId));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollEntry));
      setEntries(data);
    });
    return () => unsubscribe();
  }, [schoolId, selectedPeriodId]);

  useEffect(() => {
    if (selectedEntry) {
      const fetchEmployee = async () => {
        const empRef = doc(db, 'employees', selectedEntry.employeeId);
        const empSnap = await getDoc(empRef);
        if (empSnap.exists()) {
          setEmployee(empSnap.data() as Employee);
        }
      };
      fetchEmployee();
    } else {
      setEmployee(null);
    }
  }, [selectedEntry, schoolId]);

  const getMonthName = (month: number) => {
    const date = new Date();
    date.setMonth(month - 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  const filteredEntries = entries.filter(entry => 
    (entry as any).employeeName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (selectedEntry && selectedPeriod) {
      await exportPayslipToPDF(selectedEntry, selectedPeriod, school);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <div className="flex gap-4 w-full sm:w-auto">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Select Period</label>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full sm:w-48 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {getMonthName(p.month)} {p.year}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 sm:w-64">
            <label className="block text-sm font-bold text-gray-700 mb-1">Search Employee</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 border border-gray-200 rounded-2xl overflow-hidden bg-white h-[calc(100vh-240px)] flex flex-col">
          <div className="p-4 border-b border-gray-100 bg-gray-50 font-bold text-gray-700">
            Employees ({filteredEntries.length})
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {filteredEntries.length === 0 ? (
              <p className="text-center text-gray-500 py-4 text-sm">No payslips found.</p>
            ) : (
              filteredEntries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className={`w-full text-left p-3 rounded-xl transition-all ${
                    selectedEntry?.id === entry.id 
                      ? 'bg-primary/10 border-primary/20 border' 
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="font-bold text-gray-900">{(entry as any).employeeName || 'Unknown'}</div>
                  <div className="text-xs text-gray-500 flex justify-between mt-1">
                    <span>Net: {school?.currency} {entry.netPay.toLocaleString()}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      entry.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {(entry.status || 'draft').toUpperCase()}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-8 shadow-sm h-[calc(100vh-240px)] overflow-y-auto print:shadow-none print:border-none print:h-auto print:overflow-visible">
          {selectedEntry ? (
            <div className="max-w-2xl mx-auto space-y-8">
              {/* Actions - Hidden when printing */}
              <div className="flex justify-end gap-2 print:hidden">
                <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-bold text-sm">
                  <Printer className="h-4 w-4" /> Print
                </button>
                <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all font-bold text-sm">
                  <Download className="h-4 w-4" /> Download
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all font-bold text-sm">
                  <Mail className="h-4 w-4" /> Email
                </button>
              </div>

              {/* Payslip Content */}
              <div className="border border-gray-200 rounded-xl p-8 flex flex-col min-h-[600px] space-y-8 print:border-none print:p-0">
                <div className="flex-1 space-y-8">
                  {/* Header */}
                  <div className="text-center space-y-2 border-b border-gray-200 pb-6 relative">
                    {qrCodeUrl && (
                      <div className="absolute top-0 right-0">
                        <img src={qrCodeUrl} alt="School QR Code" className="w-16 h-16" />
                      </div>
                    )}
                    {school?.logo ? (
                      <img src={school.logo || undefined} alt="School Logo" className="h-16 mx-auto mb-4" referrerPolicy="no-referrer" />
                    ) : null}
                    <h1 className="text-2xl font-black text-gray-900">{school?.name || 'School Name'}</h1>
                    <p className="text-gray-500 text-sm">{school?.address || 'School Address'}</p>
                    <p className="text-gray-500 text-sm">{school?.email || 'email@school.com'} | {school?.phone || 'Phone'}</p>
                    <div className="mt-4 pt-4">
                      <h2 className="text-xl font-bold text-primary uppercase tracking-widest">Payslip</h2>
                      <p className="text-gray-600 font-medium mt-1">For the month of {selectedPeriod ? `${getMonthName(selectedPeriod.month)} ${selectedPeriod.year}` : ''}</p>
                    </div>
                  </div>

                  {/* Employee Details */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <div>
                      <span className="text-gray-500">Employee Name:</span>
                      <p className="font-bold text-gray-900">{(selectedEntry as any).employeeName || 'Unknown'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Staff ID:</span>
                      <p className="font-bold text-gray-900">{employee?.staffNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Payslip Number:</span>
                      <p className="font-bold text-gray-900">{(selectedEntry as any).payslipNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <p className="font-bold text-gray-900 uppercase">{selectedEntry.status}</p>
                    </div>
                  </div>

                  {/* Earnings & Deductions */}
                  <div className="grid grid-cols-2 gap-8">
                    {/* Earnings */}
                    <div>
                      <h3 className="font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4 uppercase text-xs tracking-wider">Earnings</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Basic Salary</span>
                          <span className="font-medium">{school?.currency} {selectedEntry.basicSalary.toLocaleString()}</span>
                        </div>
                        {selectedEntry.allowances.map((allowance, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span className="text-gray-600">{allowance.name}</span>
                            <span className="font-medium">{school?.currency} {allowance.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Deductions */}
                    <div>
                      <h3 className="font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4 uppercase text-xs tracking-wider">Deductions</h3>
                      <div className="space-y-3 text-sm">
                        {selectedEntry.deductions.length === 0 ? (
                          <p className="text-gray-400 italic">No deductions</p>
                        ) : (
                          selectedEntry.deductions.map((deduction, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span className="text-gray-600">{deduction.name}</span>
                              <span className="font-medium text-red-600">-{school?.currency} {deduction.amount.toLocaleString()}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="border-t border-gray-200 pt-6 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-gray-700">Gross Pay:</span>
                      <span className="font-bold text-gray-900">{school?.currency} {selectedEntry.grossPay.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-gray-700">Total Deductions:</span>
                      <span className="font-bold text-red-600">-{school?.currency} {(selectedEntry.grossPay - selectedEntry.netPay).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-lg bg-gray-50 p-4 rounded-xl mt-4">
                      <span className="font-black text-gray-900 uppercase tracking-wider">Net Pay:</span>
                      <span className="font-black text-primary">{school?.currency} {selectedEntry.netPay.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                {/* Footer */}
                <div className="mt-auto pt-8">
                  <div className="flex justify-start mb-8">
                    <div className="text-center">
                      {school?.signature && (
                        <img src={school.signature} alt="Signature" className="h-16 mx-auto mb-2" referrerPolicy="no-referrer" />
                      )}
                      <div className="border-b border-gray-300 w-48 mx-auto mb-2"></div>
                      <p className="text-gray-500 font-medium text-sm">Administrator Authorized Signature</p>
                    </div>
                  </div>
                  
                  <div className="text-center text-xs text-gray-400 pt-8 relative">
                    This is a computer generated document. No signature is required.
                    
                    {/* Approved Seal */}
                    <div className="absolute right-0 bottom-32 opacity-20 print:opacity-100">
                      <div 
                        className="w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center rotate-[-15deg] p-2 text-center"
                        style={{ borderColor: school?.primaryColor || '#800000', color: school?.primaryColor || '#800000' }}
                      >
                        <span className="text-[6px] font-black uppercase tracking-widest leading-none mb-1">{school?.name}</span>
                        <span className="text-sm font-black uppercase tracking-tighter leading-none">Approved</span>
                        <span className="text-[8px] font-bold my-1">PAYSLIP</span>
                        <span className="text-[6px] font-bold">{new Date().toLocaleDateString()}</span>
                        <div className="absolute inset-0 rounded-full border border-dashed opacity-50 m-1" style={{ borderColor: school?.primaryColor || '#800000' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <FileText className="h-16 w-16 opacity-20" />
              <p>Select an employee to view their payslip</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
