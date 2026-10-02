import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, X, CheckSquare, Square } from 'lucide-react';
import { School, ExamSession, Class, Subject } from '../types';
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

  const today = new Date().toISOString().split('T')[0];
  const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const defaultYear = school?.academicYear || new Date().getFullYear().toString();
  const defaultTerm = (school?.currentTerm as any) || 'Term 1';

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: session ? {
      examName: session.examName || '',
      examType: (session.examType === 'Openar' ? 'Opener' : session.examType) || 'End Term',
      academicYear: session.academicYear || defaultYear,
      term: (session.term as any) || defaultTerm,
      startDate: session.startDate || today,
      endDate: session.endDate || twoWeeksLater,
      maximumScore: Number(session.maximumScore) || 100,
      status: session.status || 'Draft',
      applicableClasses: Array.isArray(session.applicableClasses) ? session.applicableClasses : [],
      applicableSubjects: Array.isArray(session.applicableSubjects) ? session.applicableSubjects : [],
    } : {
      examName: '',
      examType: 'End Term',
      academicYear: defaultYear,
      term: defaultTerm,
      startDate: today,
      endDate: twoWeeksLater,
      maximumScore: 100,
      status: 'Draft',
      applicableClasses: [],
      applicableSubjects: [],
    }
  });

  const selectedClasses = watch('applicableClasses') || [];
  const selectedSubjects = watch('applicableSubjects') || [];

  // Reset form whenever session prop changes
  useEffect(() => {
    if (session) {
      reset({
        examName: session.examName || '',
        examType: (session.examType === 'Openar' ? 'Opener' : session.examType) || 'End Term',
        academicYear: session.academicYear || defaultYear,
        term: (session.term as any) || defaultTerm,
        startDate: session.startDate || today,
        endDate: session.endDate || twoWeeksLater,
        maximumScore: Number(session.maximumScore) || 100,
        status: session.status || 'Draft',
        applicableClasses: Array.isArray(session.applicableClasses) ? session.applicableClasses : [],
        applicableSubjects: Array.isArray(session.applicableSubjects) ? session.applicableSubjects : [],
      });
    } else {
      reset({
        examName: '',
        examType: 'End Term',
        academicYear: defaultYear,
        term: defaultTerm,
        startDate: today,
        endDate: twoWeeksLater,
        maximumScore: 100,
        status: 'Draft',
        applicableClasses: classes.map(c => c.id),
        applicableSubjects: subjects.map(s => s.id),
      });
    }
  }, [session, reset, defaultYear, defaultTerm, today, twoWeeksLater]);

  useEffect(() => {
    if (!school?.id) return;
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

        const loadedClasses = classesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class));
        const loadedSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));

        setClasses(loadedClasses);
        setSubjects(loadedSubjects);

        // Pre-select all for new session if none currently selected
        if (!session && (!selectedClasses || selectedClasses.length === 0)) {
          setValue('applicableClasses', loadedClasses.map(c => c.id));
        }
        if (!session && (!selectedSubjects || selectedSubjects.length === 0)) {
          setValue('applicableSubjects', loadedSubjects.map(s => s.id));
        }
      } catch (error) {
        console.error("Error fetching data for exam session form:", error);
      }
    };
    fetchData();
  }, [school?.id, currentBranch]);

  const handleSelectAllClasses = () => {
    setValue('applicableClasses', classes.map(c => c.id), { shouldValidate: true });
  };
  const handleDeselectAllClasses = () => {
    setValue('applicableClasses', [], { shouldValidate: true });
  };

  const handleSelectAllSubjects = () => {
    setValue('applicableSubjects', subjects.map(s => s.id), { shouldValidate: true });
  };
  const handleDeselectAllSubjects = () => {
    setValue('applicableSubjects', [], { shouldValidate: true });
  };

  const onSubmit = async (data: SessionFormValues) => {
    if (!school?.id) {
      toast.error('School context is missing. Please refresh and try again.');
      return;
    }
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-[calc(100%-2rem)] md:w-full max-w-2xl p-4 md:p-6 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{session ? 'Edit' : 'Create'} Exam Session</h2>
            <p className="text-xs text-gray-500 mt-0.5">Configure session schedule, type, classes, and subjects.</p>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 uppercase">Exam Name *</label>
              <input 
                {...register('examName')} 
                placeholder="e.g. End of Term 1 Exams" 
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" 
              />
              {errors.examName && <p className="text-red-500 text-xs">{errors.examName.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 uppercase">Exam Type *</label>
              <select 
                {...register('examType')} 
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                <option value="Opener">Opener Exams</option>
                <option value="Midterm">Midterm Exams</option>
                <option value="End Term">End Term Exams</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 uppercase">Academic Year *</label>
              <select 
                {...register('academicYear')} 
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                {Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              {errors.academicYear && <p className="text-red-500 text-xs">{errors.academicYear.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 uppercase">Term *</label>
              <select 
                {...register('term')} 
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
              {errors.term && <p className="text-red-500 text-xs">{errors.term.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 uppercase">Start Date *</label>
              <input 
                type="date" 
                {...register('startDate')} 
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" 
              />
              {errors.startDate && <p className="text-red-500 text-xs">{errors.startDate.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 uppercase">End Date *</label>
              <input 
                type="date" 
                {...register('endDate')} 
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" 
              />
              {errors.endDate && <p className="text-red-500 text-xs">{errors.endDate.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 uppercase">Maximum Score *</label>
              <input 
                type="number" 
                {...register('maximumScore', { valueAsNumber: true })} 
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" 
              />
              {errors.maximumScore && <p className="text-red-500 text-xs">{errors.maximumScore.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 uppercase">Status *</label>
              <select 
                {...register('status')} 
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                <option value="Draft">Draft (Setup mode)</option>
                <option value="Open">Open (Teachers can enter marks)</option>
                <option value="Closed">Closed (Marks entry disabled)</option>
                <option value="Published">Published (Results visible to parents)</option>
              </select>
            </div>
          </div>

          {/* Applicable Classes */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-gray-700 uppercase tracking-wider">
                Applicable Classes ({selectedClasses.length} selected) *
              </label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllClasses}
                  className="text-primary hover:underline font-bold cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllClasses}
                  className="text-gray-500 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {classes.length === 0 ? (
              <p className="p-4 bg-gray-50 rounded-xl text-xs text-gray-500 italic text-center">
                No classes registered for this school branch yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 p-3.5 bg-gray-50 rounded-2xl border border-gray-200 max-h-48 overflow-y-auto">
                {classes.map(c => (
                  <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-xl transition-colors cursor-pointer group border border-transparent hover:border-gray-200">
                    <input
                      type="checkbox"
                      value={c.id}
                      {...register('applicableClasses')}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary transition-all cursor-pointer"
                    />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-primary transition-colors">{c.name}</span>
                  </label>
                ))}
              </div>
            )}
            {errors.applicableClasses && <p className="text-red-500 text-xs font-bold">{errors.applicableClasses.message}</p>}
          </div>

          {/* Applicable Subjects */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-gray-700 uppercase tracking-wider">
                Applicable Subjects ({selectedSubjects.length} selected) *
              </label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllSubjects}
                  className="text-primary hover:underline font-bold cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllSubjects}
                  className="text-gray-500 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {subjects.length === 0 ? (
              <p className="p-4 bg-gray-50 rounded-xl text-xs text-gray-500 italic text-center">
                No subjects registered for this school yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 bg-gray-50 rounded-2xl border border-gray-200 max-h-48 overflow-y-auto">
                {subjects.map(s => (
                  <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-xl transition-colors cursor-pointer group border border-transparent hover:border-gray-200">
                    <input
                      type="checkbox"
                      value={s.id}
                      {...register('applicableSubjects')}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary transition-all cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-700 group-hover:text-primary transition-colors">{s.name}</span>
                      {s.code && <span className="text-[10px] text-gray-400">{s.code}</span>}
                    </div>
                  </label>
                ))}
              </div>
            )}
            {errors.applicableSubjects && <p className="text-red-500 text-xs font-bold">{errors.applicableSubjects.message}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="px-6 py-2 bg-primary text-white rounded-lg flex items-center gap-2 font-bold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all cursor-pointer shadow-md"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (session ? 'Update Session' : 'Save Session')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
