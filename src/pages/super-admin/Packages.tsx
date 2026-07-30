import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  Package as PackageIcon,
  Users,
  Loader2,
  X,
  Star,
  ArrowUp,
  ArrowDown,
  Layout,
  Save,
  Type,
  CheckSquare,
  MousePointer2,
  Eye,
  EyeOff,
  Settings as SettingsIcon,
  Zap
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Package } from '../../types';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const packageSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  monthlyPrice: z.number().min(0),
  yearlyPrice: z.number().min(0),
  studentLimit: z.number().min(1),
  userLimit: z.number().min(1),
  trialDays: z.number().min(0),
  features: z.string().min(1, 'At least one feature is required'),
  isFeatured: z.boolean(),
  order: z.number(),
  status: z.enum(['active', 'inactive']),
  description: z.string().optional(),
});

type PackageFormData = z.infer<typeof packageSchema>;

interface PricingSettings {
  title: string;
  subtitle: string;
  highlights: string[];
  buttonLabel: string;
  showTrialBadge: boolean;
}

export default function Packages() {
  const [activeTab, setActiveTab] = useState<'packages' | 'settings'>('packages');
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<Package | null>(null);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>({
    title: 'Simple, Transparent Pricing',
    subtitle: 'Choose the perfect plan for your school\'s needs.',
    highlights: ['No hidden fees', 'Cancel anytime', '24/7 Support'],
    buttonLabel: 'Get Started',
    showTrialBadge: true
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<PackageFormData>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      name: '',
      monthlyPrice: 0,
      yearlyPrice: 0,
      studentLimit: 100,
      userLimit: 10,
      trialDays: 14,
      features: '',
      isFeatured: false,
      order: 0,
      status: 'active',
      description: '',
    }
  });

  useEffect(() => {
    const q = query(collection(db, 'packages'), orderBy('order', 'asc'));
    const unsubscribePackages = onSnapshot(q, (snapshot) => {
      const packageData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Package));
      setPackages(packageData);
      setLoading(false);
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'pricing'), (snapshot) => {
      if (snapshot.exists()) {
        setPricingSettings(snapshot.data() as PricingSettings);
      }
    });

    return () => {
      unsubscribePackages();
      unsubscribeSettings();
    };
  }, []);

  const handleSavePricingSettings = async () => {
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'pricing'), pricingSettings);
      toast.success('Pricing settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const onSubmit = async (data: PackageFormData) => {
    console.log('Package form submission started...', data);
    try {
      const featuresArray = typeof data.features === 'string' 
        ? data.features.split('\n').filter(f => f.trim() !== '')
        : [];
        
      const finalData = {
        ...data,
        features: featuresArray,
        updatedAt: new Date().toISOString()
      };

      if (editingPackage) {
        console.log('Updating existing package:', editingPackage.id);
        await updateDoc(doc(db, 'packages', editingPackage.id), finalData);
        toast.success('Package updated successfully');
      } else {
        console.log('Creating new package');
        const newPackageRef = doc(collection(db, 'packages'));
        await setDoc(newPackageRef, { 
          ...finalData, 
          id: newPackageRef.id,
          createdAt: new Date().toISOString()
        });
        toast.success('Package created successfully');
      }
      setIsModalOpen(false);
      setEditingPackage(null);
      reset();
    } catch (error) {
      console.error('Package submission error:', error);
      toast.error('Failed to save package');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'packages', id));
      toast.success('Package deleted successfully');
      setIsDeleteConfirmOpen(false);
      setPackageToDelete(null);
    } catch (error) {
      toast.error('Failed to delete package');
    }
  };

  const handleEdit = (pkg: Package) => {
    setEditingPackage(pkg);
    reset({
      name: pkg.name || '',
      monthlyPrice: pkg.monthlyPrice || 0,
      yearlyPrice: pkg.yearlyPrice || 0,
      studentLimit: pkg.studentLimit || 100,
      userLimit: pkg.userLimit || 10,
      trialDays: pkg.trialDays || 0,
      features: Array.isArray(pkg.features) ? pkg.features.join('\n') : '',
      isFeatured: pkg.isFeatured || false,
      order: pkg.order || 0,
      status: pkg.status || 'active',
      description: pkg.description || '',
    });
    setIsModalOpen(true);
  };

  const handleMove = async (pkg: Package, direction: 'up' | 'down') => {
    const currentIndex = packages.findIndex(p => p.id === pkg.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (targetIndex < 0 || targetIndex >= packages.length) return;
    
    const targetPkg = packages[targetIndex];
    
    try {
      await updateDoc(doc(db, 'packages', pkg.id), { order: targetPkg.order });
      await updateDoc(doc(db, 'packages', targetPkg.id), { order: pkg.order });
      toast.success('Order updated');
    } catch (error) {
      toast.error('Failed to update order');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-4 md:p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white">Package Management</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Manage subscription plans and pricing page content</p>
          </div>
          
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-1 rounded-xl border border-white/20">
            <button
              onClick={() => setActiveTab('packages')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === 'packages' ? 'bg-white text-maroon shadow-md' : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <PackageIcon className="h-4 w-4" />
              Plans
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === 'settings' ? 'bg-white text-maroon shadow-md' : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <SettingsIcon className="h-4 w-4" />
              Page Settings
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'packages' ? (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => {
                setEditingPackage(null);
                reset({
                  name: '',
                  monthlyPrice: 0,
                  yearlyPrice: 0,
                  studentLimit: 100,
                  userLimit: 5,
                  trialDays: 14,
                  features: '' as any,
                  isFeatured: false,
                  order: packages.length,
                  status: 'active',
                  description: '',
                });
                setIsModalOpen(true);
              }}
              className="px-4 md:px-6 py-2.5 bg-school-gradient text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Create Package
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {packages.map((pkg) => (
              <div key={pkg.id} className={`bg-white p-6 rounded-[2rem] border ${pkg.isFeatured ? 'border-primary ring-4 ring-primary/5' : 'border-gray-100'} shadow-sm relative group transition-all hover:shadow-xl`}>
                {pkg.isFeatured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-school-gradient text-white px-3 py-0.5 rounded-full text-[8px] font-bold flex items-center gap-1 whitespace-nowrap">
                    <Star className="h-2 w-2 fill-current" /> Featured Plan
                  </div>
                )}
                
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleMove(pkg, 'up')} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"><ArrowUp className="h-3 w-3" /></button>
                  <button onClick={() => handleMove(pkg, 'down')} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"><ArrowDown className="h-3 w-3" /></button>
                  <button onClick={() => handleEdit(pkg)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"><Edit2 className="h-3 w-3" /></button>
                  <button onClick={() => {
                    setPackageToDelete(pkg);
                    setIsDeleteConfirmOpen(true);
                  }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="h-3 w-3" /></button>
                </div>

                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <PackageIcon className="h-5 w-5 text-primary" />
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-1">
                  <h3 className="text-base font-bold text-gray-900 truncate pr-8">{pkg.name}</h3>
                  <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${pkg.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {pkg.status}
                  </span>
                </div>
                
                <div className="flex items-baseline gap-0.5 mb-0.5">
                  <span className="text-xl font-extrabold text-gray-900">${pkg.monthlyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-[10px] text-gray-400 font-medium">/mo</span>
                </div>
                <p className="text-[10px] text-gray-400 mb-3 font-medium">or ${pkg.yearlyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /yr</p>

                <div className="flex items-center gap-2 mb-4">
                  <div className="px-2 py-0.5 bg-primary/5 text-primary rounded-full text-[8px] font-bold flex items-center gap-1">
                    <Zap className="h-2 w-2" /> {pkg.trialDays} Days Trial
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  <div className="p-2 bg-gray-50 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3 w-3 text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-700">Students</span>
                    </div>
                    <span className="text-[10px] font-bold text-primary">{pkg.studentLimit.toLocaleString()}</span>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3 w-3 text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-700">Users</span>
                    </div>
                    <span className="text-[10px] font-bold text-primary">{pkg.userLimit.toLocaleString()}</span>
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {pkg.features.slice(0, 4).map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-[10px] text-gray-500">
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                      <span className="line-clamp-1">{feature}</span>
                    </li>
                  ))}
                  {pkg.features.length > 4 && (
                    <li className="text-[8px] text-gray-400 font-bold pl-5">+{pkg.features.length - 4} more features</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
            <h2 className="text-lg font-bold text-gray-900">Pricing Page Content</h2>
            <button 
              onClick={handleSavePricingSettings}
              disabled={savingSettings}
              className="flex items-center gap-2 px-4 md:px-6 py-2 bg-school-gradient text-white rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Text Settings */}
            <div className="bg-white p-4 md:p-8 rounded-[2rem] border border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/5 text-primary rounded-lg">
                  <Type className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Header Content</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Main Title</label>
                  <input 
                    type="text"
                    value={pricingSettings.title}
                    onChange={(e) => setPricingSettings({ ...pricingSettings, title: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Subtitle</label>
                  <textarea 
                    value={pricingSettings.subtitle}
                    onChange={(e) => setPricingSettings({ ...pricingSettings, subtitle: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary h-24 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Button Label</label>
                  <div className="relative">
                    <MousePointer2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                      type="text"
                      value={pricingSettings.buttonLabel}
                      onChange={(e) => setPricingSettings({ ...pricingSettings, buttonLabel: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-12 h-6 rounded-full transition-all relative ${pricingSettings.showTrialBadge ? 'bg-primary' : 'bg-gray-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${pricingSettings.showTrialBadge ? 'left-7' : 'left-1'}`} />
                    </div>
                    <input 
                      type="checkbox" 
                      className="hidden"
                      checked={pricingSettings.showTrialBadge}
                      onChange={(e) => setPricingSettings({ ...pricingSettings, showTrialBadge: e.target.checked })}
                    />
                    <span className="text-sm font-bold text-gray-700 group-hover:text-primary transition-colors">Show Trial Badge on Cards</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Highlights Settings */}
            <div className="bg-white p-4 md:p-8 rounded-[2rem] border border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/5 text-primary rounded-lg">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Feature Highlights</h2>
              </div>

              <div className="space-y-4">
                {pricingSettings.highlights.map((highlight, index) => (
                  <div key={index} className="flex gap-2">
                    <input 
                      type="text"
                      value={highlight}
                      onChange={(e) => {
                        const newHighlights = [...pricingSettings.highlights];
                        newHighlights[index] = e.target.value;
                        setPricingSettings({ ...pricingSettings, highlights: newHighlights });
                      }}
                      className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary"
                    />
                    <button 
                      onClick={() => {
                        const newHighlights = pricingSettings.highlights.filter((_, i) => i !== index);
                        setPricingSettings({ ...pricingSettings, highlights: newHighlights });
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <EyeOff className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => setPricingSettings({ ...pricingSettings, highlights: [...pricingSettings.highlights, ''] })}
                  className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold hover:border-primary hover:text-primary transition-all"
                >
                  + Add Highlight
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Package Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-[calc(100%-2rem)] md:w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 bg-gray-50/50">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">{editingPackage ? 'Edit Package' : 'Create New Package'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="h-6 w-6 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-4 md:p-8 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Package Name</label>
                  <input
                    {...register('name')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none transition-all"
                    placeholder="e.g. Silver Plan"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Monthly Price (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register('monthlyPrice', { valueAsNumber: true })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none transition-all"
                    placeholder="e.g. 29.99"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Yearly Price (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register('yearlyPrice', { valueAsNumber: true })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none transition-all"
                    placeholder="e.g. 299.99"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Student Limit</label>
                  <input
                    type="number"
                    {...register('studentLimit', { valueAsNumber: true })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">User Limit</label>
                  <input
                    type="number"
                    {...register('userLimit', { valueAsNumber: true })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Trial Days</label>
                  <input
                    type="number"
                    {...register('trialDays', { valueAsNumber: true })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Display Order</label>
                  <input
                    type="number"
                    {...register('order', { valueAsNumber: true })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none transition-all"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Description (Optional)</label>
                  <textarea
                    {...register('description')}
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none transition-all resize-none"
                    placeholder="Briefly describe what this plan is for..."
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Features (One per line)</label>
                  <textarea
                    {...register('features')}
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none transition-all resize-none"
                    placeholder="Unlimited Students&#10;Advanced Reports&#10;24/7 Support"
                  />
                  {errors.features && <p className="text-red-500 text-xs mt-1">{errors.features.message}</p>}
                </div>

                {Object.keys(errors).length > 0 && (
                  <div className="col-span-2 p-4 bg-red-50 border border-red-100 rounded-xl">
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1 text-red-500">Fix required:</p>
                    <ul className="text-[10px] text-red-500 font-bold list-disc list-inside">
                      {Object.entries(errors).map(([key, err]) => (
                        <li key={key} className="capitalize">{key}: {err?.message as string}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Status</label>
                  <select
                    {...register('status')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary outline-none transition-all"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="col-span-1 flex items-end pb-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        {...register('isFeatured')}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </div>
                    <span className="text-sm font-bold text-gray-700 group-hover:text-primary transition-colors">Featured Plan</span>
                  </label>
                </div>
              </div>

              <div className="mt-8 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 md:px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 md:px-6 py-3 bg-school-gradient text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {editingPackage ? 'Update Package' : 'Create Package'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && packageToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-[calc(100%-2rem)] md:w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 md:p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Package?</h3>
              <p className="text-gray-500 mb-8">
                Are you sure you want to delete <span className="font-bold text-gray-900">{packageToDelete.name}</span>? 
                This action cannot be undone and will affect the pricing page.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setPackageToDelete(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(packageToDelete.id)}
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
