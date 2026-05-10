import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  DollarSign, 
  Loader2,
  Calendar,
  X,
  Tag,
  FileText,
  Edit,
  Trash2
} from 'lucide-react';
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { School } from '../../types';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useBranch } from '../../context/BranchContext';

const expenseSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  amount: z.number().min(1, 'Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  date: z.string().min(1, 'Date is required'),
  description: z.string().optional(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

export default function Expenses({ schoolId, school }: { schoolId: string; school: School | null }) {
  const { currentBranch } = useBranch();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
    },
  });

  useEffect(() => {
    if (!schoolId) return;
    
    let expensesQuery = query(
      collection(db, 'schools', schoolId, 'expenses'),
      where('academicYear', '==', school?.academicYear || '')
    );
    if (currentBranch) expensesQuery = query(expensesQuery, where('branchId', '==', currentBranch.id));

    const unsub = onSnapshot(
      expensesQuery, 
      (snap) => {
        setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );
    return () => unsub();
  }, [schoolId, school?.academicYear, currentBranch]);

  const onSubmit = async (data: ExpenseForm) => {
    try {
      if (editingExpense) {
        await updateDoc(doc(db, 'schools', schoolId, 'expenses', editingExpense.id), {
          ...data,
          updatedAt: new Date().toISOString(),
        });
        toast.success('Expense updated successfully');
      } else {
        await addDoc(collection(db, 'schools', schoolId, 'expenses'), {
          ...data,
          academicYear: school?.academicYear || '',
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          createdAt: new Date().toISOString(),
        });
        toast.success('Expense recorded successfully');
      }
      handleCloseModal();
    } catch (error) {
      console.error('Error recording expense:', error);
      toast.error('Failed to save expense');
    }
  };

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    reset({
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      date: expense.date,
      description: expense.description || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await deleteDoc(doc(db, 'schools', schoolId, 'expenses', id));
        toast.success('Expense deleted successfully');
      } catch (error) {
        console.error('Error deleting expense:', error);
        toast.error('Failed to delete expense');
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    reset({
      title: '',
      amount: 0,
      category: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">School Expenses</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Track and manage school operational costs.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                type="text"
                placeholder="Search expenses..."
                className="pl-10 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder:text-white/40 focus:bg-white/20 outline-none w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => {
                setEditingExpense(null);
                reset({
                  title: '',
                  amount: 0,
                  category: '',
                  date: new Date().toISOString().split('T')[0],
                  description: '',
                });
                setIsModalOpen(true);
              }}
              className="px-6 py-2.5 bg-white text-maroon font-black uppercase tracking-widest text-[10px] rounded-xl shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Record Expense
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Expense</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-900">{expense.title}</p>
                    <p className="text-xs text-gray-500">{expense.description || 'No description'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold uppercase text-gray-600 flex items-center gap-1 w-fit">
                      <Tag className="h-3 w-3" />
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-extrabold text-red-600">{school?.currency} {expense.amount.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {new Date(expense.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(expense)}
                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit expense"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(expense.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete expense"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {expenses.length > 0 && (
                <tr className="bg-gray-50 font-bold">
                  <td className="px-6 py-4 text-gray-900" colSpan={2}>TOTAL</td>
                  <td className="px-6 py-4 text-red-600">
                    {school?.currency} {expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">{editingExpense ? 'Edit Expense' : 'Record Expense'}</h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Expense Title</label>
                <input
                  {...register('title')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all"
                  placeholder="e.g. Electricity Bill"
                />
                {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                      {school?.currency || '$'}
                    </div>
                    <input
                      {...register('amount', { valueAsNumber: true })}
                      type="number"
                      className="w-full pl-14 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                  <input
                    {...register('date')}
                    type="date"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                <select
                  {...register('category')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-maroon outline-none transition-all bg-white"
                >
                  <option value="">Select category...</option>
                  <option value="utilities">Utilities (Water, Electricity)</option>
                  <option value="rent">Rent</option>
                  <option value="salaries">Salaries & Wages</option>
                  <option value="maintenance">Maintenance & Repairs</option>
                  <option value="supplies">School Supplies</option>
                  <option value="marketing">Marketing</option>
                  <option value="other">Other</option>
                </select>
                {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description (Optional)</label>
                <textarea
                  {...register('description')}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-maroon outline-none transition-all resize-none"
                  placeholder="Additional details..."
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
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
                  {editingExpense ? 'Update Expense' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
