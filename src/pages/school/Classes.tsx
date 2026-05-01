import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  BookOpen, 
  Loader2, 
  Edit2,
  Trash2,
  X,
  Layers,
  AlertCircle
} from 'lucide-react';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Class, Stream } from '../../types';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useBranch } from '../../context/BranchContext';

const classSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
});

type ClassForm = z.infer<typeof classSchema>;

export default function Classes({ schoolId }: { schoolId: string }) {
  const { currentBranch } = useBranch();
  const [classes, setClasses] = useState<Class[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [classSubjects, setClassSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<Class | null>(null);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassForm>({
    resolver: zodResolver(classSchema),
  });

  useEffect(() => {
    if (!schoolId) return;
    
    let classesQuery = query(collection(db, 'schools', schoolId, 'classes'));
    if (currentBranch) classesQuery = query(classesQuery, where('branchId', '==', currentBranch.id));
    
    const unsubscribe = onSnapshot(classesQuery, (snapshot) => {
      const classData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      setClasses(classData);
    });

    let streamsQuery = query(collection(db, 'schools', schoolId, 'streams'));
    if (currentBranch) streamsQuery = query(streamsQuery, where('branchId', '==', currentBranch.id));
    
    const unsubStreams = onSnapshot(streamsQuery, (snap) => {
      setStreams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Stream)));
    });

    // Fetch Employees to find class teachers
    let employeesQuery = query(collection(db, 'employees'), where('schoolId', '==', schoolId));
    if (currentBranch) employeesQuery = query(employeesQuery, where('branchId', '==', currentBranch.id));
    const unsubEmployees = onSnapshot(employeesQuery, (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Class Subjects
    let csQuery = query(collection(db, 'class_subjects'), where('schoolId', '==', schoolId));
    if (currentBranch) csQuery = query(csQuery, where('branchId', '==', currentBranch.id));
    const unsubCS = onSnapshot(csQuery, (snap) => {
      setClassSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubStreams();
      unsubEmployees();
      unsubCS();
    };
  }, [schoolId, currentBranch]);

  const getClassTeacher = (classId: string) => {
    return employees.find(emp => emp.isClassTeacher && emp.classTeacherAssignment === classId);
  };

  const getSubjectCount = (classId: string) => {
    return classSubjects.filter(cs => cs.classId === classId).length;
  };

  useEffect(() => {
    if (editingClass) {
      reset({
        name: editingClass.name,
      });
    } else {
      reset({
        name: '',
      });
    }
  }, [editingClass, reset]);

  const onSubmit = async (data: ClassForm) => {
    try {
      if (editingClass) {
        await updateDoc(doc(db, 'schools', schoolId, 'classes', editingClass.id), {
          ...data,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          updatedAt: new Date().toISOString(),
        });
        toast.success('Class updated successfully');
      } else {
        await addDoc(collection(db, 'schools', schoolId, 'classes'), {
          ...data,
          schoolId,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          createdAt: new Date().toISOString(),
        });
        toast.success('Class added successfully');
      }
      setIsModalOpen(false);
      setEditingClass(null);
      reset();
    } catch (error) {
      console.error('Error saving class:', error);
      toast.error('Failed to save class');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schools', schoolId, 'classes', id));
      toast.success('Class deleted successfully');
      setIsDeleteConfirmOpen(false);
      setClassToDelete(null);
    } catch (error) {
      toast.error('Failed to delete class');
    }
  };

  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Classes Management</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Manage school classes and levels.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                type="text"
                placeholder="Search classes..."
                className="pl-10 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder:text-white/40 focus:bg-white/20 outline-none w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => {
                setEditingClass(null);
                setIsModalOpen(true);
              }}
              className="px-6 py-2.5 bg-white text-maroon font-black uppercase tracking-widest text-[10px] rounded-xl shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Class
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredClasses.map((cls) => {
          const classStreams = streams.filter(s => s.classId === cls.id);
          return (
            <div key={cls.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-school-gradient/10 rounded-2xl flex items-center justify-center text-primary font-bold text-lg">
                    <Layers className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{cls.name}</h3>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[10px] text-gray-500 font-medium">{classStreams.length} {classStreams.length === 1 ? 'Stream' : 'Streams'}</p>
                      <p className="text-[10px] text-primary font-bold uppercase tracking-wider">{getSubjectCount(cls.id)} Subjects</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      setEditingClass(cls);
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => {
                      setClassToDelete(cls);
                      setIsDeleteConfirmOpen(true);
                    }}
                    className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Class Teacher</span>
                  {cls.classTeacherName || getClassTeacher(cls.id)?.fullName ? (
                    <span className="text-xs font-bold text-gray-900">{cls.classTeacherName || getClassTeacher(cls.id)?.fullName}</span>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Not Assigned</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">{editingClass ? 'Edit Class' : 'Add New Class'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Class Name</label>
                <input
                  {...register('name')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  placeholder="e.g. Grade 1, Form 4"
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
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
                  {editingClass ? 'Update Class' : 'Save Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && classToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Class?</h3>
              <p className="text-gray-500 mb-8">
                Are you sure you want to delete <span className="font-bold text-gray-900">{classToDelete.name}</span>? 
                This action cannot be undone and may affect associated students and streams.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setClassToDelete(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(classToDelete.id)}
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
