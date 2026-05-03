import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Mail, 
  Phone, 
  MapPin, 
  Loader2, 
  UserPlus,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import firebaseConfig from '../../../firebase-applet-config.json';
import { Parent, Student, Class, Stream, Invoice, Payment } from '../../types';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Papa from 'papaparse';
import { useBranch } from '../../context/BranchContext';

const parentSchema = z.object({
  fullName: z.string().min(3, 'Full name must be at least 3 characters'),
  email: z.string().email('Invalid email address').or(z.literal('')),
  phone: z.string().min(10, 'Phone number must be at least 10 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters').or(z.literal('')),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  status: z.enum(['active', 'inactive']),
});

type ParentForm = z.infer<typeof parentSchema>;

export default function Parents({ schoolId }: { schoolId: string }) {
  const { currentBranch } = useBranch();
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [parentToDelete, setParentToDelete] = useState<Parent | null>(null);
  const [editingParent, setEditingParent] = useState<Parent | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ParentForm>({
    resolver: zodResolver(parentSchema),
  });

  useEffect(() => {
    if (!schoolId) return;
    let q = query(collection(db, 'schools', schoolId, 'parents'));
    if (currentBranch) {
      q = query(q, where('branchId', '==', currentBranch.id));
    }
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const parentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Parent));
      
      parentData.forEach(async (p) => {
        if (!p.parentId) {
          const newId = Math.floor(1000 + Math.random() * 9000).toString();
          try {
            await updateDoc(doc(db, 'schools', schoolId, 'parents', p.id), { parentId: newId });
          } catch(e) {}
        }
      });

      setParents(parentData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [schoolId, currentBranch]);

  useEffect(() => {
    if (editingParent) {
      reset({
        fullName: editingParent.fullName,
        email: editingParent.email,
        phone: editingParent.phone,
        address: editingParent.address,
        status: editingParent.status || 'active',
      });
    } else {
      reset({
        fullName: '',
        email: '',
        phone: '',
        address: '',
        status: 'active',
      });
    }
  }, [editingParent, reset]);

  const onSubmit = async (data: ParentForm) => {
    try {
      if (editingParent) {
        await updateDoc(doc(db, 'schools', schoolId, 'parents', editingParent.id), {
          ...data,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          updatedAt: new Date().toISOString(),
        });
        toast.success('Parent updated successfully');
      } else {
        // Create Auth User using secondary app
        const secondaryApp = getApps().find(app => app.name === 'secondary') || initializeApp(firebaseConfig, 'secondary');
        const secondaryAuth = getAuth(secondaryApp);
        
        const email = data.email || `${data.username}@school.com`;
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, data.password || 'Password123!');
        const user = userCredential.user;

        // Create Parent Document
        const newParentId = Math.floor(1000 + Math.random() * 9000).toString();
        await addDoc(collection(db, 'schools', schoolId, 'parents'), {
          ...data,
          parentId: newParentId,
          uid: user.uid,
          schoolId,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          status: 'active',
          createdAt: new Date().toISOString(),
        });
        
        // Create UserProfile for Role
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          schoolId,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          fullName: data.fullName,
          email: email,
          role: 'parent',
          status: 'active',
          createdAt: new Date().toISOString(),
        });

        toast.success('Parent added successfully');
      }
      setIsModalOpen(false);
      setEditingParent(null);
      reset();
    } catch (error) {
      console.error('Error saving parent:', error);
      toast.error('Failed to save parent: ' + (error as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schools', schoolId, 'parents', id));
      toast.success('Parent deleted successfully');
      setIsDeleteConfirmOpen(false);
      setParentToDelete(null);
    } catch (error) {
      toast.error('Failed to delete parent');
    }
  };

  const filteredParents = parents.filter(p => 
    p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.phone.includes(searchTerm)
  );

  const downloadTemplate = () => {
    const headers = [
      'Parent Full Name',
      'Phone',
      'Email',
      'Address',
      'Student Name',
      'Admission Number',
      'Gender (male/female)',
      'Date of Birth (YYYY-MM-DD)',
      'Class Name',
      'Stream Name'
    ];
    const csv = Papa.unparse([headers]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'parent_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const processBulkUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a CSV file first');
      return;
    }

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];
        if (data.length === 0) {
          toast.error('The CSV file is empty');
          return;
        }

        setLoading(true);
        let successCount = 0;
        let errorCount = 0;

        try {
          // Fetch classes and streams for matching
          const classesSnap = await getDocs(collection(db, 'schools', schoolId, 'classes'));
          const streamsSnap = await getDocs(collection(db, 'schools', schoolId, 'streams'));
          const classes = classesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class));
          const streams = streamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Stream));

          for (const row of data) {
            try {
              // 1. Create or Update Parent
              const phone = row['Phone']?.trim();
              if (!phone) {
                errorCount++;
                continue;
              }

              let parentId = '';
              const existingParent = parents.find(p => p.phone === phone);

              if (existingParent) {
                parentId = existingParent.id;
              } else {
                const newParentUniqueId = Math.floor(1000 + Math.random() * 9000).toString();
                const parentDoc = await addDoc(collection(db, 'schools', schoolId, 'parents'), {
                  fullName: row['Parent Full Name'] || 'Unknown Parent',
                  parentId: newParentUniqueId,
                  phone: phone,
                  email: row['Email'] || '',
                  address: row['Address'] || '',
                  schoolId,
                  ...(currentBranch ? { branchId: currentBranch.id } : {}),
                  status: 'active',
                  createdAt: new Date().toISOString(),
                });
                parentId = parentDoc.id;
              }

              // 2. Create Student if info provided
              const studentName = row['Student Name']?.trim();
              if (studentName && parentId) {
                const className = row['Class Name']?.trim();
                const streamName = row['Stream Name']?.trim();
                const cls = classes.find(c => c.name.toLowerCase() === className?.toLowerCase());
                const strm = streams.find(s => s.name.toLowerCase() === streamName?.toLowerCase() && s.classId === cls?.id);

                if (cls && strm) {
                  await addDoc(collection(db, 'schools', schoolId, 'students'), {
                    admissionNumber: row['Admission Number'] || `ADM-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                    fullName: studentName,
                    gender: (row['Gender (male/female)']?.toLowerCase() === 'female' ? 'female' : 'male') as 'male' | 'female',
                    dateOfBirth: row['Date of Birth (YYYY-MM-DD)'] || '',
                    classId: cls.id,
                    streamId: strm.id,
                    parentId,
                    arrears: 0,
                    schoolId,
                    ...(currentBranch ? { branchId: currentBranch.id } : {}),
                    status: 'active',
                    createdAt: new Date().toISOString(),
                  });
                }
              }
              successCount++;
            } catch (err) {
              console.error('Error processing row:', err);
              errorCount++;
            }
          }

          toast.success(`Import complete: ${successCount} parents processed`);
          setIsBulkModalOpen(false);
          setSelectedFile(null);
        } catch (err) {
          console.error('Bulk import failed:', err);
          toast.error('Bulk import failed');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const synchronizeData = async () => {
    setLoading(true);
    try {
      const studentsSnap = await getDocs(collection(db, 'schools', schoolId, 'students'));
      const parentsSnap = await getDocs(collection(db, 'schools', schoolId, 'parents'));
      const invoicesSnap = await getDocs(collection(db, 'schools', schoolId, 'invoices'));
      const paymentsSnap = await getDocs(collection(db, 'schools', schoolId, 'payments'));
      const usersSnap = await getDocs(query(collection(db, 'users'), where('schoolId', '==', schoolId), where('role', '==', 'parent')));

      const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      const allParents = parentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Parent));
      const allParentUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const parentByDisplayId: Record<string, Parent> = {};
      const parentById: Record<string, Parent> = {};
      const parentByPhone: Record<string, Parent> = {};
      const parentByEmail: Record<string, Parent> = {};

      allParents.forEach(p => {
        if (p.parentId) parentByDisplayId[p.parentId] = p;
        if (p.phone) parentByPhone[p.phone.trim()] = p;
        if (p.email) parentByEmail[p.email.toLowerCase().trim()] = p;
        parentById[p.id] = p;
      });

      let updatedCount = 0;

      // 1. Link UIDs to parents if missing
      for (const user of allParentUsers) {
        const parentDoc = allParents.find(p => 
          (p.email && p.email.toLowerCase().trim() === user.email?.toLowerCase().trim()) ||
          (p.phone && p.phone.trim() === user.phone?.trim())
        );

        if (parentDoc && !parentDoc.uid) {
          await updateDoc(doc(db, 'schools', schoolId, 'parents', parentDoc.id), {
            uid: user.uid,
            updatedAt: new Date().toISOString()
          });
          parentDoc.uid = user.uid; // Update local copy for next steps
          updatedCount++;
        }
      }

      // 2. Synchronize Student-Parent Links
      for (const student of allStudents) {
        let correctParentId = student.parentId;
        
        // If parentId doesn't match an actual doc ID, check display ID, Phone or Email
        if (!parentById[student.parentId]) {
           const byDisplay = parentByDisplayId[student.parentId];
           const byPhone = parentByPhone[student.parentId.trim()];
           
           if (byDisplay) {
             correctParentId = byDisplay.id;
           } else if (byPhone) {
             correctParentId = byPhone.id;
           }
        }

        if (correctParentId !== student.parentId) {
          await updateDoc(doc(db, 'schools', schoolId, 'students', student.id), {
            parentId: correctParentId,
            updatedAt: new Date().toISOString()
          });
          updatedCount++;
        }
      }

      // 3. Synchronize Invoices
      for (const inv of invoicesSnap.docs) {
        const data = inv.data() as Invoice;
        const student = allStudents.find(s => s.id === data.studentId);
        if (student) {
          const parent = parentById[student.parentId];
          const needsUpdate = !data.studentName || 
                            !data.admissionNumber || 
                            data.studentName !== student.fullName || 
                            data.admissionNumber !== student.admissionNumber ||
                            data.parentId !== student.parentId;
                            
          if (needsUpdate) {
            await updateDoc(doc(db, 'schools', schoolId, 'invoices', inv.id), {
              studentName: student.fullName,
              admissionNumber: student.admissionNumber,
              parentId: student.parentId,
              updatedAt: new Date().toISOString()
            });
            updatedCount++;
          }
        }
      }

      // 4. Synchronize Payments
      for (const pymt of paymentsSnap.docs) {
        const data = pymt.data() as Payment;
        const student = allStudents.find(s => s.id === data.studentId);
        const invoice = invoicesSnap.docs.find(i => i.id === data.invoiceId)?.data() as Invoice | undefined;

        if (student) {
          const needsUpdate = !data.studentName || 
                            !data.admissionNumber || 
                            !data.invoiceNumber ||
                            data.studentName !== student.fullName || 
                            data.admissionNumber !== student.admissionNumber ||
                            data.parentId !== student.parentId ||
                            (invoice && data.invoiceNumber !== invoice.invoiceNumber);

          if (needsUpdate) {
            await updateDoc(doc(db, 'schools', schoolId, 'payments', pymt.id), {
              studentName: student.fullName,
              admissionNumber: student.admissionNumber,
              invoiceNumber: invoice?.invoiceNumber || data.invoiceNumber || 'N/A',
              parentId: student.parentId,
              updatedAt: new Date().toISOString()
            });
            updatedCount++;
          }
        }
      }

      toast.success(`Success! Synchronized ${updatedCount} records.`);
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Synchronization failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Parents Management</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Manage parent and guardian information.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                type="text"
                placeholder="Search parents..."
                className="pl-10 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder:text-white/40 focus:bg-white/20 outline-none w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => {
                setEditingParent(null);
                setIsModalOpen(true);
              }}
              className="px-6 py-2.5 bg-white text-maroon font-black uppercase tracking-widest text-[10px] rounded-xl shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Add Parent
            </button>
            <button 
              onClick={synchronizeData}
              className="px-4 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-white/20 transition-all flex items-center gap-2"
              title="Fix student links and update invoice student info"
            >
              <RefreshCw className="h-4 w-4" />
              Sync Data
            </button>
            <button 
              onClick={() => {
                setIsBulkModalOpen(true);
                setSelectedFile(null);
              }}
              className="px-6 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-white/20 transition-all flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Bulk Import
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredParents.map((parent) => (
          <div key={parent.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-school-gradient/10 rounded-2xl flex items-center justify-center text-primary font-bold text-lg">
                  {parent.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{parent.fullName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-widest border border-primary/20">
                      ID: {parent.parentId || '---'}
                    </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 ${
                    parent.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {parent.status === 'active' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {parent.status || 'active'}
                  </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => {
                    setEditingParent(parent);
                    setIsModalOpen(true);
                  }}
                  className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => {
                    setParentToDelete(parent);
                    setIsDeleteConfirmOpen(true);
                  }}
                  className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Phone className="h-4 w-4 text-gray-400" />
                {parent.phone}
              </div>
              {parent.email && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Mail className="h-4 w-4 text-gray-400" />
                  {parent.email}
                </div>
              )}
              {parent.address && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  {parent.address}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">{editingParent ? 'Edit Parent' : 'Add New Parent'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                <input
                  {...register('fullName')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  placeholder="Parent's full name"
                />
                {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Username</label>
                  <input
                    {...register('username')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                    placeholder="parent_username"
                  />
                  {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                  <input
                    {...register('password')}
                    type="password"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                    placeholder="••••••••"
                  />
                  {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                  <input
                    {...register('email')}
                    type="email"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                    placeholder="email@example.com"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                  <input
                    {...register('phone')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                    placeholder="+254..."
                  />
                  {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                <select
                  {...register('status')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all bg-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Residential Address</label>
                <textarea
                  {...register('address')}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all resize-none"
                  placeholder="Physical address"
                />
                {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address.message}</p>}
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
                  {editingParent ? 'Update Parent' : 'Save Parent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Bulk Import Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Bulk Import Parents</h2>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10">
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  Step 1: Download Template
                </h3>
                <p className="text-sm text-gray-500 mb-4">Download the CSV template and fill in the parent and student details.</p>
                <button 
                  onClick={downloadTemplate}
                  className="w-full py-3 bg-white border border-primary/20 text-primary font-bold rounded-xl hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="h-5 w-5" />
                  Download CSV Template
                </button>
              </div>

              <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Upload className="h-4 w-4 text-gray-400" />
                  Step 2: Upload Filled CSV
                </h3>
                <p className="text-sm text-gray-500 mb-4">Upload the completed CSV file to import parents and link students.</p>
                <label className="block">
                  <span className="sr-only">Choose CSV file</span>
                  <input 
                    type="file" 
                    accept=".csv"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2.5 file:px-4
                      file:rounded-xl file:border-0
                      file:text-sm file:font-bold
                      file:bg-primary file:text-white
                      hover:file:bg-primary/90
                      cursor-pointer"
                  />
                </label>

                {selectedFile && (
                  <div className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/10 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FileSpreadsheet className="h-4 w-4 text-primary" />
                      <span className="font-medium truncate">{selectedFile.name}</span>
                    </div>
                    <button
                      onClick={processBulkUpload}
                      disabled={loading}
                      className="w-full py-3 bg-school-gradient text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Upload className="h-5 w-5" />
                      )}
                      UPLOAD NOW
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Parents will be matched by phone number. If student details are provided, they will be automatically added and linked to the parent.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && parentToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Parent?</h3>
              <p className="text-gray-500 mb-8">
                Are you sure you want to delete <span className="font-bold text-gray-900">{parentToDelete.fullName}</span>? 
                This action cannot be undone and will remove all parent records.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setParentToDelete(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(parentToDelete.id)}
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
