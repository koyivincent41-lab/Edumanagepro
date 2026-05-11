import React, { useState, useEffect } from 'react';
import { School, SalaryStructure } from '../../../types';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, X, Layers } from 'lucide-react';

interface Props {
  schoolId: string;
  school: School | null;
}

export default function SalaryStructures({ schoolId, school }: Props) {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [allowances, setAllowances] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState<SalaryStructure | null>(null);

  const [formData, setFormData] = useState<Partial<SalaryStructure>>({
    name: '',
    description: '',
    baseSalary: 0,
    allowanceIds: [],
    deductionIds: []
  });

  useEffect(() => {
    const unsubStructures = onSnapshot(collection(db, 'schools', schoolId, 'salary_structures'), (snap) => {
      setStructures(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalaryStructure)));
      setLoading(false);
    });
    const unsubEmployees = onSnapshot(collection(db, 'schools', schoolId, 'employees'), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAllowances = onSnapshot(collection(db, 'schools', schoolId, 'allowances'), (snap) => {
      setAllowances(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubDeductions = onSnapshot(collection(db, 'schools', schoolId, 'deductions'), (snap) => {
      setDeductions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubStructures();
      unsubEmployees();
      unsubAllowances();
      unsubDeductions();
    };
  }, [schoolId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStructure) {
        await updateDoc(doc(db, 'schools', schoolId, 'salary_structures', editingStructure.id), formData);
        toast.success('Salary structure updated successfully');
      } else {
        await addDoc(collection(db, 'schools', schoolId, 'salary_structures'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
        toast.success('Salary structure created successfully');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving structure:', error);
      toast.error('Failed to save structure');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schools', schoolId, 'salary_structures', id));
      toast.success('Salary structure deleted successfully');
    } catch (error) {
      console.error('Error deleting structure:', error);
      toast.error('Failed to delete structure');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      baseSalary: 0,
      allowanceIds: [],
      deductionIds: []
    });
    setEditingStructure(null);
  };

  const toggleSelection = (type: 'allowanceIds' | 'deductionIds', id: string) => {
    setFormData(prev => {
      const current = prev[type] || [];
      if (current.includes(id)) {
        return { ...prev, [type]: current.filter(itemId => itemId !== id) };
      } else {
        return { ...prev, [type]: [...current, id] };
      }
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Salary Structures</h2>
          <p className="text-sm text-gray-500">Define standardized pay grades and packages</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-bold text-sm"
        >
          <Plus className="h-4 w-4" />
          New Structure
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {structures.length === 0 ? (
          <div className="col-span-full p-4 md:p-8 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">
            No salary structures defined yet.
          </div>
        ) : (
          structures.map(structure => (
            <div key={structure.id} className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{structure.name}</h3>
                    <p className="text-xs text-gray-500">{structure.description}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingStructure(structure); setFormData(structure); setIsModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(structure.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="mt-auto space-y-4">
                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                  <span className="text-sm text-gray-500">Linked Employees</span>
                  <span className="font-bold text-blue-600">{employees.filter(e => e.salaryStructureId === structure.id).length}</span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="text-sm text-gray-500">Base Salary</span>
                  <span className="font-bold text-gray-900">{school?.currency} {(structure.baseSalary || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                  <span className="text-sm text-gray-500">Linked Allowances</span>
                  <span className="font-bold text-green-600">{structure.allowanceIds?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Linked Deductions</span>
                  <span className="font-bold text-red-600">{structure.deductionIds?.length || 0}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-[calc(100%-2rem)] md:w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingStructure ? 'Edit Structure' : 'New Salary Structure'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Structure Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="e.g. Senior Teacher Grade 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Base Salary ({school?.currency})</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.baseSalary}
                    onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-3">
                  <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2">Allowances</h3>
                  {allowances.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No allowances defined.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {allowances.map(allow => (
                        <label key={allow.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer border border-transparent hover:border-gray-200">
                          <input
                            type="checkbox"
                            checked={formData.allowanceIds?.includes(allow.id)}
                            onChange={() => toggleSelection('allowanceIds', allow.id)}
                            className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">{allow.name}</p>
                            <p className="text-xs text-gray-500">{allow.type === 'fixed' ? `${school?.currency} ${allow.amount}` : `${allow.amount}%`}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2">Deductions</h3>
                  {deductions.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No deductions defined.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {deductions.map(ded => (
                        <label key={ded.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer border border-transparent hover:border-gray-200">
                          <input
                            type="checkbox"
                            checked={formData.deductionIds?.includes(ded.id)}
                            onChange={() => toggleSelection('deductionIds', ded.id)}
                            className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">{ded.name}</p>
                            <p className="text-xs text-gray-500">{ded.type === 'fixed' ? `${school?.currency} ${ded.amount}` : `${ded.amount}%`}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
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
                  {editingStructure ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
