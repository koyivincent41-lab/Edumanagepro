import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Users as UsersIcon, 
  Mail, 
  Shield, 
  Loader2, 
  Edit2,
  Trash2,
  X,
  AlertCircle,
  UserPlus
} from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, where, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile, UserRole, School, Package } from '../../types';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useBranch } from '../../context/BranchContext';

const userSchema = z.object({
  fullName: z.string().min(3, 'Full name must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'accountant', 'clerk', 'teacher', 'branch-admin']),
});

type UserForm = z.infer<typeof userSchema>;

export default function Users({ schoolId, school }: { schoolId: string; school: School | null }) {
  const { currentBranch } = useBranch();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activePackage, setActivePackage] = useState<Package | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
  });

  useEffect(() => {
    if (!schoolId) return;

    // Fetch active package details
    if (school?.packageId) {
      getDoc(doc(db, 'packages', school.packageId)).then(snap => {
        if (snap.exists()) setActivePackage({ id: snap.id, ...snap.data() } as Package);
      });
    }

    let q = query(collection(db, 'users'), where('schoolId', '==', schoolId));
    if (currentBranch) {
      q = query(q, where('branchId', '==', currentBranch.id));
    }
    const unsubscribe = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolId, school?.packageId, currentBranch]);

  useEffect(() => {
    if (editingUser) {
      reset({
        fullName: editingUser.fullName,
        email: editingUser.email,
        role: editingUser.role as any,
      });
    } else {
      reset({
        fullName: '',
        email: '',
        role: 'teacher',
      });
    }
  }, [editingUser, reset]);

  const onSubmit = async (data: UserForm) => {
    try {
      // Package Enforcement
      if (!editingUser && activePackage) {
        if (users.length >= activePackage.userLimit) {
          toast.error(`User limit reached for ${activePackage.name} plan (${activePackage.userLimit}). Please upgrade.`);
          return;
        }
      }

      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.uid), {
          ...data,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          updatedAt: new Date().toISOString(),
        });
        toast.success('User updated successfully');
      } else {
        // In a real app, this would involve Firebase Auth creation
        // For this demo, we'll just create the profile
        const userRef = doc(collection(db, 'users'));
        await setDoc(userRef, {
          ...data,
          uid: userRef.id,
          schoolId,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          status: 'active',
          createdAt: new Date().toISOString(),
        });
        
        // Update school user count
        await setDoc(doc(db, 'schools', schoolId), {
          userCount: users.length + 1
        }, { merge: true });
        
        toast.success('User added successfully');
      }
      setIsModalOpen(false);
      setEditingUser(null);
      reset();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error('Failed to save user');
    }
  };

  const handleDelete = async (uid: string) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
      
      // Update school user count
      await setDoc(doc(db, 'schools', schoolId), {
        userCount: Math.max(0, users.length - 1)
      }, { merge: true });

      toast.success('User deleted successfully');
      setIsDeleteConfirmOpen(false);
      setUserToDelete(null);
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Users & Staff</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Manage school administrators, teachers, and staff accounts.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                type="text"
                placeholder="Search users..."
                className="pl-10 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder:text-white/40 focus:bg-white/20 outline-none w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => {
                setEditingUser(null);
                setIsModalOpen(true);
              }}
              className="px-6 py-2.5 bg-white text-maroon font-black uppercase tracking-widest text-[10px] rounded-xl shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Add User
            </button>
          </div>
        </div>
      </div>

      {/* Limit Info Card */}
      {activePackage && (
        <div className="bg-school-gradient/5 border border-primary/10 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-school-gradient/10 rounded-lg">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{activePackage.name} Plan Limits</p>
              <p className="text-xs text-gray-500">Your plan allows up to {activePackage.userLimit} users and {activePackage.studentLimit} students.</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900">{users.length} / {activePackage.userLimit} Users</p>
            <div className="w-32 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
              <div 
                className={`h-full transition-all ${users.length >= activePackage.userLimit ? 'bg-red-500' : 'bg-school-gradient'}`}
                style={{ width: `${Math.min(100, (users.length / activePackage.userLimit) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-school-gradient/10 rounded-xl flex items-center justify-center text-primary font-bold">
                        {user.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{user.fullName}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      user.role === 'owner' ? 'bg-purple-100 text-purple-600' :
                      user.role === 'admin' ? 'bg-blue-100 text-blue-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      user.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {user.role !== 'owner' && (
                        <>
                          <button 
                            onClick={() => {
                              setEditingUser(user);
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                          <button 
                            onClick={() => {
                              setUserToDelete(user);
                              setIsDeleteConfirmOpen(true);
                            }}
                            className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">{editingUser ? 'Edit User' : 'Add New User'}</h2>
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
                  placeholder="Staff member's full name"
                />
                {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                <input
                  {...register('email')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  placeholder="staff@school.com"
                />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
                <select
                  {...register('role')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all bg-white"
                >
                  <option value="teacher">Teacher</option>
                  <option value="admin">Administrator</option>
                  <option value="accountant">Accountant</option>
                  <option value="clerk">Clerk</option>
                </select>
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
                  {editingUser ? 'Update User' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && userToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Remove User?</h3>
              <p className="text-gray-500 mb-8">
                Are you sure you want to remove <span className="font-bold text-gray-900">{userToDelete.fullName}</span>? 
                They will no longer be able to access the school portal.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setUserToDelete(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(userToDelete.uid)}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:scale-105 transition-all"
                >
                  Remove Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
