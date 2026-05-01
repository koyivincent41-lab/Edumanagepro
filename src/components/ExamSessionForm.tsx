import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { School, ExamSession, Class, Subject } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { useBranch } from '../context/BranchContext';

const sessionSchema = z.object({
  examName: z.string().min(2, 'Exam name is required'),
  examType: z.enum(['Openar', 'Opener', 'Midterm', 'End Term']),
  academicYear: z.string().min(4, 'Academic year is required'),
  term: z.enum(['Term 1', 'Term 2', 'Term 3']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  maximumScore: z.number().min(1, 'Maximum score must be at least 1'),
  status: z.enum(['Draft', 'Open', 'Closed', 'Published']),
  applicableClasses: z.array(z.string()).min(1, 'Select at least one class'),
  applicableSubjects: z.array(z.string()).min(1, 'Select at least one subject'),
});

type SessionFormValues = z.infer<typeof sessionSchema>;

export default function ExamSessionForm({ 
  school, 
  session, 
  onClose 
}: { 
  school: School, 
  session?: ExamSession | null, 
  onClose: () => void 
}) {
  const { currentBranch } = useBranch();
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: session ? {
      ...session,
    } : {
      academicYear: school.academicYear,
      term: school.currentTerm,
      examType: 'End Term',
      maximumScore: 100,
      status: 'Draft',
      applicableClasses: [],
      applicableSubjects: [],
    }
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        let classesQ = query(collection(db, 'schools', school.id, 'classes'));
        let subjectsQ = query(collection(db, 'subjects'), where('schoolId', '==', school.id));

        if (currentBranch) {
          classesQ = query(classesQ, where('branchId', '==', currentBranch.id));
          subjectsQ = query(subjectsQ, where('branchId', '==', currentBranch.id));
        }

        const [classesSnap, subjectsSnap] = await Promise.all([
          getDocs(classesQ),
          getDocs(subjectsQ)
        ]);

        setClasses(classesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
        setSubjects(subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
      } catch (error) {
        console.error("Error fetching data for form:", error);
      }
    };
    fetchData();
  }, [school.id, currentBranch]);

  const onSubmit = async (data: SessionFormValues) => {
    setLoading(true);
    try {
      const sessionData = {
        ...data,
        schoolId: school.id,
        ...(currentBranch ? { branchId: currentBranch.id } : {}),
        updatedAt: new Date().toISOString(),
      };

      if (session) {
        await updateDoc(doc(db, 'exam_sessions', session.id), sessionData);
        toast.success('Exam session updated successfully');
      } else {
        await addDoc(collection(db, 'exam_sessions'), {
          ...sessionData,
          createdAt: new Date().toISOString(),
        });
        toast.success('Exam session created successfully');
      }
      onClose();
    } catch (error) {
      console.error('Error saving exam session:', error);
      toast.error('Failed to save exam session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{session ? 'Edit' : 'Create'} Exam Session</h2>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Exam Name</label>
              <input {...register('examName')} placeholder="e.g. End of Term 1 Exams" className="w-full p-2 border rounded" />
              {errors.examName && <p className="text-red-500 text-xs">{errors.examName.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Exam Type</label>
              <select {...register('examType')} className="w-full p-2 border rounded">
                <option value="Openar">Openar</option>
                <option value="Midterm">Midterm</option>
                <option value="End Term">End Term</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Academic Year</label>
              <select {...register('academicYear')} className="w-full p-2 border rounded">
                {Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              {errors.academicYear && <p className="text-red-500 text-xs">{errors.academicYear.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Term</label>
              <select {...register('term')} className="w-full p-2 border rounded">
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Start Date</label>
              <input type="date" {...register('startDate')} className="w-full p-2 border rounded" />
              {errors.startDate && <p className="text-red-500 text-xs">{errors.startDate.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">End Date</label>
              <input type="date" {...register('endDate')} className="w-full p-2 border rounded" />
              {errors.endDate && <p className="text-red-500 text-xs">{errors.endDate.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Maximum Score</label>
              <input type="number" {...register('maximumScore', { valueAsNumber: true })} className="w-full p-2 border rounded" />
              {errors.maximumScore && <p className="text-red-500 text-xs">{errors.maximumScore.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
              <select {...register('status')} className="w-full p-2 border rounded">
                <option value="Draft">Draft</option>
                <option value="Open">Open (Teachers can enter marks)</option>
                <option value="Closed">Closed (Marks entry disabled)</option>
                <option value="Published">Published (Results visible to parents)</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Applicable Classes</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 max-h-48 overflow-y-auto">
              {classes.map(c => (
                <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-xl transition-colors cursor-pointer group">
                  <input
                    type="checkbox"
                    value={c.id}
                    {...register('applicableClasses')}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary transition-all"
                  />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-primary transition-colors">{c.name}</span>
                </label>
              ))}
            </div>
            {errors.applicableClasses && <p className="text-red-500 text-xs font-bold">{errors.applicableClasses.message}</p>}
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Applicable Subjects</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 max-h-48 overflow-y-auto">
              {subjects.map(s => (
                <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-xl transition-colors cursor-pointer group">
                  <input
                    type="checkbox"
                    value={s.id}
                    {...register('applicableSubjects')}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary transition-all"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-700 group-hover:text-primary transition-colors">{s.name}</span>
                    <span className="text-[10px] text-gray-400">{s.code}</span>
                  </div>
                </label>
              ))}
            </div>
            {errors.applicableSubjects && <p className="text-red-500 text-xs font-bold">{errors.applicableSubjects.message}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-primary text-white rounded-lg flex items-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
