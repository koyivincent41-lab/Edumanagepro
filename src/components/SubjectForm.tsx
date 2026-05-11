import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, X, Check } from 'lucide-react';
import { School, Subject, Class } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { useBranch } from '../context/BranchContext';

const subjectSchema = z.object({
  name: z.string().min(2, 'Subject name is required'),
  code: z.string().min(1, 'Subject code is required'),
  category: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']),
  classIds: z.array(z.string()).optional(),
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
  const [classes, setClasses] = useState<Class[]>([]);
  const [fetchingClasses, setFetchingClasses] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: subject ? {
      name: subject.name,
      code: subject.code,
      category: subject.category || '',
      description: subject.description || '',
      status: subject.status || 'active',
      classIds: [],
    } : {
      status: 'active',
      classIds: [],
    }
  });

  const selectedClassIds = watch('classIds') || [];

  useEffect(() => {
    const fetchClasses = async () => {
      setFetchingClasses(true);
      try {
        let q = query(collection(db, 'schools', school.id, 'classes'));
        if (currentBranch) {
          q = query(q, where('branchId', '==', currentBranch.id));
        }
        const snap = await getDocs(q);
        setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));

        // If editing, fetch current assignments
        if (subject) {
          const assignmentsQ = query(
            collection(db, 'class_subjects'),
            where('subjectId', '==', subject.id)
          );
          const assignmentsSnap = await getDocs(assignmentsQ);
          const currentClassIds = assignmentsSnap.docs.map(d => d.data().classId);
          setValue('classIds', currentClassIds);
        }
      } catch (error) {
        console.error('Error fetching classes:', error);
      } finally {
        setFetchingClasses(false);
      }
    };
    fetchClasses();
  }, [school.id, currentBranch, subject, setValue]);

  const toggleClass = (classId: string) => {
    const current = [...selectedClassIds];
    const index = current.indexOf(classId);
    if (index === -1) {
      current.push(classId);
    } else {
      current.splice(index, 1);
    }
    setValue('classIds', current);
  };

  const onSubmit = async (data: SubjectFormValues) => {
    setLoading(true);
    try {
      const { classIds, ...rest } = data;
      const subjectData = {
        ...rest,
        schoolId: school.id,
        ...(currentBranch ? { branchId: currentBranch.id } : {}),
        updatedAt: new Date().toISOString(),
        ...(subject ? {} : { createdAt: new Date().toISOString() }),
      };

      let subjectId = subject?.id;

      if (subject) {
        await updateDoc(doc(db, 'subjects', subject.id), subjectData);
        subjectId = subject.id;
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

        const docRef = await addDoc(collection(db, 'subjects'), subjectData);
        subjectId = docRef.id;
      }

      // Sync class assignments
      if (subjectId && classIds) {
        const batch = writeBatch(db);
        
        // Remove old assignments if editing
        if (subject) {
          const oldSnap = await getDocs(query(collection(db, 'class_subjects'), where('subjectId', '==', subjectId)));
          oldSnap.docs.forEach(d => batch.delete(d.ref));
        }

        // Add new assignments
        classIds.forEach(cId => {
          const newLinkRef = doc(collection(db, 'class_subjects'));
          batch.set(newLinkRef, {
            schoolId: school.id,
            branchId: currentBranch?.id || null,
            classId: cId,
            subjectId: subjectId,
            teacherId: null,
            teacherName: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });

        await batch.commit();
      }

      toast.success(subject ? 'Subject updated successfully' : 'Subject created and linked to classes successfully');
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
      <div className="bg-white rounded-2xl shadow-xl w-[calc(100%-2rem)] md:w-full max-w-md p-4 md:p-6">
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

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
              Link to Classes
              {selectedClassIds.length > 0 && (
                <span className="text-primary normal-case">
                  {selectedClassIds.length} selected
                </span>
              )}
            </label>
            <div className="border rounded-xl p-3 bg-gray-50/50 max-h-32 overflow-y-auto space-y-2">
              {fetchingClasses ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              ) : classes.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2">No classes found in system</p>
              ) : (
                <div className="grid grid-cols-1 gap-1">
                  {classes.map((cls) => {
                    const isSelected = selectedClassIds.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => toggleClass(cls.id)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          isSelected 
                            ? 'bg-primary text-white shadow-sm' 
                            : 'bg-white text-gray-600 border border-gray-100 hover:border-primary/30'
                        }`}
                      >
                        {cls.name}
                        {isSelected && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-[10px] text-gray-400 italic">Select one or more classes to link this subject to.</p>
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
            <button type="submit" disabled={loading} className="px-4 md:px-6 py-2 bg-primary text-white rounded-lg flex items-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Subject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
