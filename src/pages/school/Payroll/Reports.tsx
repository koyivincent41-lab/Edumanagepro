import React, { useState, useEffect } from 'react';
import { School, PayrollPeriod, PayrollEntry } from '../../../types';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Download, FileText, BarChart3, PieChart } from 'lucide-react';
import { exportToCSV, exportPayrollToPDF } from '../../../lib/reportUtils';

interface Props {
  schoolId: string;
  school: School | null;
}

export default function Reports({ schoolId, school }: Props) {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('all');
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'schools', schoolId, 'payroll_periods'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollPeriod));
      data.sort((a, b) => b.year - a.year || b.month - a.month);
      setPeriods(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [schoolId]);

  useEffect(() => {
    let q = collection(db, 'schools', schoolId, 'payroll_entries') as any;
    if (selectedPeriodId !== 'all') {
      q = query(q, where('periodId', '==', selectedPeriodId));
    }
    
    const unsubscribe = onSnapshot(q, (snap: any) => {
      const data = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as PayrollEntry));
      setEntries(data);
    });
    return () => unsubscribe();
  }, [schoolId, selectedPeriodId]);

  const getMonthName = (month: number) => {
    const date = new Date();
    date.setMonth(month - 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  const exportToCSV = () => {
    const headers = ['Employee Name', 'Basic Salary', 'Total Allowances', 'Total Deductions', 'Gross Pay', 'Net Pay', 'Status'];
    const csvContent = [
      headers.join(','),
      ...entries.map(e => {
        const totalAllowances = e.allowances.reduce((sum, a) => sum + a.amount, 0);
        const totalDeductions = e.deductions.reduce((sum, d) => sum + d.amount, 0);
        return [
          `"${(e as any).employeeName || 'Unknown'}"`,
          e.basicSalary,
          totalAllowances,
          totalDeductions,
          e.grossPay,
          e.netPay,
          e.status
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payroll_report_${selectedPeriodId === 'all' ? 'all' : selectedPeriodId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async () => {
    const period = periods.find(p => p.id === selectedPeriodId);
    if (period && entries.length > 0) {
      await exportPayrollToPDF(period, entries, school);
    } else if (selectedPeriodId === 'all' && entries.length > 0) {
      // Handle "all" case if needed, or just show error
      // For now, let's just export the first period if "all" is selected
      const firstPeriod = periods[0];
      await exportPayrollToPDF(firstPeriod, entries, school);
    } else {
      alert('No payroll data available to download.');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const totalGross = entries.reduce((sum, e) => sum + e.grossPay, 0);
  const totalNet = entries.reduce((sum, e) => sum + e.netPay, 0);
  const totalDeductions = entries.reduce((sum, e) => sum + (e.grossPay - e.netPay), 0);
  const totalAllowances = entries.reduce((sum, e) => sum + e.allowances.reduce((s, a) => s + a.amount, 0), 0);
  const totalBasic = entries.reduce((sum, e) => sum + e.basicSalary, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Filter by Period</label>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="w-full sm:w-64 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="all">All Periods</option>
            {periods.map(p => (
              <option key={p.id} value={p.id}>
                {getMonthName(p.month)} {p.year}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 md:px-6 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-bold text-sm"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 md:px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-bold text-sm"
          >
            <FileText className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 md:p-6 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Basic</p>
          </div>
          <p className="text-xl md:text-2xl font-black text-gray-900">{school?.currency} {totalBasic.toLocaleString()}</p>
        </div>
        
        <div className="p-4 md:p-6 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <BarChart3 className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Allowances</p>
          </div>
          <p className="text-xl md:text-2xl font-black text-green-600">+{school?.currency} {totalAllowances.toLocaleString()}</p>
        </div>

        <div className="p-4 md:p-6 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <PieChart className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Deductions</p>
          </div>
          <p className="text-xl md:text-2xl font-black text-red-600">-{school?.currency} {totalDeductions.toLocaleString()}</p>
        </div>

        <div className="p-4 md:p-6 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Net Pay</p>
          </div>
          <p className="text-xl md:text-2xl font-black text-primary">{school?.currency} {totalNet.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-bold text-gray-900">Payroll Summary ({entries.length} entries)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[700px] w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-4 font-bold">Employee</th>
                <th className="px-4 md:px-6 py-4 font-bold">Basic Salary</th>
                <th className="px-4 md:px-6 py-4 font-bold">Allowances</th>
                <th className="px-4 md:px-6 py-4 font-bold">Deductions</th>
                <th className="px-4 md:px-6 py-4 font-bold">Gross Pay</th>
                <th className="px-4 md:px-6 py-4 font-bold">Net Pay</th>
                <th className="px-4 md:px-6 py-4 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 md:px-6 py-4 md:py-8 text-center text-gray-500">
                    No payroll data found for the selected period.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const empTotalAllowances = entry.allowances.reduce((sum, a) => sum + a.amount, 0);
                  const empTotalDeductions = entry.deductions.reduce((sum, d) => sum + d.amount, 0);
                  
                  return (
                    <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-900">{(entry as any).employeeName || 'Unknown'}</td>
                      <td className="px-4 md:px-6 py-4 text-gray-600">{school?.currency} {entry.basicSalary.toLocaleString()}</td>
                      <td className="px-4 md:px-6 py-4 text-green-600">+{school?.currency} {empTotalAllowances.toLocaleString()}</td>
                      <td className="px-4 md:px-6 py-4 text-red-600">-{school?.currency} {empTotalDeductions.toLocaleString()}</td>
                      <td className="px-4 md:px-6 py-4 font-medium text-gray-900">{school?.currency} {entry.grossPay.toLocaleString()}</td>
                      <td className="px-4 md:px-6 py-4 font-black text-primary">{school?.currency} {entry.netPay.toLocaleString()}</td>
                      <td className="px-4 md:px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                          entry.status === 'paid' ? 'bg-green-100 text-green-700' : 
                          entry.status === 'approved' ? 'bg-blue-100 text-blue-700' : 
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {(entry.status || 'draft').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
