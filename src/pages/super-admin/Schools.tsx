import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ExternalLink,
  Edit2,
  Mail,
  Phone,
  MapPin,
  Loader2,
  Key,
  Trash2
} from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../../firebase';
import { School, Package } from '../../types';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';

export default function Schools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState('all');
  const [packageFilter, setPackageFilter] = useState('all');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      ownerName: '',
      email: '',
      phone: '',
      address: '',
      packageId: '',
      subscriptionStatus: 'trial',
      subscriptionExpiry: '',
    }
  });

  useEffect(() => {
    const fetchPackages = async () => {
      const snap = await getDocs(collection(db, 'packages'));
      setPackages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Package)));
    };
    fetchPackages();

    const unsubscribe = onSnapshot(collection(db, 'schools'), (snapshot) => {
      const schoolData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School));
      setSchools(schoolData);
      setLoading(false);
    }, (error) => {
      console.error("Schools listener error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const onEditSubmit = async (data: any) => {
    if (!selectedSchool) return;
    try {
      await updateDoc(doc(db, 'schools', selectedSchool.id), data);
      toast.success('School profile updated successfully');
      setIsEditModalOpen(false);
    } catch (error) {
      toast.error('Failed to update school profile');
    }
  };

  const handleEditClick = (school: School) => {
    setSelectedSchool(school);
    reset({
      name: school.name,
      ownerName: school.ownerName,
      email: school.email,
      phone: school.phone,
      address: school.address,
      packageId: school.packageId || '',
      subscriptionStatus: school.subscriptionStatus || 'trial',
      subscriptionExpiry: school.subscriptionExpiry ? school.subscriptionExpiry.split('T')[0] : '',
    });
    setIsEditModalOpen(true);
  };

  const handleStatusChange = async (schoolId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'schools', schoolId), { status: newStatus });
      toast.success(`School status updated to ${newStatus}`);
      if (selectedSchool?.id === schoolId) {
        setSelectedSchool({ ...selectedSchool, status: newStatus as any });
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteSchool = async (schoolId: string) => {
    try {
      await deleteDoc(doc(db, 'schools', schoolId));
      toast.success('School deleted successfully');
      setIsDeleteConfirmOpen(false);
      setIsProfileModalOpen(false);
    } catch (error) {
      toast.error('Failed to delete school');
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!email) return;
    setIsResettingPassword(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success(`Password reset email sent to ${email}`);
    } catch (error) {
      toast.error('Failed to send password reset email');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const filteredSchools = schools.filter(school => {
    const matchesSearch = school.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         school.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         school.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || school.status === statusFilter;
    const matchesSubscription = subscriptionFilter === 'all' || school.subscriptionStatus === subscriptionFilter;
    const matchesPackage = packageFilter === 'all' || school.packageId === packageFilter;
    return matchesSearch && matchesStatus && matchesPackage && matchesSubscription;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-4 md:p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white">School Management</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Monitor and manage all registered schools on the platform.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                type="text"
                placeholder="Search schools..."
                className="pl-10 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder:text-white/40 focus:bg-white/20 outline-none w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white focus:bg-white/20 outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all" className="text-gray-900">All Status</option>
              <option value="active" className="text-gray-900">Active</option>
              <option value="pending" className="text-gray-900">Pending</option>
              <option value="suspended" className="text-gray-900">Suspended</option>
              <option value="inactive" className="text-gray-900">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[700px] w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">School Details</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Owner / Contact</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Package / Students</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSchools.map((school) => (
                <tr key={school.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 md:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 font-bold">
                        {school.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{school.name}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {school.address}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{school.ownerName}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <a href={`mailto:${school.email}`} className="text-gray-400 hover:text-primary transition-colors"><Mail className="h-3.5 w-3.5" /></a>
                      <a href={`tel:${school.phone}`} className="text-gray-400 hover:text-primary transition-colors"><Phone className="h-3.5 w-3.5" /></a>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    <div className="space-y-1">
                      <span className="px-3 py-1 bg-primary/5 text-primary rounded-full text-xs font-bold uppercase">
                        {packages.find(p => p.id === school.packageId)?.name || school.packageId}
                      </span>
                      <p className="text-xs text-gray-500 font-medium">{school.studentCount || 0} Students</p>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      school.status === 'active' ? 'bg-green-100 text-green-600' : 
                      school.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : 
                      'bg-red-100 text-red-600'
                    }`}>
                      {school.status}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setSelectedSchool(school);
                          setIsProfileModalOpen(true);
                        }}
                        className="p-2 text-primary hover:bg-school-gradient/5 rounded-lg transition-colors"
                        title="View Profile"
                      >
                        <ExternalLink className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => handleEditClick(school)}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Profile"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* School Profile Modal */}
      {isProfileModalOpen && selectedSchool && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-[calc(100%-2rem)] md:w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-school-gradient text-white rounded-2xl flex items-center justify-center text-xl md:text-2xl font-bold">
                  {selectedSchool.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">{selectedSchool.name}</h2>
                  <p className="text-gray-500 font-medium">School Profile</p>
                </div>
              </div>
              <button onClick={() => setIsProfileModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <XCircle className="h-6 w-6 text-gray-400" />
              </button>
            </div>

            <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Contact Information</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Mail className="h-4 w-4 text-primary" /> {selectedSchool.email}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Phone className="h-4 w-4 text-primary" /> {selectedSchool.phone}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <MapPin className="h-4 w-4 text-primary" /> {selectedSchool.address}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Subscription Details</h4>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 text-sm">
                      <span className="text-gray-500">Current Package</span>
                      <span className="font-bold text-primary uppercase">
                        {packages.find(p => p.id === selectedSchool.packageId)?.name || selectedSchool.packageId}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 text-sm">
                      <span className="text-gray-500">Student Count</span>
                      <span className="font-bold text-gray-900">{selectedSchool.studentCount || 0}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 text-sm">
                      <span className="text-gray-500">Registration Date</span>
                      <span className="font-bold text-gray-900">{new Date(selectedSchool.createdAt).toLocaleDateString()}</span>
                    </div>
                    {selectedSchool.activationDate && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 text-sm">
                        <span className="text-gray-500">Activation Date</span>
                        <span className="font-bold text-gray-900">{new Date(selectedSchool.activationDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 text-sm">
                      <span className="text-gray-500">Expiry Date</span>
                      <span className="font-bold text-gray-900">
                        {selectedSchool.subscriptionStatus === 'trial' 
                          ? (selectedSchool.trialExpiry ? new Date(selectedSchool.trialExpiry).toLocaleDateString() : 'N/A')
                          : (selectedSchool.subscriptionExpiry ? new Date(selectedSchool.subscriptionExpiry).toLocaleDateString() : 'N/A')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Management Actions</h4>
                <div className="grid grid-cols-1 gap-3">
                  {selectedSchool.status !== 'active' && (
                    <button 
                      onClick={() => handleStatusChange(selectedSchool.id, 'active')}
                      className="flex items-center gap-3 p-3 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-all text-sm font-bold"
                    >
                      <CheckCircle2 className="h-5 w-5" /> Activate School
                    </button>
                  )}
                  {selectedSchool.status === 'active' && (
                    <button 
                      onClick={() => handleStatusChange(selectedSchool.id, 'suspended')}
                      className="flex items-center gap-3 p-3 rounded-xl bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition-all text-sm font-bold"
                    >
                      <AlertCircle className="h-5 w-5" /> Suspend School
                    </button>
                  )}
                  <button 
                    onClick={() => handleStatusChange(selectedSchool.id, 'inactive')}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 transition-all text-sm font-bold"
                  >
                    <XCircle className="h-5 w-5" /> Deactivate School
                  </button>
                  <button 
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-all text-sm font-bold"
                  >
                    <Trash2 className="h-5 w-5" /> Delete School
                  </button>
                  <button 
                    onClick={() => handleResetPassword(selectedSchool.email)}
                    disabled={isResettingPassword}
                    className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all text-sm font-bold disabled:opacity-50"
                  >
                    {isResettingPassword ? <Loader2 className="h-5 w-5 animate-spin" /> : <Key className="h-5 w-5" />}
                    Reset Admin Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit School Modal */}
      {isEditModalOpen && selectedSchool && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-[calc(100%-2rem)] md:w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 bg-gray-50/50">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">Edit School Profile</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <XCircle className="h-6 w-6 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onEditSubmit)} className="p-4 md:p-8 space-y-6">
              <div className="grid grid-cols-1 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">School Name</label>
                  <input
                    {...register('name')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Owner Name</label>
                  <input
                    {...register('ownerName')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                  <input
                    {...register('email')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Phone</label>
                  <input
                    {...register('phone')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Package</label>
                  <select
                    {...register('packageId')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none"
                  >
                    <option value="">No Package</option>
                    {packages.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Subs Status</label>
                    <select
                      {...register('subscriptionStatus')}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none"
                    >
                      <option value="trial">Trial</option>
                      <option value="active">Active</option>
                      <option value="expired">Expired</option>
                      <option value="deactivated">Deactivated</option>
                      <option value="pending_approval">Pending Approval</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Expiry Date</label>
                    <input
                      type="date"
                      {...register('subscriptionExpiry')}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-school-gradient text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && selectedSchool && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-[calc(100%-2rem)] md:w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 md:p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete School?</h3>
              <p className="text-gray-500 mb-8">
                Are you sure you want to delete <span className="font-bold text-gray-900">{selectedSchool.name}</span>? 
                This action cannot be undone and all associated data will be lost.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteSchool(selectedSchool.id)}
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
