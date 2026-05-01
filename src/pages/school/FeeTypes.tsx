import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Loader2, 
  Edit2,
  Trash2,
  X,
  Tag,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { FeeType, School } from '../../types';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useBranch } from '../../context/BranchContext';

const feeTypeSchema = z.object({
  name: z.string().min(1, 'Fee name is required'),
  description: z.string().optional(),
  amount: z.number().min(0, 'Amount must be positive'),
  frequency: z.enum(['once', 'termly', 'yearly', 'monthly']),
  isOptional: z.boolean(),
});

type FeeTypeForm = z.infer<typeof feeTypeSchema>;

export default function FeeTypes({ schoolId, school }: { schoolId: string, school: School | null }) {
  const { currentBranch } = useBranch();
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [feeTypeToDelete, setFeeTypeToDelete] = useState<FeeType | null>(null);
  const [editingFeeType, setEditingFeeType] = useState<FeeType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FeeTypeForm>({
    resolver: zodResolver(feeTypeSchema),
    defaultValues: {
      name: '',
      description: '',
      amount: 0,
      frequency: 'termly',
      isOptional: false,
    }
  });

  useEffect(() => {
    if (!schoolId) return;
    let q = query(collection(db, 'schools', schoolId, 'feeTypes'));
    if (currentBranch) {
      q = query(q, where('branchId', '==', currentBranch.id));
    }
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const feeTypeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeeType));
      setFeeTypes(feeTypeData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [schoolId, currentBranch]);

  useEffect(() => {
    if (editingFeeType) {
      reset({
        name: editingFeeType.name,
        description: editingFeeType.description || '',
        amount: editingFeeType.amount,
        frequency: editingFeeType.frequency,
        isOptional: editingFeeType.isOptional,
      });
    } else {
      reset({
        name: '',
        description: '',
        amount: 0,
        frequency: 'termly',
        isOptional: false,
      });
    }
  }, [editingFeeType, reset]);

  const onSubmit = async (data: FeeTypeForm) => {
    try {
      if (editingFeeType) {
        await updateDoc(doc(db, 'schools', schoolId, 'feeTypes', editingFeeType.id), {
          ...data,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          updatedAt: new Date().toISOString(),
        });
        toast.success('Fee type updated successfully');
      } else {
        await addDoc(collection(db, 'schools', schoolId, 'feeTypes'), {
          ...data,
          schoolId,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          status: 'active',
          createdAt: new Date().toISOString(),
        });
        toast.success('Fee type added successfully');
      }
      setIsModalOpen(false);
      setEditingFeeType(null);
      reset();
    } catch (error) {
      console.error('Error saving fee type:', error);
      toast.error('Failed to save fee type');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schools', schoolId, 'feeTypes', id));
      toast.success('Fee type deleted successfully');
      setIsDeleteConfirmOpen(false);
      setFeeTypeToDelete(null);
    } catch (error) {
      toast.error('Failed to delete fee type');
    }
  };

  const filteredFeeTypes = feeTypes.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Fee Types Management</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Define and manage different school fees.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                type="text"
                placeholder="Search fee types..."
                className="pl-10 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder:text-white/40 focus:bg-white/20 outline-none w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => {
                setEditingFeeType(null);
                setIsModalOpen(true);
              }}
              className="px-6 py-2.5 bg-white text-maroon font-black uppercase tracking-widest text-[10px] rounded-xl shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Fee Type
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFeeTypes.map((fee) => (
          <div key={fee.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-school-gradient/10 rounded-2xl flex items-center justify-center text-primary font-bold text-lg">
                  <Tag className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{fee.name}</h3>
                  <span className="text-xs text-gray-500 uppercase tracking-widest">{fee.frequency}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => {
                    setEditingFeeType(fee);
                    setIsModalOpen(true);
                  }}
                  className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => {
                    setFeeTypeToDelete(fee);
                    setIsDeleteConfirmOpen(true);
                  }}
                  className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1 text-primary font-black text-xl">
                <span className="text-sm font-bold opacity-50">{school?.currency || 'KES'}</span>
                {fee.amount.toLocaleString()}
              </div>
              {fee.isOptional && (
                <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase">Optional</span>
              )}
            </div>
            {fee.description && (
              <p className="mt-3 text-sm text-gray-500 line-clamp-2">{fee.description}</p>
            )}
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">{editingFeeType ? 'Edit Fee Type' : 'Add New Fee Type'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Fee Name</label>
                <input
                  {...register('name')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  placeholder="e.g. Tuition Fee, Transport"
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description (Optional)</label>
                <textarea
                  {...register('description')}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all resize-none"
                  placeholder="Brief description of the fee"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      {...register('amount', { valueAsNumber: true })}
                      type="number"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                  {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Frequency</label>
                  <select
                    {...register('frequency')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all bg-white"
                  >
                    <option value="once">Once</option>
                    <option value="monthly">Monthly</option>
                    <option value="termly">Termly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isOptional"
                  {...register('isOptional')}
                  className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="isOptional" className="text-sm font-semibold text-gray-700">This is an optional fee</label>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-school-gradient text-white font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
                  {editingFeeType ? 'Update Fee' : 'Save Fee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && feeTypeToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Fee Type?</h3>
              <p className="text-gray-500 mb-8">
                Are you sure you want to delete <span className="font-bold text-gray-900">{feeTypeToDelete.name}</span>? 
                This action cannot be undone and may affect billing records.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setFeeTypeToDelete(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(feeTypeToDelete.id)}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:scale-105 transition-all"
                >
                  Delete Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
