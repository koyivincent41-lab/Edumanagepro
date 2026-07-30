import React, { useState, useEffect } from 'react';
import { School, Loan, Employee, SalaryAdvance } from '../../../types';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, X, CheckCircle, AlertCircle, DollarSign } from 'lucide-react';

interface Props {
  schoolId: string;
  school: School | null;
}

export default function Loans({ schoolId, school }: Props) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);

  const [formData, setFormData] = useState<Partial<Loan & SalaryAdvance>>({
    employeeId: '',
    type: 'advance',
    amount: 0,
    interestRate: 0,
    repaymentMonths: 1,
    monthlyDeduction: 0,
    repaymentStartMonth: new Date().getMonth() + 1,
    repaymentStartYear: new Date().getFullYear(),
    status: 'pending',
    dateRequested: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const unsubLoans = onSnapshot(collection(db, 'schools', schoolId, 'loans'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      data.sort((a, b) => new Date(b.dateRequested || b.createdAt).getTime() - new Date(a.dateRequested || a.createdAt).getTime());
      setLoans(data);
      setLoading(false);
    });

    const unsubEmployees = onSnapshot(query(collection(db, 'schools', schoolId, 'employees'), where('payrollStatus', '==', 'active')), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(data);
    });

    return () => {
      unsubLoans();
      unsubEmployees();
    };
  }, [schoolId]);

  // Auto-calculate monthly deduction
  useEffect(() => {
    if (formData.amount && formData.repaymentMonths) {
      const principal = Number(formData.amount);
      const months = Number(formData.repaymentMonths);
      const interest = Number(formData.interestRate || 0);
      
      const totalInterest = principal * (interest / 100);
      const totalAmount = principal + totalInterest;
      const monthly = totalAmount / months;
      
      setFormData(prev => ({ ...prev, monthlyDeduction: monthly }));
    }
  }, [formData.amount, formData.repaymentMonths, formData.interestRate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const principal = Number(formData.amount);
      const interest = Number(formData.interestRate || 0);
      const totalInterest = principal * (interest / 100);
      const totalAmount = principal + totalInterest;

      const dataToSave = {
        ...formData,
        amount: principal,
        interestRate: interest,
        totalAmount,
        remainingBalance: totalAmount,
        amountPaid: 0,
        updatedAt: new Date().toISOString()
      };

      if (editingLoan) {
        await updateDoc(doc(db, 'schools', schoolId, 'loans', editingLoan.id), dataToSave);
        toast.success('Loan updated successfully');
      } else {
        await addDoc(collection(db, 'schools', schoolId, 'loans'), {
          ...dataToSave,
          schoolId,
          createdAt: new Date().toISOString(),
          repayments: [] // To track installments paid
        });
        toast.success('Loan requested successfully');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving loan:', error);
      toast.error('Failed to save loan');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schools', schoolId, 'loans', id));
      toast.success('Loan deleted successfully');
    } catch (error) {
      console.error('Error deleting loan:', error);
      toast.error('Failed to delete loan');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'approved') {
        updateData.dateApproved = new Date().toISOString().split('T')[0];
      }
      await updateDoc(doc(db, 'schools', schoolId, 'loans', id), updateData);
      toast.success(`Loan marked as ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      type: 'advance',
      amount: 0,
      interestRate: 0,
      repaymentMonths: 1,
      monthlyDeduction: 0,
      repaymentStartMonth: new Date().getMonth() + 1,
      repaymentStartYear: new Date().getFullYear(),
      status: 'pending',
      dateRequested: new Date().toISOString().split('T')[0],
    });
    setEditingLoan(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Loans & Advances</h2>
          <p className="text-sm text-gray-500">Manage employee financial requests</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-bold text-sm"
        >
          <Plus className="h-4 w-4" />
          New Request
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Active Loans</p>
          <p className="text-xl font-black text-gray-900">{loans.filter(l => l.status === 'approved').length}</p>
        </div>
        <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pending Requests</p>
          <p className="text-xl font-black text-orange-600">{loans.filter(l => l.status === 'pending').length}</p>
        </div>
        <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Outstanding</p>
          <p className="text-xl font-black text-primary">
            {school?.currency} {loans.filter(l => l.status === 'approved').reduce((sum, l) => sum + (l.remainingBalance || 0), 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[700px] w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-4 font-bold">Employee</th>
                <th className="px-4 md:px-6 py-4 font-bold">Type</th>
                <th className="px-4 md:px-6 py-4 font-bold">Amount</th>
                <th className="px-4 md:px-6 py-4 font-bold">Balance</th>
                <th className="px-4 md:px-6 py-4 font-bold">Monthly Ded.</th>
                <th className="px-4 md:px-6 py-4 font-bold">Status</th>
                <th className="px-4 md:px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 md:px-6 py-4 md:py-8 text-center text-gray-500">
                    No loans or advances found.
                  </td>
                </tr>
              ) : (
                loans.map((loan) => {
                  const emp = employees.find(e => e.id === loan.employeeId);
                  return (
                    <tr key={loan.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-900">{emp?.fullName || 'Unknown'}</td>
                      <td className="px-4 md:px-6 py-4 capitalize">{loan.type}</td>
                      <td className="px-4 md:px-6 py-4 font-medium">{school?.currency} {loan.amount.toLocaleString()}</td>
                      <td className="px-4 md:px-6 py-4 font-bold text-primary">{school?.currency} {(loan.remainingBalance || 0).toLocaleString()}</td>
                      <td className="px-4 md:px-6 py-4 text-red-600">-{school?.currency} {loan.monthlyDeduction.toLocaleString()}</td>
                      <td className="px-4 md:px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                          loan.status === 'approved' ? 'bg-green-100 text-green-700' : 
                          loan.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                          loan.status === 'paid' ? 'bg-blue-100 text-blue-700' : 
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {(loan.status || 'pending').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {loan.status === 'pending' && (
                            <>
                              <button onClick={() => handleUpdateStatus(loan.id, 'approved')} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Approve">
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleUpdateStatus(loan.id, 'rejected')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Reject">
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => {
                              setEditingLoan(loan);
                              setFormData(loan);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(loan.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-[calc(100%-2rem)] md:w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingLoan ? 'Edit Request' : 'New Loan/Advance Request'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Employee</label>
                <select
                  required
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.staffNumber})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'loan' | 'advance' })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="advance">Salary Advance</option>
                    <option value="loan">Loan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="paid">Paid Off</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Amount ({school?.currency})</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Interest Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.interestRate}
                    onChange={(e) => setFormData({ ...formData, interestRate: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Repayment Start Month</label>
                  <select
                    required
                    value={formData.repaymentStartMonth}
                    onChange={(e) => setFormData({ ...formData, repaymentStartMonth: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(0, i).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Repayment Start Year</label>
                  <select
                    required
                    value={formData.repaymentStartYear}
                    onChange={(e) => setFormData({ ...formData, repaymentStartYear: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {Array.from({ length: 5 }, (_, i) => (
                      <option key={i} value={new Date().getFullYear() + i}>
                        {new Date().getFullYear() + i}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Repayment Months</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.repaymentMonths}
                    onChange={(e) => setFormData({ ...formData, repaymentMonths: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Monthly Deduction</label>
                  <input
                    type="number"
                    readOnly
                    value={formData.monthlyDeduction?.toFixed(2)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 md:px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 font-bold transition-colors"
                >
                  {editingLoan ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
