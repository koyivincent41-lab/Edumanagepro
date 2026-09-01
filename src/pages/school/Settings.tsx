import React, { useState, useEffect } from 'react';
import { 
  School as SchoolIcon, 
  Camera, 
  Save, 
  Globe, 
  Mail, 
  Phone, 
  MapPin,
  Loader2,
  Upload,
  CreditCard,
  ChevronDown,
  Clock,
  Navigation,
  Fingerprint,
  UserCheck,
  Repeat
} from 'lucide-react';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { School, Package } from '../../types';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { COUNTRIES } from '../../constants/countries';
import { getExchangeRates, SUPPORTED_CURRENCIES, ExchangeRates } from '../../services/currencyService';
import Migration from './Payroll/Migration';
import GradingSystemSettings from './Settings/GradingSystemSettings';

const settingsSchema = z.object({
  name: z.string().min(3, 'School name must be at least 3 characters'),
  motto: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  country: z.string().optional(),
  currency: z.string().min(1, 'Currency is required'),
  academicYear: z.string().min(4, 'Academic year is required'),
  currentTerm: z.enum(['Term 1', 'Term 2', 'Term 3']),
  logo: z.string().optional(),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color').optional(),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color').optional(),
  isGradient: z.boolean().optional(),
  invoiceFooter: z.string().optional(),
  receiptFooter: z.string().optional(),
  signature: z.string().optional(),
  // Attendance Settings
  clockInStart: z.string().optional(),
  clockInEnd: z.string().optional(),
  clockOutStart: z.string().optional(),
  clockOutEnd: z.string().optional(),
  lateThresholdMinutes: z.number().min(0).optional(),
  earlyDepartureThresholdMinutes: z.number().min(0).optional(),
  requireGPS: z.boolean().optional(),
  radiusMeters: z.number().min(0).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  requireFingerprint: z.boolean().optional(),
  requireSelfie: z.boolean().optional(),
  oncePerSession: z.boolean().optional(),
});

type SettingsForm = z.infer<typeof settingsSchema>;

const PREDEFINED_COLORS = [
  { name: 'Maroon (Default)', value: '#800000' },
  { name: 'Royal Blue', value: '#1e40af' },
  { name: 'Emerald Green', value: '#065f46' },
  { name: 'Deep Purple', value: '#581c87' },
  { name: 'Slate Gray', value: '#334155' },
  { name: 'Crimson', value: '#991b1b' },
];

const PREDEFINED_GRADIENTS = [
  { name: 'Sunset', primary: '#f59e0b', secondary: '#ef4444' },
  { name: 'Ocean', primary: '#0ea5e9', secondary: '#2563eb' },
  { name: 'Forest', primary: '#22c55e', secondary: '#15803d' },
  { name: 'Midnight', primary: '#1e293b', secondary: '#0f172a' },
  { name: 'Berry', primary: '#ec4899', secondary: '#9d174d' },
];

