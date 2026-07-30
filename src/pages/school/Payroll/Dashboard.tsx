import React, { useState, useEffect } from 'react';
import { School, PayrollPeriod, Employee, PayrollEntry } from '../../../types';
import { collection, onSnapshot, query, where, getDocs, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebase';
import { 
  Users, 
  DollarSign, 
  TrendingDown, 
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Calendar,
  TrendingUp,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreErrorHandler';

interface Props {
  schoolId: string;
  school: School | null;
}

export default function PayrollDashboard({ schoolId, school }: Props) {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncPayroll = async () => {
    if (!schoolId) return;
    setIsSyncing(true);
    try {
      // 1. Fetch all payroll-specific employees
      const payrollEmpSnap = await getDocs(collection(db, 'schools', schoolId, 'employees'));
      const payrollEmployees = payrollEmpSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Fetch all root employees
      const rootEmpSnap = await getDocs(query(collection(db, 'employees'), where('schoolId', '==', schoolId)));
      const rootEmployees = rootEmpSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const batch = writeBatch(db);
      let syncedCount = 0;

      for (const pEmpDoc of payrollEmpSnap.docs) {
        const pEmp = { id: pEmpDoc.id, ...pEmpDoc.data() } as any;
        // Try to find matching root employee by name or staffNumber
        let rootEmp = rootEmployees.find(r => 
          r.fullName.toLowerCase() === pEmp.fullName.toLowerCase() || 
          r.staffNumber === pEmp.staffNumber
        );

        const generateStaffNumber = () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let result = '';
          for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        };

        const payrollData = {
          designation: pEmp.designation || pEmp.jobTitle || '',
          department: pEmp.department || '',
          employmentType: pEmp.employmentType || 'full_time',
          dateOfEmployment: pEmp.dateOfEmployment || pEmp.employmentDate || new Date().toISOString().split('T')[0],
          payrollStatus: pEmp.payrollStatus || 'active',
          paymentMethod: pEmp.paymentMethod || 'bank',
          bankName: pEmp.bankName || '',
          bankAccountNumber: pEmp.bankAccountNumber || '',
          taxNumber: pEmp.taxNumber || '',
          basicSalary: pEmp.basicSalary || 0,
          salaryStructureId: pEmp.salaryStructureId || '',
          updatedAt: new Date().toISOString()
        };

        if (rootEmp) {
          // Update existing root employee
          const rootRef = doc(db, 'employees', rootEmp.id);
          batch.update(rootRef, {
            ...payrollData,
            staffNumber: (rootEmp as any).staffNumber || generateStaffNumber()
          });
        } else {
          // Create new root employee
          const newRootRef = doc(collection(db, 'employees'));
          batch.set(newRootRef, {
            fullName: pEmp.fullName,
            schoolId,
            staffNumber: generateStaffNumber(),
            status: 'active',
            createdAt: new Date().toISOString(),
            ...payrollData
          });
        }
        syncedCount++;
      }

      await batch.commit();
      toast.success(`Successfully synced ${syncedCount} employees to the main system.`);
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync payroll data.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const unsubEmployees = onSnapshot(
      query(collection(db, 'employees'), where('schoolId', '==', schoolId), where('status', '==', 'active')), 
      (snap) => {
        setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'employees')
    );

    const unsubPeriods = onSnapshot(
      collection(db, 'schools', schoolId, 'payroll_periods'), 
      (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollPeriod));
        data.sort((a, b) => b.year - a.year || b.month - a.month);
        setPeriods(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `schools/${schoolId}/payroll_periods`)
    );

    const unsubEntries = onSnapshot(
      collection(db, 'schools', schoolId, 'payroll_entries'), 
      (snap) => {
        setEntries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollEntry)));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `schools/${schoolId}/payroll_entries`)
    );

    return () => {
      unsubEmployees();
      unsubPeriods();
      unsubEntries();
    };
  }, [schoolId]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const currentPeriod = periods[0];
  const currentEntries = currentPeriod ? entries.filter(e => e.periodId === currentPeriod.id) : [];
  
  const totalGross = currentEntries.reduce((sum, e) => sum + e.grossPay, 0);
  const totalNet = currentEntries.reduce((sum, e) => sum + e.netPay, 0);
  const totalDeductions = currentEntries.reduce((sum, e) => sum + (e.grossPay - e.netPay), 0);
  const pendingApprovals = periods.filter(p => p.status === 'pending_approval').length;
  const paidEmployees = currentEntries.filter(e => e.status === 'paid').length;
  const unpaidEmployees = currentEntries.filter(e => e.status !== 'paid').length;

  const getMonthName = (month: number) => {
    const date = new Date();
    date.setMonth(month - 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  const statCards = [
    { title: 'Total Employees', value: employees.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { title: 'Gross Payroll', value: `${school?.currency || '$'} ${(totalGross || 0).toLocaleString()}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-100' },
    { title: 'Total Deductions', value: `${school?.currency || '$'} ${(totalDeductions || 0).toLocaleString()}`, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-100' },
    { title: 'Net Payroll', value: `${school?.currency || '$'} ${(totalNet || 0).toLocaleString()}`, icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-100' },
    { title: 'Pending Approvals', value: pendingApprovals, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100' },
    { title: 'Paid Employees', value: paidEmployees, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { title: 'Unpaid Employees', value: unpaidEmployees, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-100' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">Payroll Overview</h2>
        <button
          onClick={handleSyncPayroll}
          disabled={isSyncing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-bold text-sm shadow-sm"
        >
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync Payroll Data
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div key={index} className="p-4 rounded-2xl border border-gray-100 bg-gray-50 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.bg}`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{stat.title}</p>
              <p className="text-xl font-black text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            Recent Payroll Periods
          </h3>
          <div className="space-y-4">
            {periods.slice(0, 5).map(period => (
              <div key={period.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 p-4 rounded-xl border border-gray-50 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-bold text-gray-900">{getMonthName(period.month)} {period.year}</p>
                  <p className="text-sm text-gray-500">
                    {entries.filter(e => e.periodId === period.id).length} employees processed
                  </p>
                </div>
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                  period.status === 'paid' ? 'bg-green-100 text-green-700' :
                  period.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                  period.status === 'pending_approval' ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {(period.status || 'draft').replace('_', ' ').toUpperCase()}
                </span>
              </div>
            ))}
            {periods.length === 0 && (
              <p className="text-center text-gray-500 py-4">No payroll periods found.</p>
            )}
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-400" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => navigate('/dashboard/employees')}
              className="p-4 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
            >
              <div className="p-2 bg-primary/10 text-primary w-fit rounded-lg mb-3 group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5" />
              </div>
              <p className="font-bold text-gray-900">Add Employee</p>
              <p className="text-xs text-gray-500 mt-1">Register new staff in the main system</p>
            </button>
            <button 
              onClick={() => navigate('/dashboard/payroll/periods')}
              className="p-4 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
            >
              <div className="p-2 bg-primary/10 text-primary w-fit rounded-lg mb-3 group-hover:scale-110 transition-transform">
                <Calendar className="h-5 w-5" />
              </div>
              <p className="font-bold text-gray-900">New Period</p>
              <p className="text-xs text-gray-500 mt-1">Create a new payroll month</p>
            </button>
            <button 
              onClick={() => navigate('/dashboard/payroll/process')}
              className="p-4 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
            >
              <div className="p-2 bg-primary/10 text-primary w-fit rounded-lg mb-3 group-hover:scale-110 transition-transform">
                <DollarSign className="h-5 w-5" />
              </div>
              <p className="font-bold text-gray-900">Process Payroll</p>
              <p className="text-xs text-gray-500 mt-1">Run calculations for current period</p>
            </button>
            <button 
              onClick={() => navigate('/dashboard/payroll/reports')}
              className="p-4 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
            >
              <div className="p-2 bg-primary/10 text-primary w-fit rounded-lg mb-3 group-hover:scale-110 transition-transform">
                <FileText className="h-5 w-5" />
              </div>
              <p className="font-bold text-gray-900">Generate Reports</p>
              <p className="text-xs text-gray-500 mt-1">Export payroll summaries</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

