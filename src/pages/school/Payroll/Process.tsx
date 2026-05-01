import React, { useState, useEffect } from 'react';
import { School, PayrollPeriod, Employee, PayrollAllowance, PayrollDeduction, PayrollEntry, SalaryStructure, SalaryAdvance } from '../../../types';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';
import { Play, CheckCircle, AlertCircle, FileText, Download, Edit2, Save, X, DollarSign, Calendar } from 'lucide-react';
import { exportPayrollToPDF } from '../../../lib/reportUtils';
import { calculatePAYE } from '../../../lib/payrollUtils';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreErrorHandler';

interface Props {
  schoolId: string;
  school: School | null;
}

export default function Process({ schoolId, school }: Props) {
  const navigate = useNavigate();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [activeEmployeesCount, setActiveEmployeesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ basicSalary: number; totalAllowances: number; totalDeductions: number }>({ basicSalary: 0, totalAllowances: 0, totalDeductions: 0 });

  useEffect(() => {
    const unsubPeriods = onSnapshot(
      collection(db, 'schools', schoolId, 'payroll_periods'), 
      (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollPeriod));
        data.sort((a, b) => b.year - a.year || b.month - a.month);
        setPeriods(data);
        if (data.length > 0 && !selectedPeriodId) {
          setSelectedPeriodId(data[0].id);
        }
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `schools/${schoolId}/payroll_periods`)
    );

    const unsubActiveEmployees = onSnapshot(
      query(collection(db, 'employees'), where('schoolId', '==', schoolId), where('status', '==', 'active')), 
      (snap) => {
        setActiveEmployeesCount(snap.size);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'employees')
    );

    return () => {
      unsubPeriods();
      unsubActiveEmployees();
    };
  }, [schoolId]);

  useEffect(() => {
    if (!selectedPeriodId) return;
    
    const q = query(collection(db, 'schools', schoolId, 'payroll_entries'), where('periodId', '==', selectedPeriodId));
    const unsubscribe = onSnapshot(
      q, 
      (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollEntry));
        setEntries(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `schools/${schoolId}/payroll_entries`)
    );
    return () => unsubscribe();
  }, [schoolId, selectedPeriodId]);

  const handleProcessPayroll = async () => {
    if (!selectedPeriodId) return;
    
    const period = periods.find(p => p.id === selectedPeriodId);
    if (!period) return;
    
    if (period.status !== 'draft') {
      toast.error('Can only process payroll for draft periods.');
      return;
    }

    setProcessing(true);
    try {
      const empSnap = await getDocs(query(collection(db, 'employees'), where('schoolId', '==', schoolId), where('status', '==', 'active')));
      const employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));

      if (employees.length === 0) {
        toast.error('No active employees found to process payroll.');
        setProcessing(false);
        return;
      }

      const allowSnap = await getDocs(collection(db, 'schools', schoolId, 'allowances'));
      const allowances = allowSnap.docs.map(d => ({ id: d.id, ...d.data() } as PayrollAllowance));

      const dedSnap = await getDocs(collection(db, 'schools', schoolId, 'deductions'));
      const deductions = dedSnap.docs.map(d => ({ id: d.id, ...d.data() } as PayrollDeduction));

      const structSnap = await getDocs(collection(db, 'schools', schoolId, 'salary_structures'));
      const structures = structSnap.docs.map(d => ({ id: d.id, ...d.data() } as SalaryStructure));

      const loanSnap = await getDocs(query(collection(db, 'schools', schoolId, 'loans'), where('status', '==', 'approved')));
      const loans = loanSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const advanceSnap = await getDocs(query(collection(db, 'schools', schoolId, 'salary_advances'), where('status', '==', 'approved')));
      const advances = advanceSnap.docs.map(d => ({ id: d.id, ...d.data() } as SalaryAdvance));

      const existingEntriesSnap = await getDocs(query(collection(db, 'schools', schoolId, 'payroll_entries'), where('periodId', '==', selectedPeriodId)));
      
      const batch = writeBatch(db);
      existingEntriesSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      let periodTotalGross = 0;
      let periodTotalDeductions = 0;
      let periodTotalNetPay = 0;

      employees.forEach(emp => {
        let totalAllowances = 0;
        let totalDeductions = 0;
        const empAllowances: { name: string; amount: number }[] = [];
        const empDeductions: { name: string; amount: number }[] = [];

        // Get linked structure if any
        const structure = emp.salaryStructureId ? structures.find(s => s.id === emp.salaryStructureId) : null;

        allowances.forEach(allow => {
          const isLinkedToStructure = structure?.allowanceIds?.includes(allow.id);
          const isAssignedDirectly = allow.assignedTo === 'all' || (allow.assignedTo === 'specific' && allow.employeeIds?.includes(emp.id));
          
          if (isLinkedToStructure || isAssignedDirectly) {
            const amount = allow.type === 'fixed' ? allow.amount : (emp.basicSalary * allow.amount / 100);
            totalAllowances += amount;
            empAllowances.push({ name: allow.name, amount });
          }
        });

        deductions.forEach(ded => {
          const isLinkedToStructure = structure?.deductionIds?.includes(ded.id);
          const isAssignedDirectly = ded.assignedTo === 'all' || (ded.assignedTo === 'specific' && ded.employeeIds?.includes(emp.id));

          if (isLinkedToStructure || isAssignedDirectly) {
            const amount = ded.type === 'fixed' ? ded.amount : (emp.basicSalary * ded.amount / 100);
            totalDeductions += amount;
            empDeductions.push({ name: ded.name, amount });
          }
        });

        // Add loan and advance deductions from 'loans' collection
        const empLoansAndAdvances = loans.filter(l => l.employeeId === emp.id && (l.remainingBalance || l.balance || 0) > 0);
        empLoansAndAdvances.forEach(item => {
          // Check if due for this period
          let isDue = true;
          if (item.repaymentStartMonth && item.repaymentStartYear) {
            if (period.year < item.repaymentStartYear) isDue = false;
            if (period.year === item.repaymentStartYear && period.month < item.repaymentStartMonth) isDue = false;
          }

          // Check if already paid for this period in this loan/advance record
          const alreadyPaid = item.repayments?.some((r: any) => r.month === period.month && r.year === period.year);
          if (alreadyPaid) isDue = false;

          if (isDue) {
            const deductionAmount = Math.min(item.monthlyDeduction || item.installmentAmount || 0, item.remainingBalance || item.balance || 0);
            if (deductionAmount > 0) {
              totalDeductions += deductionAmount;
              const label = item.type === 'loan' ? 'Loan' : 'Salary Advance';
              empDeductions.push({ 
                name: label, 
                amount: deductionAmount, 
                loanId: item.id,
                type: item.type // Store type for easier processing later
              } as any);
            }
          }
        });

        // Add advance deductions from legacy 'salary_advances' collection if any
        const empLegacyAdvances = advances.filter(a => a.employeeId === emp.id && (a.remainingBalance || 0) > 0);
        empLegacyAdvances.forEach(adv => {
           // Check if due for this period
           let isDue = true;
           if (adv.recoveryStartMonth && adv.recoveryStartYear) {
             if (period.year < adv.recoveryStartYear) isDue = false;
             if (period.year === adv.recoveryStartYear && period.month < adv.recoveryStartMonth) isDue = false;
           }
           
           // Check if already paid (legacy advances might not have repayments array, so we check if balance > 0)
           // For legacy, we'll just check if it's already in empDeductions for this run to be safe
           const alreadyInDeductions = empDeductions.some((d: any) => d.advanceId === adv.id);
           if (alreadyInDeductions) isDue = false;

           if (isDue) {
             const deductionAmount = Math.min(adv.installmentAmount, adv.remainingBalance);
             if (deductionAmount > 0) {
               totalDeductions += deductionAmount;
               empDeductions.push({ name: 'Salary Advance', amount: deductionAmount, advanceId: adv.id } as any);
             }
           }
        });

        const grossPay = emp.basicSalary + totalAllowances;
        const paye = calculatePAYE(grossPay);
        totalDeductions += paye;
        empDeductions.push({ name: 'PAYE', amount: paye });
        const netPay = grossPay - totalDeductions;

        periodTotalGross += grossPay;
        periodTotalDeductions += totalDeductions;
        periodTotalNetPay += netPay;

        const entryRef = doc(collection(db, 'schools', schoolId, 'payroll_entries'));
        batch.set(entryRef, {
          schoolId,
          periodId: selectedPeriodId,
          employeeId: emp.id,
          employeeName: emp.fullName,
          staffNumber: emp.staffNumber,
          payslipNumber: (Math.floor(Math.random() * 90) + 10).toString(),
          basicSalary: emp.basicSalary,
          allowances: empAllowances,
          deductions: empDeductions,
          grossPay,
          netPay,
          status: 'draft'
        });
      });

      // Update period with totals
      const periodRef = doc(db, 'schools', schoolId, 'payroll_periods', selectedPeriodId);
      batch.update(periodRef, {
        totalGross: periodTotalGross,
        totalDeductions: periodTotalDeductions,
        totalNetPay: periodTotalNetPay
      });

      await batch.commit();
      toast.success(`Processed payroll for ${employees.length} employees.`);
    } catch (error) {
      console.error('Error processing payroll:', error);
      toast.error('Failed to process payroll');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedPeriodId) return;
    try {
      const batch = writeBatch(db);
      
      // Update period status and totals
      const entriesSnap = await getDocs(query(collection(db, 'schools', schoolId, 'payroll_entries'), where('periodId', '==', selectedPeriodId)));
      const currentEntries = entriesSnap.docs.map(d => d.data() as PayrollEntry);
      const totalGross = currentEntries.reduce((sum, e) => sum + e.grossPay, 0);
      const totalNetPay = currentEntries.reduce((sum, e) => sum + e.netPay, 0);
      const totalDeductions = totalGross - totalNetPay;

      const periodRef = doc(db, 'schools', schoolId, 'payroll_periods', selectedPeriodId);
      batch.update(periodRef, { 
        status: newStatus,
        totalGross,
        totalDeductions,
        totalNetPay
      });

      // Update all entries status if moving to approved or paid
      if (newStatus === 'approved' || newStatus === 'paid') {
        
        // If paid, fetch loans and advances to update balances
        let loansMap: Record<string, any> = {};
        let advancesMap: Record<string, any> = {};
        if (newStatus === 'paid') {
          const loanSnap = await getDocs(query(collection(db, 'schools', schoolId, 'loans'), where('status', '==', 'approved')));
          loanSnap.docs.forEach(d => {
            loansMap[d.id] = d.data();
          });
          const advanceSnap = await getDocs(query(collection(db, 'schools', schoolId, 'salary_advances'), where('status', '==', 'approved')));
          advanceSnap.docs.forEach(d => {
            advancesMap[d.id] = d.data();
          });
        }

        entriesSnap.docs.forEach(docSnap => {
          batch.update(docSnap.ref, { status: newStatus });
          
          if (newStatus === 'paid') {
            const entryData = docSnap.data() as PayrollEntry;
            entryData.deductions.forEach((ded: any) => {
              if (ded.loanId && loansMap[ded.loanId]) {
                const loanRef = doc(db, 'schools', schoolId, 'loans', ded.loanId);
                const currentBalance = loansMap[ded.loanId].remainingBalance || loansMap[ded.loanId].balance || 0;
                const newBalance = Math.max(0, currentBalance - ded.amount);
                
                // Record this repayment
                const repayment = {
                  month: selectedPeriod.month,
                  year: selectedPeriod.year,
                  amount: ded.amount,
                  date: new Date().toISOString(),
                  payrollEntryId: docSnap.id
                };

                const currentRepayments = loansMap[ded.loanId].repayments || [];

                batch.update(loanRef, { 
                  remainingBalance: newBalance,
                  balance: newBalance,
                  amountPaid: (loansMap[ded.loanId].amountPaid || 0) + ded.amount,
                  status: newBalance === 0 ? 'completed' : 'approved',
                  repayments: [...currentRepayments, repayment]
                });
                
                // Update local map to prevent issues if same loan is somehow processed twice in same batch (unlikely but safe)
                loansMap[ded.loanId].remainingBalance = newBalance;
                loansMap[ded.loanId].balance = newBalance;
                loansMap[ded.loanId].amountPaid = (loansMap[ded.loanId].amountPaid || 0) + ded.amount;
                loansMap[ded.loanId].repayments = [...currentRepayments, repayment];
              }
              if (ded.advanceId && advancesMap[ded.advanceId]) {
                const advanceRef = doc(db, 'schools', schoolId, 'salary_advances', ded.advanceId);
                const currentBalance = advancesMap[ded.advanceId].remainingBalance || 0;
                const newBalance = Math.max(0, currentBalance - ded.amount);
                
                // Record this repayment for legacy advances if they support it
                const repayment = {
                  month: selectedPeriod.month,
                  year: selectedPeriod.year,
                  amount: ded.amount,
                  date: new Date().toISOString(),
                  payrollEntryId: docSnap.id
                };
                const currentRepayments = advancesMap[ded.advanceId].repayments || [];

                batch.update(advanceRef, { 
                  remainingBalance: newBalance,
                  status: newBalance === 0 ? 'completed' : 'approved',
                  repayments: [...currentRepayments, repayment]
                });
                advancesMap[ded.advanceId].remainingBalance = newBalance;
                advancesMap[ded.advanceId].repayments = [...currentRepayments, repayment];
              }
            });
          }
        });
      }

      await batch.commit();
      toast.success(`Payroll period marked as ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const startEditing = (entry: PayrollEntry) => {
    const totalAllowances = entry.allowances.reduce((sum, a) => sum + a.amount, 0);
    const totalDeductions = entry.deductions.reduce((sum, d) => sum + d.amount, 0);
    setEditForm({
      basicSalary: entry.basicSalary,
      totalAllowances,
      totalDeductions
    });
    setEditingEntryId(entry.id);
  };

  const saveEdit = async (entryId: string) => {
    try {
      const grossPay = editForm.basicSalary + editForm.totalAllowances;
      const netPay = grossPay - editForm.totalDeductions;
      
      // We overwrite the arrays with a single manual entry for simplicity in this quick edit
      // In a full implementation, we'd allow editing individual allowances/deductions
      await updateDoc(doc(db, 'schools', schoolId, 'payroll_entries', entryId), {
        basicSalary: editForm.basicSalary,
        allowances: [{ name: 'Manual Allowances', amount: editForm.totalAllowances }],
        deductions: [{ name: 'Manual Deductions', amount: editForm.totalDeductions }],
        grossPay,
        netPay
      });

      // Update period totals
      if (selectedPeriodId) {
        const entriesSnap = await getDocs(query(collection(db, 'schools', schoolId, 'payroll_entries'), where('periodId', '==', selectedPeriodId)));
        const currentEntries = entriesSnap.docs.map(d => d.data() as PayrollEntry);
        const totalGross = currentEntries.reduce((sum, e) => sum + e.grossPay, 0);
        const totalNetPay = currentEntries.reduce((sum, e) => sum + e.netPay, 0);
        const totalDeductions = totalGross - totalNetPay;

        await updateDoc(doc(db, 'schools', schoolId, 'payroll_periods', selectedPeriodId), {
          totalGross,
          totalDeductions,
          totalNetPay
        });
      }

      toast.success('Entry updated successfully');
      setEditingEntryId(null);
    } catch (error) {
      console.error('Error updating entry:', error);
      toast.error('Failed to update entry');
    }
  };

  const handleDownloadPayroll = async () => {
    if (selectedPeriod && entries.length > 0) {
      await exportPayrollToPDF(selectedPeriod, entries, school);
    } else {
      toast.error('No payroll data available to download.');
    }
  };

  const getMonthName = (month: number) => {
    const date = new Date();
    date.setMonth(month - 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  if (periods.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
        <div className="p-4 bg-white rounded-full w-fit mx-auto mb-4 shadow-sm">
          <Calendar className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">No Payroll Periods Found</h3>
        <p className="text-gray-500 mb-6 max-w-sm mx-auto">You need to create a payroll period before you can process payroll for your employees.</p>
        <button
          onClick={() => navigate('/dashboard/payroll/periods')}
          className="px-6 py-2 bg-school-gradient text-white rounded-xl font-bold hover:shadow-lg transition-all"
        >
          Go to Periods
        </button>
      </div>
    );
  }

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Select Payroll Period</label>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="w-full sm:w-64 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {periods.map(p => (
              <option key={p.id} value={p.id}>
                {getMonthName(p.month)} {p.year} - {(p.status || 'draft').replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {selectedPeriod?.status === 'draft' && (
            <>
              <button
                onClick={handleProcessPayroll}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 bg-school-gradient text-white rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all font-bold text-sm"
              >
                {processing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Play className="h-4 w-4" />}
                Run Payroll
              </button>
              <button
                onClick={() => handleUpdateStatus('pending_approval')}
                className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-xl hover:bg-orange-200 transition-all font-bold text-sm"
              >
                <AlertCircle className="h-4 w-4" />
                Submit for Approval
              </button>
            </>
          )}
          {selectedPeriod?.status === 'pending_approval' && (
            <>
              <button
                onClick={() => handleUpdateStatus('approved')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-all font-bold text-sm"
              >
                <CheckCircle className="h-4 w-4" />
                Approve Payroll
              </button>
              <button
                onClick={() => handleUpdateStatus('draft')}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-all font-bold text-sm"
              >
                <X className="h-4 w-4" />
                Reject to Draft
              </button>
            </>
          )}
          {selectedPeriod?.status === 'approved' && (
            <button
              onClick={() => handleUpdateStatus('paid')}
              className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-all font-bold text-sm"
            >
              <DollarSign className="h-4 w-4" />
              Mark as Paid
            </button>
          )}
          {selectedPeriod && entries.length > 0 && (
            <button
              onClick={handleDownloadPayroll}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-bold text-sm"
            >
              <Download className="h-4 w-4" />
              Download Report
            </button>
          )}
        </div>
      </div>

      {selectedPeriod && (
        <>
          {activeEmployeesCount === 0 && (
            <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-start gap-3 mb-6">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-orange-900">No Active Employees Found</p>
                <p className="text-xs text-orange-700 mt-1">You need to have employees with an "Active" payroll status to process payroll. Go to the Employees section to update their status.</p>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Eligible Employees</p>
            <p className="text-xl font-black text-gray-900">{activeEmployeesCount}</p>
          </div>
          <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Processed</p>
            <p className="text-xl font-black text-blue-600">{entries.length}</p>
          </div>
          <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Gross</p>
            <p className="text-xl font-black text-green-600">
              {school?.currency} {(entries.reduce((sum, e) => sum + (e.grossPay || 0), 0)).toLocaleString()}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Deductions</p>
            <p className="text-xl font-black text-red-600">
              {school?.currency} {(entries.reduce((sum, e) => sum + ((e.grossPay || 0) - (e.netPay || 0)), 0)).toLocaleString()}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Net Pay</p>
            <p className="text-xl font-black text-primary">
              {school?.currency} {(entries.reduce((sum, e) => sum + (e.netPay || 0), 0)).toLocaleString()}
            </p>
          </div>
          </div>
        </>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50">
            <tr>
              <th className="px-6 py-3 rounded-tl-xl">Employee</th>
              <th className="px-6 py-3">Basic Salary</th>
              <th className="px-6 py-3">Allowances</th>
              <th className="px-6 py-3">Deductions</th>
              <th className="px-6 py-3">Gross Pay</th>
              <th className="px-6 py-3">Net Pay</th>
              <th className="px-6 py-3 text-right rounded-tr-xl">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No payroll entries found for this period. Click "Run Payroll" to generate.
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const isEditing = editingEntryId === entry.id;
                const totalAllowances = entry.allowances.reduce((sum, a) => sum + a.amount, 0);
                const totalDeductions = entry.deductions.reduce((sum, d) => sum + d.amount, 0);
                
                return (
                  <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{(entry as any).employeeName || 'Unknown'}</td>
                    
                    {isEditing ? (
                      <>
                        <td className="px-6 py-4">
                          <input type="number" value={editForm.basicSalary} onChange={e => setEditForm({...editForm, basicSalary: Number(e.target.value)})} className="w-24 px-2 py-1 border rounded" />
                        </td>
                        <td className="px-6 py-4">
                          <input type="number" value={editForm.totalAllowances} onChange={e => setEditForm({...editForm, totalAllowances: Number(e.target.value)})} className="w-24 px-2 py-1 border rounded" />
                        </td>
                        <td className="px-6 py-4">
                          <input type="number" value={editForm.totalDeductions} onChange={e => setEditForm({...editForm, totalDeductions: Number(e.target.value)})} className="w-24 px-2 py-1 border rounded" />
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">{school?.currency} {((editForm.basicSalary || 0) + (editForm.totalAllowances || 0)).toLocaleString()}</td>
                        <td className="px-6 py-4 font-black text-primary">{school?.currency} {((editForm.basicSalary || 0) + (editForm.totalAllowances || 0) - (editForm.totalDeductions || 0)).toLocaleString()}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-gray-600">{school?.currency} {(entry.basicSalary || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-green-600">+{school?.currency} {(totalAllowances || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-red-600">-{school?.currency} {(totalDeductions || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">{school?.currency} {(entry.grossPay || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 font-black text-primary">{school?.currency} {(entry.netPay || 0).toLocaleString()}</td>
                      </>
                    )}
                    
                    <td className="px-6 py-4 text-right">
                      {selectedPeriod?.status === 'draft' && (
                        <div className="flex items-center justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button onClick={() => saveEdit(entry.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Save className="h-4 w-4" /></button>
                              <button onClick={() => setEditingEntryId(null)} className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-lg"><X className="h-4 w-4" /></button>
                            </>
                          ) : (
                            <button onClick={() => startEditing(entry)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="h-4 w-4" /></button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
