import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Layers, 
  Loader2, 
  Edit2,
  Trash2,
  X,
  Filter,
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

const streamSchema = z.object({
  name: z.string().min(1, 'Stream name is required'),
  classId: z.string().min(1, 'Please select a class'),
});

type StreamForm = z.infer<typeof streamSchema>;

export default function Streams({ schoolId }: { schoolId: string }) {
  const { currentBranch } = useBranch();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [streamToDelete, setStreamToDelete] = useState<Stream | null>(null);
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StreamForm>({
    resolver: zodResolver(streamSchema),
  });

  useEffect(() => {
    if (!schoolId) return;
    
    let classesQuery = query(collection(db, 'schools', schoolId, 'classes'));
    if (currentBranch) classesQuery = query(classesQuery, where('branchId', '==', currentBranch.id));
    
    const unsubClasses = onSnapshot(classesQuery, (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
    });

    let streamsQuery = query(collection(db, 'schools', schoolId, 'streams'));
    if (currentBranch) streamsQuery = query(streamsQuery, where('branchId', '==', currentBranch.id));
    
    const unsubStreams = onSnapshot(streamsQuery, (snap) => {
      setStreams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Stream)));
      setLoading(false);
    });

    return () => {
      unsubClasses();
      unsubStreams();
    };
  }, [schoolId, currentBranch]);

  useEffect(() => {
    if (editingStream) {
      reset({
        name: editingStream.name,
        classId: editingStream.classId,
      });
    } else {
      reset({
        name: '',
        classId: '',
      });
    }
  }, [editingStream, reset]);

  const onSubmit = async (data: StreamForm) => {
    try {
      if (editingStream) {
        await updateDoc(doc(db, 'schools', schoolId, 'streams', editingStream.id), {
          ...data,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          updatedAt: new Date().toISOString(),
        });
        toast.success('Stream updated successfully');
      } else {
        await addDoc(collection(db, 'schools', schoolId, 'streams'), {
          ...data,
          schoolId,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          createdAt: new Date().toISOString(),
        });
        toast.success('Stream added successfully');
      }
      setIsModalOpen(false);
      setEditingStream(null);
      reset();
    } catch (error) {
      console.error('Error saving stream:', error);
      toast.error('Failed to save stream');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schools', schoolId, 'streams', id));
      toast.success('Stream deleted successfully');
      setIsDeleteConfirmOpen(false);
      setStreamToDelete(null);
    } catch (error) {
      toast.error('Failed to delete stream');
    }
  };

  const filteredStreams = streams.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClassFilter === 'all' || s.classId === selectedClassFilter;
    return matchesSearch && matchesClass;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-4 md:p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white">Streams Management</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Manage class streams and divisions.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                type="text"
                placeholder="Search streams..."
                className="pl-10 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder:text-white/40 focus:bg-white/20 outline-none w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => {
                setEditingStream(null);
                setIsModalOpen(true);
              }}
              className="px-4 md:px-6 py-2.5 bg-white text-maroon font-black uppercase tracking-widest text-[10px] rounded-xl shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Stream
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-500 uppercase tracking-wider">
          <Filter className="h-4 w-4" />
          Filter by Class:
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedClassFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              selectedClassFilter === 'all' 
                ? 'bg-school-gradient text-white shadow-md shadow-primary/20' 
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            All Classes
          </button>
          {classes.map(cls => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassFilter(cls.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                selectedClassFilter === cls.id 
                  ? 'bg-school-gradient text-white shadow-md shadow-primary/20' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cls.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {filteredStreams.map((stream) => {
          const cls = classes.find(c => c.id === stream.classId);
          return (
            <div key={stream.id} className="bg-white p-4 md:p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button 
                  onClick={() => {
                    setEditingStream(stream);
                    setIsModalOpen(true);
                  }}
                  className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => {
                    setStreamToDelete(stream);
                    setIsDeleteConfirmOpen(true);
                  }}
                  className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-school-gradient/10 rounded-2xl flex items-center justify-center text-primary">
                  <Layers className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 tracking-tight">{stream.name}</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{cls?.name || 'Unknown Class'}</p>
                </div>
              </div>
            </div>
          );
        })}
        {filteredStreams.length === 0 && (
          <div className="col-span-full py-20 text-center bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 text-gray-300">
              <Layers className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No streams found</h3>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your search or add a new stream.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-[calc(100%-2rem)] md:w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">{editingStream ? 'Edit Stream' : 'Add New Stream'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-4 md:p-8 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Stream Name</label>
                <input
                  {...register('name')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  placeholder="e.g. Stream A, Blue, North"
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Assign to Class</label>
                <select
                  {...register('classId')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all bg-white"
                >
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.classId && <p className="mt-1 text-xs text-red-500">{errors.classId.message}</p>}
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
                  {editingStream ? 'Update Stream' : 'Save Stream'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && streamToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-[calc(100%-2rem)] md:w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 md:p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Stream?</h3>
              <p className="text-gray-500 mb-8">
                Are you sure you want to delete <span className="font-bold text-gray-900">{streamToDelete.name}</span>? 
                This action cannot be undone and may affect associated students.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setStreamToDelete(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(streamToDelete.id)}
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
