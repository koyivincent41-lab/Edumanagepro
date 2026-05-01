import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { School, Subject, Class } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { useBranch } from '../context/BranchContext';

const subjectSchema = z.object({
  name: z.string().min(2, 'Subject name is required'),
  code: z.string().min(1, 'Subject code is required'),
  category: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

type SubjectFormValues = z.infer<typeof subjectSchema>;

export default function SubjectForm({ 
  school, 
  subject, 
  onClose 
}: { 
  school: School, 
  subject?: Subject | null, 
  onClose: () => void 
}) {
  const { currentBranch } = useBranch();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: subject ? {
      name: subject.name,
      code: subject.code,
      category: subject.category || '',
      description: subject.description || '',
      status: subject.status || 'active',
    } : {
      status: 'active',
    }
  });

  const onSubmit = async (data: SubjectFormValues) => {
    setLoading(true);
    try {
      const subjectData = {
        ...data,
        schoolId: school.id,
        ...(currentBranch ? { branchId: currentBranch.id } : {}),
        updatedAt: new Date().toISOString(),
        ...(subject ? {} : { createdAt: new Date().toISOString() }),
      };

      if (subject) {
        await updateDoc(doc(db, 'subjects', subject.id), subjectData);
        toast.success('Subject updated successfully');
      } else {
        // Check for duplicates
        const q = query(
          collection(db, 'subjects'), 
          where('schoolId', '==', school.id),
          where('name', '==', data.name)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          toast.error('A subject with this name already exists');
          setLoading(false);
          return;
        }

        await addDoc(collection(db, 'subjects'), subjectData);
        toast.success('Subject created successfully');
      }
      onClose();
    } catch (error) {
      console.error('Error saving subject:', error);
      toast.error('Failed to save subject');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{subject ? 'Edit' : 'Add'} Subject</h2>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Subject Name</label>
            <input {...register('name')} placeholder="e.g. Mathematics" className="w-full p-2 border rounded" />
            {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Subject Code</label>
            <input {...register('code')} placeholder="e.g. MAT101" className="w-full p-2 border rounded" />
            {errors.code && <p className="text-red-500 text-xs">{errors.code.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Category</label>
            <select {...register('category')} className="w-full p-2 border rounded">
              <option value="">Select Category</option>
              <option value="Languages">Languages</option>
              <option value="Sciences">Sciences</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Humanities">Humanities</option>
              <option value="Technical">Technical</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
            <select {...register('status')} className="w-full p-2 border rounded">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
            <textarea {...register('description')} placeholder="Optional description" className="w-full p-2 border rounded h-20" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-primary text-white rounded-lg flex items-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Subject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
