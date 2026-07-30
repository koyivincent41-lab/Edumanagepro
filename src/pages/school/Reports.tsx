import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Loader2,
  Calendar,
  Users,
  GraduationCap,
  Clock,
  PieChart,
  Filter,
  Printer,
  ChevronRight,
  Search,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Invoice, Payment, Student, Parent, School, Class } from '../../types';
import { exportToCSV, exportToPDF, exportToExcel, exportToWord } from '../../lib/reportUtils';
import { toast } from 'sonner';
import { useBranch } from '../../context/BranchContext';
import ExamAnalysisDashboard from './Reports/ExamAnalysis/ExamAnalysisDashboard';

type ReportType = 
  | 'receivables' 
  | 'overdue' 
  | 'collections' 
  | 'parent_statement' 
  | 'student_statement' 
  | 'aging' 
  | 'payment_summary' 
  | 'expense_report' 
  | 'income_expense' 
  | 'credit_balance' 
  | 'collection_class' 
  | 'collection_term' 
  | 'collection_month'
  | 'exam_analysis';

export default function Reports({ schoolId, school }: { schoolId: string; school: School | null }) {
  const { currentBranch, classes } = useBranch();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<ReportType>('receivables');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  useEffect(() => {
    if (!schoolId) return;
    
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

    let paymentsQuery = query(
      collection(db, 'schools', schoolId, 'payments'),
      where('academicYear', '==', school?.academicYear || '')
    );
    if (currentBranch) paymentsQuery = query(paymentsQuery, where('branchId', '==', currentBranch.id));

    const unsubPayments = onSnapshot(
      paymentsQuery, 
      (snap) => {
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
      }
    );

    let expensesQuery = query(
      collection(db, 'schools', schoolId, 'expenses'),
      where('academicYear', '==', school?.academicYear || '')
    );
    if (currentBranch) expensesQuery = query(expensesQuery, where('branchId', '==', currentBranch.id));

    const unsubExpenses = onSnapshot(
      expensesQuery, 
      (snap) => {
        setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

    let parentsQuery = query(collection(db, 'schools', schoolId, 'parents'));
    if (currentBranch) parentsQuery = query(parentsQuery, where('branchId', '==', currentBranch.id));

    const unsubParents = onSnapshot(parentsQuery, (snap) => {
      setParents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Parent)));
      setLoading(false);
    });

    return () => {
      unsubInvoices();
      unsubPayments();
      unsubExpenses();
      unsubStudents();
      unsubParents();
    };
  }, [schoolId, school?.academicYear, currentBranch]);

  const reportCategories = [
    { id: 'receivables', name: 'Receivables', icon: FileText, desc: 'Outstanding balances by student.' },
    { id: 'overdue', name: 'Overdue Fees', icon: Clock, desc: 'Invoices past their due date.' },
    { id: 'collections', name: 'Collections Summary', icon: TrendingUp, desc: 'Total fees collected over time.' },
    { id: 'parent_statement', name: 'Parent Statement', icon: Users, desc: 'Detailed billing history for a parent.' },
    { id: 'student_statement', name: 'Student Statement', icon: GraduationCap, desc: 'Detailed billing history for a student.' },
    { id: 'aging', name: 'Invoice Aging', icon: BarChart3, desc: 'Breakdown of outstanding fees by age.' },
    { id: 'payment_summary', name: 'Payment Summary', icon: DollarSign, desc: 'List of all payments received.' },
    { id: 'expense_report', name: 'Expense Report', icon: TrendingDown, desc: 'Detailed school operational costs.' },
    { id: 'income_expense', name: 'Income vs. Expense', icon: PieChart, desc: 'Comparison of revenue and costs.' },
    { id: 'credit_balance', name: 'Credit Balance', icon: DollarSign, desc: 'Students with overpayments.' },
    { id: 'collection_class', name: 'Collection by Class', icon: BarChart3, desc: 'Revenue breakdown by class level.' },
    { id: 'collection_term', name: 'Collection by Term', icon: Calendar, desc: 'Revenue breakdown by academic term.' },
    { id: 'collection_month', name: 'Collection by Month', icon: Calendar, desc: 'Revenue breakdown by month.' },
    { id: 'exam_analysis', name: 'Examination Analysis', icon: GraduationCap, desc: 'Academic performance dashboard and reports.' },
  ];

  const getReportData = () => {
    let data: any[] = [];
    let numericFields: string[] = [];

    switch (activeReport) {
      case 'receivables':
        data = invoices
          .filter(inv => inv.balanceDue > 0)
          .map(inv => {
            const student = students.find(s => s.id === inv.studentId);
            return {
              'Invoice #': inv.invoiceNumber,
              'Student': student?.fullName || 'N/A',
              'Total Amount': inv.totalAmount,
              'Balance Due': inv.balanceDue,
              'Due Date': new Date(inv.dueDate).toLocaleDateString(),
            };
          });
        numericFields = ['Total Amount', 'Balance Due'];
        break;
      case 'overdue':
        data = invoices
          .filter(inv => inv.status === 'overdue' || (new Date(inv.dueDate) < new Date() && inv.balanceDue > 0))
          .map(inv => {
            const student = students.find(s => s.id === inv.studentId);
            return {
              'Invoice #': inv.invoiceNumber,
              'Student': student?.fullName || 'N/A',
              'Balance Due': inv.balanceDue,
              'Due Date': new Date(inv.dueDate).toLocaleDateString(),
            };
          });
        numericFields = ['Balance Due'];
        break;
      case 'collections':
        data = payments.map(p => {
          const student = students.find(s => s.id === p.studentId);
          return {
            'Receipt #': p.receiptNumber,
            'Student': student?.fullName || 'N/A',
            'Amount': p.amount,
            'Method': p.paymentMethod,
            'Date': new Date(p.paymentDate).toLocaleDateString(),
          };
        });
        numericFields = ['Amount'];
        break;
      case 'parent_statement':
        data = payments.map(p => {
          const parent = parents.find(pa => pa.id === p.parentId);
          return {
            'Date': new Date(p.paymentDate).toLocaleDateString(),
            'Parent': parent?.fullName || 'N/A',
            'Receipt #': p.receiptNumber,
            'Amount Paid': p.amount,
            'Method': p.paymentMethod,
          };
        });
        numericFields = ['Amount Paid'];
        break;
      case 'student_statement':
        data = payments.map(p => {
          const student = students.find(s => s.id === p.studentId);
          return {
            'Date': new Date(p.paymentDate).toLocaleDateString(),
            'Student': student?.fullName || 'N/A',
            'Receipt #': p.receiptNumber,
            'Amount Paid': p.amount,
            'Method': p.paymentMethod,
          };
        });
        numericFields = ['Amount Paid'];
        break;
      case 'aging':
        const now = new Date();
        data = invoices
          .filter(inv => inv.balanceDue > 0)
          .map(inv => {
            const dueDate = new Date(inv.dueDate);
            const diffDays = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            let category = 'Current';
            if (diffDays > 90) category = '90+ Days';
            else if (diffDays > 60) category = '61-90 Days';
            else if (diffDays > 30) category = '31-60 Days';
            else if (diffDays > 0) category = '1-30 Days';

            const student = students.find(s => s.id === inv.studentId);
            return {
              'Invoice #': inv.invoiceNumber,
              'Student': student?.fullName || 'N/A',
              'Balance': inv.balanceDue,
              'Aging Category': category,
              'Due Date': dueDate.toLocaleDateString(),
            };
          });
        numericFields = ['Balance'];
        break;
      case 'payment_summary':
        data = payments.map(p => {
          const student = students.find(s => s.id === p.studentId);
          return {
            'Receipt #': p.receiptNumber,
            'Student': student?.fullName || 'N/A',
            'Amount': p.amount,
            'Method': p.paymentMethod,
            'Date': new Date(p.paymentDate).toLocaleDateString(),
          };
        });
        numericFields = ['Amount'];
        break;
      case 'expense_report':
        data = expenses.map(e => ({
          'Title': e.title,
          'Category': e.category,
          'Amount': e.amount,
          'Date': new Date(e.date).toLocaleDateString(),
        }));
        numericFields = ['Amount'];
        break;
      case 'income_expense':
        const totalIncome = payments.reduce((sum, p) => sum + p.amount, 0);
        const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
        data = [
          { 'Type': 'Income', 'Amount': totalIncome },
          { 'Type': 'Expense', 'Amount': totalExpense },
          { 'Type': 'Net Profit/Loss', 'Amount': totalIncome - totalExpense }
        ];
        break;
      case 'credit_balance':
        data = students
          .filter(s => (s.arrears || 0) < 0)
          .map(s => ({
            'Student': s.fullName,
            'Admission #': s.admissionNumber,
            'Credit Balance': Math.abs(s.arrears || 0)
          }));
        numericFields = ['Credit Balance'];
        break;
      case 'collection_class':
        if (selectedClassId === 'all') {
          const classCollections: Record<string, number> = {};
          payments.forEach(p => {
            const student = students.find(s => s.id === p.studentId);
            const classObj = classes.find(c => c.id === student?.classId);
            const className = classObj?.name || 'Unknown';
            classCollections[className] = (classCollections[className] || 0) + p.amount;
          });
          data = Object.entries(classCollections).map(([className, amount]) => ({
            'Class': className,
            'Total Collected': amount
          }));
          numericFields = ['Total Collected'];
        } else {
          const classObj = classes.find(c => c.id === selectedClassId);
          data = payments
            .filter(p => {
              const student = students.find(s => s.id === p.studentId);
              return student?.classId === selectedClassId;
            })
            .map(p => {
              const student = students.find(s => s.id === p.studentId);
              return {
                'Receipt #': p.receiptNumber,
                'Student': student?.fullName || 'N/A',
                'Class': classObj?.name || 'N/A',
                'Amount': p.amount,
                'Date': new Date(p.paymentDate).toLocaleDateString(),
              };
            });
          numericFields = ['Amount'];
        }
        break;
      case 'collection_term':
        const termCollections: Record<string, number> = {};
        payments.forEach(p => {
          termCollections[p.term] = (termCollections[p.term] || 0) + p.amount;
        });
        data = Object.entries(termCollections).map(([term, amount]) => ({
          'Term': term,
          'Total Collected': amount
        }));
        numericFields = ['Total Collected'];
        break;
      case 'collection_month':
        const monthCollections: Record<string, number> = {};
        payments.forEach(p => {
          const month = new Date(p.paymentDate).toLocaleString('default', { month: 'long', year: 'numeric' });
          monthCollections[month] = (monthCollections[month] || 0) + p.amount;
        });
        data = Object.entries(monthCollections).map(([month, amount]) => ({
          'Month': month,
          'Total Collected': amount
        }));
        numericFields = ['Total Collected'];
        break;
    }

    if (searchTerm) {
      data = data.filter(row => 
        Object.values(row).some(val => 
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Add Total Row
    if (data.length > 0 && numericFields.length > 0 && activeReport !== 'income_expense') {
      const totalRow: any = {};
      const firstKey = Object.keys(data[0])[0];
      Object.keys(data[0]).forEach(key => {
        if (key === firstKey) {
          totalRow[key] = 'TOTAL';
        } else if (numericFields.includes(key)) {
          totalRow[key] = data.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
        } else {
          totalRow[key] = '';
        }
      });
      data.push(totalRow);
    }

    return data;
  };

  const handleExportCSV = () => {
    const data = getReportData();
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }
    exportToCSV(data, activeReport);
  };

  const handleExportExcel = () => {
    const data = getReportData();
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }
    exportToExcel(data, activeReport);
  };

  const handleExportWord = async () => {
    const data = getReportData();
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }
    const title = reportCategories.find(c => c.id === activeReport)?.name || 'Report';
    await exportToWord(title, data, activeReport);
  };

  const handleExportPDF = async () => {
    const rawData = getReportData();
    if (rawData.length === 0) {
      toast.error('No data to export');
      return;
    }
    const headers = Object.keys(rawData[0]);
    const data = rawData.map(row => headers.map(h => {
      const val = row[h];
      if (typeof val === 'number' && (h.toLowerCase().includes('amount') || h.toLowerCase().includes('due') || h.toLowerCase().includes('balance') || h.toLowerCase().includes('collection') || h.toLowerCase().includes('paid'))) {
        return `${school?.currency} ${val.toLocaleString()}`;
      }
      return typeof val === 'number' ? val.toLocaleString() : val;
    }));
    const title = reportCategories.find(c => c.id === activeReport)?.name || 'Report';
    await exportToPDF(title, headers, data, school, activeReport);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const reportData = getReportData();

  return (
    <div className="space-y-8">
      <div className="bg-school-gradient p-4 md:p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white">Financial Reports</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Comprehensive financial analysis for {school?.name}.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={handleExportCSV}
              className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-white/20 transition-all flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button 
              onClick={handleExportExcel}
              className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-white/20 transition-all flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Excel
            </button>
            <button 
              onClick={handleExportWord}
              className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-white/20 transition-all flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Word
            </button>
            <button 
              onClick={handleExportPDF}
              className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-white/20 transition-all flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              PDF
            </button>
            <button 
              onClick={() => window.print()}
              className="px-4 md:px-6 py-2.5 bg-white text-maroon font-black uppercase tracking-widest text-[10px] rounded-xl shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Print View
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search reports..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:border-primary outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-4 space-y-1">
            {reportCategories
              .filter(cat => cat.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveReport(cat.id as ReportType)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${
                  activeReport === cat.id ? 'bg-school-gradient text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <cat.icon className={`h-4 w-4 ${activeReport === cat.id ? 'text-white' : 'text-gray-400 group-hover:text-primary'}`} />
                  <span className="text-xs font-bold">{cat.name}</span>
                </div>
                <ChevronRight className={`h-4 w-4 ${activeReport === cat.id ? 'text-white' : 'text-gray-300'}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Report Content */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-4 md:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {reportCategories.find(c => c.id === activeReport)?.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {reportCategories.find(c => c.id === activeReport)?.desc}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {activeReport === 'collection_class' && (
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:border-primary outline-none"
                  >
                    <option value="all">All Classes</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleExportPDF}
                    className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                    title="Download PDF"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {activeReport === 'exam_analysis' ? (
              <ExamAnalysisDashboard schoolId={schoolId} school={school} />
            ) : reportData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-[700px] w-full text-left">
                  <thead>
                    <tr className="bg-gray-50">
                      {Object.keys(reportData[0]).map((header) => (
                        <th key={header} className="px-4 md:px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reportData.map((row, i) => {
                      const isTotalRow = Object.values(row).includes('TOTAL');
                      return (
                        <tr key={i} className={`hover:bg-gray-50 transition-colors ${isTotalRow ? 'bg-gray-50 font-bold' : ''}`}>
                          {Object.entries(row).map(([key, val], j) => {
                            const value = val as any;
                            return (
                              <td key={j} className={`px-6 py-4 text-sm ${isTotalRow ? 'text-gray-900' : 'text-gray-600'}`}>
                                {typeof value === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('due') || key.toLowerCase().includes('balance') || key.toLowerCase().includes('collection') || key.toLowerCase().includes('paid'))
                                  ? `${school?.currency} ${value.toLocaleString()}`
                                  : typeof value === 'number' ? value.toLocaleString() : value}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 text-gray-300">
                  <FileText className="h-8 w-8" />
                </div>
                <h4 className="text-lg font-bold text-gray-900">No data available</h4>
                <p className="text-sm text-gray-500 max-w-xs mx-auto mt-2">
                  We couldn't find any records for this report type in the current academic year.
                </p>
              </div>
            )}
          </div>

          {/* Quick Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Records</p>
              <p className="text-xl md:text-2xl font-extrabold text-gray-900">{reportData.length}</p>
            </div>
            <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Last Updated</p>
              <p className="text-xl md:text-2xl font-extrabold text-gray-900">{new Date().toLocaleDateString()}</p>
            </div>
            <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-bold">Verified</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