export default function SettingsPage({ school }: { school: School | null }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [pkg, setPkg] = useState<Package | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    values: school ? {
      name: school.name,
      motto: school.motto || '',
      email: school.email,
      phone: school.phone,
      address: school.address,
      country: school.country || 'KE',
      currency: school.currency,
      academicYear: school.academicYear,
      currentTerm: school.currentTerm || 'Term 1',
      logo: school.logo || '',
      signature: school.signature || '',
      primaryColor: school.primaryColor || '#800000',
      secondaryColor: school.secondaryColor || '#800000',
      isGradient: school.isGradient || false,
      invoiceFooter: school.invoiceFooter || '',
      receiptFooter: school.receiptFooter || '',
      clockInStart: school.attendanceSettings?.clockInStart || '08:00',
      clockInEnd: school.attendanceSettings?.clockInEnd || '09:30',
      clockOutStart: school.attendanceSettings?.clockOutStart || '16:00',
      clockOutEnd: school.attendanceSettings?.clockOutEnd || '18:00',
      lateThresholdMinutes: school.attendanceSettings?.lateThresholdMinutes || 15,
      earlyDepartureThresholdMinutes: school.attendanceSettings?.earlyDepartureThresholdMinutes || 15,
      requireGPS: school.attendanceSettings?.requireGPS ?? true,
      radiusMeters: school.attendanceSettings?.radiusMeters || 100,
      latitude: school.attendanceSettings?.latitude,
      longitude: school.attendanceSettings?.longitude,
      requireFingerprint: school.attendanceSettings?.requireFingerprint ?? false,
      requireSelfie: school.attendanceSettings?.requireSelfie ?? false,
      oncePerSession: school.attendanceSettings?.oncePerSession ?? true,
    } : undefined,
  });

  const logoUrl = watch('logo');
  const signatureUrl = watch('signature');
  const primaryColor = watch('primaryColor');
  const secondaryColor = watch('secondaryColor');
  const isGradient = watch('isGradient');
  const selectedCountry = watch('country');
  const watchCurrency = watch('currency');

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const r = await getExchangeRates();
        setRates(r);
      } catch (error) {
        console.error('Error fetching rates:', error);
      }
    };
    fetchRates();
  }, []);

  useEffect(() => {
    const fetchPackage = async () => {
      if (!school?.packageId) return;
      try {
        const pkgDoc = await getDoc(doc(db, 'packages', school.packageId));
        if (pkgDoc.exists()) {
          setPkg({ id: pkgDoc.id, ...pkgDoc.data() } as Package);
        }
      } catch (error) {
        console.error('Error fetching package:', error);
      }
    };
    fetchPackage();
  }, [school?.packageId]);

  // Update currency when country changes
  useEffect(() => {
    if (selectedCountry) {
      const country = COUNTRIES.find(c => c.code === selectedCountry);
      if (country) {
        setValue('currency', country.currency, { shouldDirty: true });
      }
    }
  }, [selectedCountry, setValue]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'signature') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) { // 500KB limit for base64
        toast.error(`${type === 'logo' ? 'Logo' : 'Signature'} file size must be less than 500KB`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setValue(type, base64String, { shouldDirty: true });
        toast.success(`${type === 'logo' ? 'Logo' : 'Signature'} selected successfully!`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleColorSelect = (color: string) => {
    setValue('primaryColor', color, { shouldDirty: true });
    setValue('isGradient', false, { shouldDirty: true });
  };

  const handleGradientSelect = (primary: string, secondary: string) => {
    setValue('primaryColor', primary, { shouldDirty: true });
    setValue('secondaryColor', secondary, { shouldDirty: true });
    setValue('isGradient', true, { shouldDirty: true });
  };

  const onSubmit = async (data: SettingsForm) => {
    if (!school?.id) return;
    setIsSubmitting(true);
    try {
      const { 
        clockInStart, clockInEnd, clockOutStart, clockOutEnd, 
        lateThresholdMinutes, earlyDepartureThresholdMinutes, 
        requireGPS, radiusMeters, latitude, longitude, 
        requireFingerprint, requireSelfie, oncePerSession,
        ...schoolData 
      } = data;

      const attendanceSettings = {
        clockInStart: clockInStart || '08:00',
        clockInEnd: clockInEnd || '09:30',
        clockOutStart: clockOutStart || '16:00',
        clockOutEnd: clockOutEnd || '18:00',
        lateThresholdMinutes: lateThresholdMinutes ?? 15,
        earlyDepartureThresholdMinutes: earlyDepartureThresholdMinutes ?? 15,
        requireGPS: requireGPS ?? true,
        radiusMeters: radiusMeters ?? 100,
        latitude: latitude || null,
        longitude: longitude || null,
        requireFingerprint: requireFingerprint ?? false,
        requireSelfie: requireSelfie ?? false,
        oncePerSession: oncePerSession ?? true,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'schools', school.id), {
        ...schoolData,
        attendanceSettings,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      toast.success('School settings updated successfully!');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentThemeStyle = isGradient 
    ? { background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }
    : { backgroundColor: primaryColor };

  if (!school) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div 
      className="max-w-4xl mx-auto space-y-4 lg:space-y-8"
      style={{ 
        '--school-primary': primaryColor || '#800000',
        '--school-secondary': secondaryColor || primaryColor || '#800000',
        '--school-gradient': isGradient ? `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` : primaryColor
      } as React.CSSProperties}
    >
      <div className="bg-school-gradient p-4 lg:p-4 md:p-6 rounded-2xl lg:rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div>
            <h1 className="text-xl lg:text-xl md:text-2xl font-black text-white">School Settings</h1>
            <p className="text-xs lg:text-sm text-white/80 font-medium tracking-wide">Manage your school profile and branding.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl lg:rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 lg:p-4 md:p-8 bg-gray-50 border-b border-gray-100 flex flex-col md:flex-row items-center gap-4 lg:gap-4 md:gap-8">
          <div className="relative group">
            <input
              id="logo-upload"
              type="file"
              onChange={(e) => handleFileChange(e, 'logo')}
              accept="image/*"
              className="hidden"
            />
            <div className="w-20 h-20 lg:w-24 lg:h-24 bg-white rounded-2xl lg:rounded-3xl border border-gray-200 flex items-center justify-center text-gray-300 overflow-hidden shadow-inner">
              {logoUrl ? (
                <img src={logoUrl || undefined} alt="Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <SchoolIcon className="h-8 w-8 lg:h-10 lg:w-10" />
              )}
            </div>
            <label 
              htmlFor="logo-upload"
              className="absolute -bottom-1 -right-1 p-1.5 lg:p-2 bg-primary text-white rounded-lg lg:rounded-xl shadow-lg hover:scale-110 transition-all z-10 cursor-pointer"
            >
              <Camera className="h-3 w-3 lg:h-4 lg:w-4" />
            </label>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-lg lg:text-xl font-bold text-gray-900">{school?.name}</h3>
            <p className="text-xs lg:text-sm text-gray-500 mb-4">Update your school logo and branding details.</p>
            <div className="max-w-md mx-auto md:mx-0">
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Logo URL (Optional)</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  {...register('logo')}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all text-sm"
                  placeholder="https://example.com/logo.png"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('logo-upload')?.click()}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2 text-xs whitespace-nowrap"
                >
                  <Upload className="h-4 w-4" />
                  Upload File
                </button>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 lg:p-4 md:p-8 space-y-6 lg:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 lg:gap-4 md:gap-8">
            <div className="space-y-4 lg:space-y-6">
              <h4 className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase tracking-widest">General Information</h4>
              
              {school && (
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">Registration Date</p>
                      <p className="font-bold text-gray-900">{new Date(school.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">
                        {school.subscriptionStatus === 'trial' ? 'Trial Expiry' : 'Subscription Expiry'}
                      </p>
                      <p className="font-bold text-gray-900">
                        {school.subscriptionStatus === 'trial' 
                          ? (school.trialExpiry ? new Date(school.trialExpiry).toLocaleDateString() : 'N/A')
                          : (school.subscriptionExpiry ? new Date(school.subscriptionExpiry).toLocaleDateString() : 'N/A')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">School Name</label>
                <input
                  {...register('name')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all"
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">School Motto</label>
                <input
                  {...register('motto')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all"
                  placeholder="e.g. Excellence in Education"
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Country</label>
                  <div className="relative group/select">
                    <select
                      {...register('country')}
                      className="w-full px-4 pr-12 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all bg-white appearance-none cursor-pointer"
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none bg-maroon rounded-lg p-1 shadow-sm">
                      <ChevronDown className="h-4 w-4 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Currency</label>
                  <div className="relative group/select">
                    <select
                      {...register('currency')}
                      className="w-full px-4 pr-12 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all bg-white appearance-none cursor-pointer"
                    >
                      {COUNTRIES.map(c => (
                        <option key={`${c.code}-${c.currency}`} value={c.currency}>
                          {c.currency} ({c.currencySymbol})
                        </option>
                      ))}
                      <option value="USD">USD ($)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none bg-maroon rounded-lg p-1 shadow-sm">
                      <ChevronDown className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  
                  {pkg && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-bold text-blue-800">Plan Preview ({school?.packageId})</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-blue-900">
                          {(() => {
                            const currency = SUPPORTED_CURRENCIES.find(c => c.code === watchCurrency) || SUPPORTED_CURRENCIES[0];
                            const rate = (rates && rates[watchCurrency]) ? rates[watchCurrency] : 
                                         (watchCurrency === 'USD' ? 1 : 
                                          (watchCurrency === 'KES' ? 130 : 
                                           watchCurrency === 'UGX' ? 3800 : 
                                           watchCurrency === 'TZS' ? 2500 : 
                                           watchCurrency === 'RWF' ? 1250 : 1));
                            const converted = pkg.monthlyPrice * rate;
                            return `${currency.symbol}${converted.toLocaleString(undefined, { 
                              minimumFractionDigits: ['KES', 'UGX', 'TZS', 'RWF'].includes(watchCurrency) ? 0 : 2, 
                              maximumFractionDigits: ['KES', 'UGX', 'TZS', 'RWF'].includes(watchCurrency) ? 0 : 2 
                            })}`;
                          })()}
                          <span className="text-[10px] font-bold text-blue-600 ml-1">/ month</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Academic Year</label>
                  <div className="relative group/select">
                    <select
                      {...register('academicYear')}
                      className="w-full px-4 pr-12 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all bg-white appearance-none cursor-pointer"
                    >
                      {Array.from({ length: 2060 - 2024 + 1 }, (_, i) => {
                        const year = 2024 + i;
                        return <option key={year} value={year.toString()}>{year}</option>;
                      })}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none bg-maroon rounded-lg p-1 shadow-sm">
                      <ChevronDown className="h-4 w-4 text-white" />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-2">
                    <label className="block text-sm font-semibold text-gray-700">Current Term</label>
                    <span className="px-2 py-0.5 bg-green-100 text-green-600 text-[10px] font-black rounded uppercase tracking-widest">Active</span>
                  </div>
                  <div className="relative group/select">
                    <select
                      {...register('currentTerm')}
                      className="w-full px-4 pr-12 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all bg-white appearance-none cursor-pointer"
                    >
                      <option value="Term 1">Term 1</option>
                      <option value="Term 2">Term 2</option>
                      <option value="Term 3">Term 3</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none bg-maroon rounded-lg p-1 shadow-sm">
                      <ChevronDown className="h-4 w-4 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-semibold text-gray-700">Branding Colors</label>
                
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">Solid Colors</p>
                  <div className="flex flex-wrap gap-2">
                    {PREDEFINED_COLORS.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => handleColorSelect(c.value)}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${primaryColor === c.value && !isGradient ? 'border-gray-900 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">Gradient Options</p>
                  <div className="flex flex-wrap gap-2">
                    {PREDEFINED_GRADIENTS.map(g => (
                      <button
                        key={g.name}
                        type="button"
                        onClick={() => handleGradientSelect(g.primary, g.secondary)}
                        className={`w-12 h-8 rounded-lg border-2 transition-all ${isGradient && primaryColor === g.primary && secondaryColor === g.secondary ? 'border-gray-900 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                        style={{ background: `linear-gradient(135deg, ${g.primary}, ${g.secondary})` }}
                        title={g.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        {...register('primaryColor')}
                        type="color"
                        className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer"
                      />
                      <input
                        {...register('primaryColor')}
                        type="text"
                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-primary outline-none uppercase"
                      />
                    </div>
                  </div>
                  {isGradient && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Secondary Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          {...register('secondaryColor')}
                          type="color"
                          className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer"
                        />
                        <input
                          {...register('secondaryColor')}
                          type="text"
                          className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-primary outline-none uppercase"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    {...register('isGradient')}
                    id="isGradient"
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="isGradient" className="text-sm text-gray-600">Enable Gradient Mode</label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Invoice Footer Note</label>
                <textarea
                  {...register('invoiceFooter')}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all resize-none"
                  placeholder="e.g. Thank you for your continued support."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Receipt Footer Note</label>
                <textarea
                  {...register('receiptFooter')}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all resize-none"
                  placeholder="e.g. This is an official receipt."
                />
              </div>

              {/* Attendance Settings Section */}
              <div className="pt-8 border-t border-gray-100 space-y-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Attendance Settings</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Clock-In Window</label>
                    <div className="flex items-center gap-2">
                      <input
                        {...register('clockInStart')}
                        type="time"
                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-primary outline-none"
                      />
                      <span className="text-gray-400">to</span>
                      <input
                        {...register('clockInEnd')}
                        type="time"
                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Clock-Out Window</label>
                    <div className="flex items-center gap-2">
                      <input
                        {...register('clockOutStart')}
                        type="time"
                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-primary outline-none"
                      />
                      <span className="text-gray-400">to</span>
                      <input
                        {...register('clockOutEnd')}
                        type="time"
                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Late Threshold (Mins)</label>
                    <input
                      {...register('lateThresholdMinutes', { valueAsNumber: true })}
                      type="number"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Early Departure Threshold (Mins)</label>
                    <input
                      {...register('earlyDepartureThresholdMinutes', { valueAsNumber: true })}
                      type="number"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-primary outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-xl shadow-sm">
                        <Navigation className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">GPS Geofencing</p>
                        <p className="text-[10px] text-gray-500">Restrict attendance to a specific radius.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600">Radius (m):</span>
                        <input
                          {...register('radiusMeters', { valueAsNumber: true })}
                          type="number"
                          className="w-20 px-2 py-1 text-xs rounded-lg border border-gray-200 focus:border-primary outline-none"
                        />
                      </div>
                      <input
                        type="checkbox"
                        {...register('requireGPS')}
                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </div>
                  </div>

                  {watch('requireGPS') && (
                    <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Latitude</label>
                          <input
                            {...register('latitude', { valueAsNumber: true })}
                            type="number"
                            step="any"
                            className="w-full px-3 py-2 text-xs rounded-lg border border-blue-200 bg-white focus:border-blue-600 outline-none"
                            placeholder="e.g. -1.286389"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Longitude</label>
                          <input
                            {...register('longitude', { valueAsNumber: true })}
                            type="number"
                            step="any"
                            className="w-full px-3 py-2 text-xs rounded-lg border border-blue-200 bg-white focus:border-blue-600 outline-none"
                            placeholder="e.g. 36.817223"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const options = {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 0
                          };
                          
                          toast.promise(
                            new Promise((resolve, reject) => {
                              navigator.geolocation.getCurrentPosition(
                                (pos) => {
                                  setValue('latitude', pos.coords.latitude, { shouldDirty: true });
                                  setValue('longitude', pos.coords.longitude, { shouldDirty: true });
                                  resolve(pos);
                                },
                                (err) => reject(err),
                                options
                              );
                            }),
                            {
                              loading: 'Capturing location...',
                              success: 'Location captured successfully!',
                              error: (err: any) => {
                                if (err.code === 1) return 'Permission denied. Please allow location access in your browser settings.';
                                if (err.code === 2) return 'Position unavailable. Check your GPS signal.';
                                if (err.code === 3) return 'Request timed out. Try again.';
                                return 'Failed to capture location.';
                              }
                            }
                          );
                        }}
                        className="w-full py-2 bg-white border border-blue-200 text-blue-600 text-xs font-bold rounded-xl hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                      >
                        <MapPin className="h-3 w-3" />
                        Capture Current Location
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <Fingerprint className="h-4 w-4 text-gray-400" />
                        <span className="text-xs font-bold text-gray-700">Fingerprint Mandatory</span>
                      </div>
                      <input
                        type="checkbox"
                        {...register('requireFingerprint')}
                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <UserCheck className="h-4 w-4 text-gray-400" />
                        <span className="text-xs font-bold text-gray-700">Selfie Required</span>
                      </div>
                      <input
                        type="checkbox"
                        {...register('requireSelfie')}
                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <Repeat className="h-4 w-4 text-gray-400" />
                        <span className="text-xs font-bold text-gray-700">Once Per Session</span>
                      </div>
                      <input
                        type="checkbox"
                        {...register('oncePerSession')}
                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contact Details</h4>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Public Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    {...register('email')}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all"
                  />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    {...register('phone')}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all"
                  />
                </div>
                {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Physical Address</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <textarea
                    {...register('address')}
                    rows={3}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all resize-none"
                  />
                </div>
                {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address.message}</p>}
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-10 py-4 text-white font-bold rounded-2xl shadow-xl transition-all disabled:opacity-50 flex items-center gap-2"
              style={currentThemeStyle}
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              Save Changes
            </button>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Grading System</h3>
            <p className="text-sm text-gray-500 mb-4">Configure the grading system used for exam reports.</p>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <GradingSystemSettings schoolId={school.id} />
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Data Migration</h3>
            <Migration schoolId={school.id} />
          </div>
        </form>
      </div>
    </div>
  );
}
