import React, { useState, useEffect } from 'react';
import { School, PayrollAllowance } from '../../../types';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

interface Props {
  schoolId: string;
  school: School | null;
}

export default function Allowances({ schoolId, school }: Props) {
  const [allowances, setAllowances] = useState<PayrollAllowance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<PayrollAllowance>>({
    name: '',
    type: 'fixed',
    amount: 0,
    isRecurring: true,
    isTaxable: true,
    assignedTo: 'all',
    employeeIds: []
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'schools', schoolId, 'allowances'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollAllowance));
      setAllowances(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [schoolId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'schools', schoolId, 'allowances', editingId), {
          ...formData
        });
        toast.success('Allowance updated successfully');
      } else {
        await addDoc(collection(db, 'schools', schoolId, 'allowances'), {
          ...formData,
          schoolId
        });
        toast.success('Allowance added successfully');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving allowance:', error);
      toast.error('Failed to save allowance');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schools', schoolId, 'allowances', id));
      toast.success('Allowance deleted successfully');
    } catch (error) {
      console.error('Error deleting allowance:', error);
      toast.error('Failed to delete allowance');
    }
  };

  const editAllowance = (allowance: PayrollAllowance) => {
    setFormData(allowance);
    setEditingId(allowance.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'fixed',
      amount: 0,
      isRecurring: true,
      isTaxable: true,
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
        <h2 className="text-lg font-bold text-gray-900">Allowances</h2>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-school-gradient text-white rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all font-bold text-sm"
        >
          <Plus className="h-4 w-4" />
          Add Allowance
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allowances.length === 0 ? (
          <div className="col-span-full text-center py-4 md:py-8 text-gray-500">
            No allowances configured.
          </div>
        ) : (
          allowances.map((allowance) => (
            <div key={allowance.id} className="p-5 rounded-2xl border border-gray-100 bg-gray-50 hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">{allowance.name}</h3>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">
                    {allowance.isRecurring ? 'Recurring' : 'One-time'} • {allowance.isTaxable ? 'Taxable' : 'Non-taxable'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => editAllowance(allowance)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(allowance.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="text-xl font-black text-gray-900">
                    {allowance.type === 'fixed' ? `${school?.currency} ${allowance.amount.toLocaleString()}` : `${allowance.amount}% of Basic`}
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-gray-200 text-gray-700 text-xs font-bold rounded-full">
                  {allowance.assignedTo === 'all' ? 'All Staff' : 'Specific Staff'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-[calc(100%-2rem)] md:w-full max-w-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 p-4 md:p-6 border-b border-gray-100">
              <h2 className="text-xl font-black text-gray-900">
                {editingId ? 'Edit Allowance' : 'Add Allowance'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Allowance Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="e.g. House Allowance"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    checked={formData.isTaxable}
                    onChange={(e) => setFormData({...formData, isTaxable: e.target.checked})}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-bold text-gray-700">Taxable</span>
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
                  className="px-4 md:px-6 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 md:px-6 py-2 bg-school-gradient text-white rounded-xl hover:shadow-lg hover:shadow-primary/20 font-bold transition-all"
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
