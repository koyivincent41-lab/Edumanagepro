import React, { useState, useEffect } from 'react';
import { School, PayrollPeriod } from '../../../types';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, X, Calendar } from 'lucide-react';

interface Props {
  schoolId: string;
  school: School | null;
}

export default function Periods({ schoolId, school }: Props) {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [formData, setFormData] = useState<Partial<PayrollPeriod>>(() => {
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const start = `${year}-${String(month).padStart(2, '0')}-25`;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const endDay = Math.min(30, lastDayOfMonth);
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    let payYear = year;
    let payMonth = month + 1;
    if (payMonth > 12) {
      payMonth = 1;
      payYear++;
    }
    const payment = `${payYear}-${String(payMonth).padStart(2, '0')}-05`;

    return {
      month: month,
      year: year,
      startDate: start,
      endDate: end,
      paymentDate: payment,
      status: 'draft'
    };
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'schools', schoolId, 'payroll_periods'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollPeriod));
      // Sort by year and month descending
      data.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
      setPeriods(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [schoolId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Check for duplicates if creating new
      if (!editingId) {
        const isDuplicate = periods.some(p => p.month === formData.month && p.year === formData.year);
        if (isDuplicate) {
          toast.error('A payroll period for this month and year already exists.');
          return;
        }
      }

      if (editingId) {
        await updateDoc(doc(db, 'schools', schoolId, 'payroll_periods', editingId), {
          ...formData
        });
        toast.success('Payroll period updated successfully');
      } else {
        await addDoc(collection(db, 'schools', schoolId, 'payroll_periods'), {
          ...formData,
          schoolId,
          createdAt: new Date().toISOString()
        });
        toast.success('Payroll period created successfully');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving period:', error);
      toast.error('Failed to save payroll period');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schools', schoolId, 'payroll_periods', id));
      toast.success('Payroll period deleted successfully');
    } catch (error) {
      console.error('Error deleting period:', error);
      toast.error('Failed to delete payroll period');
    }
  };

  const editPeriod = (period: PayrollPeriod) => {
    setFormData(period);
    setEditingId(period.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    const year = currentYear;
    const month = currentMonth;
    
    // Start Date: 25th of current month
    const start = `${year}-${String(month).padStart(2, '0')}-25`;
    
    // End Date: 30th of current month
    // Handle February and months with 30/31 days
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const endDay = Math.min(30, lastDayOfMonth);
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    
    // Payment Date: 5th of next month
    let payYear = year;
    let payMonth = month + 1;
    if (payMonth > 12) {
      payMonth = 1;
      payYear++;
    }
    const payment = `${payYear}-${String(payMonth).padStart(2, '0')}-05`;

    setFormData({
      month: month,
      year: year,
      startDate: start,
      endDate: end,
      paymentDate: payment,
      status: 'draft'
    });
    setEditingId(null);
  };

  const updateDefaultDates = (month: number, year: number) => {
    const start = `${year}-${String(month).padStart(2, '0')}-25`;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const endDay = Math.min(30, lastDayOfMonth);
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    
    let payYear = year;
    let payMonth = month + 1;
    if (payMonth > 12) {
      payMonth = 1;
      payYear++;
    }
    const payment = `${payYear}-${String(payMonth).padStart(2, '0')}-05`;

    setFormData(prev => ({
      ...prev,
      month,
      year,
      startDate: start,
      endDate: end,
      paymentDate: payment
    }));
  };

  const getMonthName = (month: number) => {
    const date = new Date();
    date.setMonth(month - 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'pending_approval': return 'bg-orange-100 text-orange-700';
      case 'approved': return 'bg-blue-100 text-blue-700';
      case 'paid': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">Payroll Periods</h2>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-school-gradient text-white rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all font-bold text-sm"
        >
          <Plus className="h-4 w-4" />
          Create Period
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50">
            <tr>
              <th className="px-6 py-3 rounded-tl-xl">Period</th>
              <th className="px-6 py-3">Start Date</th>
              <th className="px-6 py-3">End Date</th>
              <th className="px-6 py-3">Payment Date</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 rounded-tr-xl text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No payroll periods found.
                </td>
              </tr>
            ) : (
              periods.map((period) => (
                <tr key={period.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {getMonthName(period.month)} {period.year}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{period.startDate}</td>
                  <td className="px-6 py-4 text-gray-600">{period.endDate}</td>
                  <td className="px-6 py-4 text-gray-600">{period.paymentDate}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${getStatusColor(period.status)}`}>
                      {(period.status || 'draft').replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => editPeriod(period)} 
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(period.id)} 
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-black text-gray-900">
                {editingId ? 'Edit Payroll Period' : 'Create Payroll Period'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Month</label>
                  <select
                    value={formData.month}
                    onChange={(e) => updateDefaultDates(Number(e.target.value), formData.year || currentYear)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{getMonthName(m)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    required
                    min="2020"
                    max="2050"
                    value={formData.year}
                    onChange={(e) => updateDefaultDates(formData.month || currentMonth, Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Expected Payment Date</label>
                <input
                  type="date"
                  required
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({...formData, paymentDate: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {editingId && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="draft">Draft</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="approved">Approved</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}
              
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-school-gradient text-white rounded-xl hover:shadow-lg hover:shadow-primary/20 font-bold transition-all"
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
