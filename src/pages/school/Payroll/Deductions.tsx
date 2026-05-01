import React, { useState, useEffect } from 'react';
import { School, PayrollDeduction } from '../../../types';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

interface Props {
  schoolId: string;
  school: School | null;
}

export default function Deductions({ schoolId, school }: Props) {
  const [deductions, setDeductions] = useState<PayrollDeduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<PayrollDeduction>>({
    name: '',
    type: 'fixed',
    amount: 0,
    isRecurring: true,
    isStatutory: false,
    assignedTo: 'all',
    employeeIds: []
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'schools', schoolId, 'deductions'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollDeduction));
      setDeductions(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [schoolId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'schools', schoolId, 'deductions', editingId), {
          ...formData
        });
        toast.success('Deduction updated successfully');
      } else {
        await addDoc(collection(db, 'schools', schoolId, 'deductions'), {
          ...formData,
          schoolId
        });
        toast.success('Deduction added successfully');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving deduction:', error);
      toast.error('Failed to save deduction');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schools', schoolId, 'deductions', id));
      toast.success('Deduction deleted successfully');
    } catch (error) {
      console.error('Error deleting deduction:', error);
      toast.error('Failed to delete deduction');
    }
  };

  const editDeduction = (deduction: PayrollDeduction) => {
    setFormData(deduction);
    setEditingId(deduction.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'fixed',
      amount: 0,
      isRecurring: true,
      isStatutory: false,
      assignedTo: 'all',
      employeeIds: []
    });
    setEditingId(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">Deductions</h2>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-school-gradient text-white rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all font-bold text-sm"
        >
          <Plus className="h-4 w-4" />
          Add Deduction
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {deductions.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            No deductions configured.
          </div>
        ) : (
          deductions.map((deduction) => (
            <div key={deduction.id} className="p-5 rounded-2xl border border-gray-100 bg-gray-50 hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">{deduction.name}</h3>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">
                    {deduction.isRecurring ? 'Recurring' : 'One-time'} • {deduction.isStatutory ? 'Statutory' : 'Non-statutory'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => editDeduction(deduction)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(deduction.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="text-xl font-black text-gray-900">
                    {deduction.type === 'fixed' ? `${school?.currency} ${deduction.amount.toLocaleString()}` : `${deduction.amount}% of Basic`}
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-gray-200 text-gray-700 text-xs font-bold rounded-full">
                  {deduction.assignedTo === 'all' ? 'All Staff' : 'Specific Staff'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-black text-gray-900">
                {editingId ? 'Edit Deduction' : 'Add Deduction'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Deduction Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="e.g. PAYE, NSSF, NHIF"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Value</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={formData.isRecurring}
                    onChange={(e) => setFormData({...formData, isRecurring: e.target.checked})}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-bold text-gray-700">Recurring</span>
                </label>
                <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={formData.isStatutory}
                    onChange={(e) => setFormData({...formData, isStatutory: e.target.checked})}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-bold text-gray-700">Statutory Tax</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Assigned To</label>
                <select
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({...formData, assignedTo: e.target.value as any})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="all">All Employees</option>
                  <option value="specific">Specific Employees</option>
                </select>
              </div>
              
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
                  {editingId ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
