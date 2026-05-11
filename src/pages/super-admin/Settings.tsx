import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { toast } from 'sonner';
import { Loader2, Lock, ShieldCheck, Mail, Bell, Save, Layers, Globe, Upload, Trash2 } from 'lucide-react';
import { COUNTRIES } from '../../constants/countries';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordForm = z.infer<typeof passwordSchema>;

interface SystemSettings {
  contactEmail: string;
  notifications: {
    newSignup: boolean;
    subscriptionExpiry: boolean;
    paymentReceived: boolean;
  };
  primaryColor?: string;
  secondaryColor?: string;
  isGradient?: boolean;
  // Branding for Invoices/Receipts
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyLogo?: string;
  companySignature?: string;
  currency: string;
  invoicePrefix: string;
  receiptPrefix: string;
  nextInvoiceNumber: number;
  nextReceiptNumber: number;
}

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

export default function Settings() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    contactEmail: 'support@edumanagepro.com',
    notifications: {
      newSignup: true,
      subscriptionExpiry: true,
      paymentReceived: true,
    },
    primaryColor: '#800000',
    secondaryColor: '#800000',
    isGradient: false,
    companyName: 'EduManagePro',
    companyAddress: '123 Education Way, Tech City',
    companyPhone: '+1 234 567 890',
    currency: 'UGX',
    invoicePrefix: 'INV-EMP-',
    receiptPrefix: 'REC-EMP-',
    nextInvoiceNumber: 1001,
    nextReceiptNumber: 5001,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'system'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemSettings(snapshot.data() as SystemSettings);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const onChangePassword = async (data: PasswordForm) => {
    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('User not found');

      const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, data.newPassword);
      
      toast.success('Password updated successfully');
      reset();
    } catch (error: any) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/wrong-password') {
        toast.error('Current password is incorrect');
      } else {
        toast.error('Failed to update password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSaveSystemSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'system'), systemSettings);
      toast.success('System settings updated successfully');
    } catch (error) {
      toast.error('Failed to update system settings');
    }
  };

  const handleColorSelect = (color: string) => {
    setSystemSettings({
      ...systemSettings,
      primaryColor: color,
      isGradient: false,
    });
  };

  const handleGradientSelect = (primary: string, secondary: string) => {
    setSystemSettings({
      ...systemSettings,
      primaryColor: primary,
      secondaryColor: secondary,
      isGradient: true,
    });
  };

  const primaryColor = systemSettings.primaryColor || '#800000';
  const secondaryColor = systemSettings.secondaryColor || '#800000';
  const isGradient = systemSettings.isGradient || false;

  const currentThemeStyle = isGradient 
    ? { background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }
    : { backgroundColor: primaryColor };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'companyLogo' | 'companySignature') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      toast.error(`File size must be less than 500KB. Selected: ${(file.size / 1024).toFixed(1)}KB`);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSystemSettings(prev => ({ ...prev, [field]: reader.result as string }));
    };
    reader.readAsDataURL(file);
    
    // Clear the input so the same file could be selected if needed
    e.target.value = '';
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div 
      className="max-w-4xl mx-auto space-y-8"
      style={{ 
        '--school-primary': primaryColor,
        '--school-secondary': secondaryColor,
        '--school-gradient': isGradient ? `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` : primaryColor
      } as React.CSSProperties}
    >
      <div className="bg-school-gradient p-4 md:p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white">System Settings</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Manage your super admin account and system-wide configurations.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        {/* Branding & Setup Section */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden lg:col-span-2">
          <div className="bg-school-gradient p-4 md:p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl text-white">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold">EduManagePro Branding</h2>
                <p className="text-sm text-white/70">Configure branding for system-generated invoices and receipts.</p>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Company Name</label>
                <input
                  type="text"
                  value={systemSettings.companyName}
                  onChange={(e) => setSystemSettings({ ...systemSettings, companyName: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all"
                  placeholder="EduManagePro"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Company Address</label>
                <textarea
                  value={systemSettings.companyAddress}
                  onChange={(e) => setSystemSettings({ ...systemSettings, companyAddress: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all h-24 resize-none"
                  placeholder="123 Education Way, Tech City"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Company Phone</label>
                <input
                  type="text"
                  value={systemSettings.companyPhone}
                  onChange={(e) => setSystemSettings({ ...systemSettings, companyPhone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all"
                  placeholder="+1 234 567 890"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">System Currency</label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    value={systemSettings.currency}
                    onChange={(e) => setSystemSettings({ ...systemSettings, currency: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all bg-white"
                  >
                    {COUNTRIES.map(c => (
                      <option key={`${c.code}-${c.currency}`} value={c.currency}>
                        {c.currency} ({c.currencySymbol}) - {c.name}
                      </option>
                    ))}
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
                <p className="mt-1 text-[10px] text-gray-400 italic">This currency will be used for all system-wide reports and financial displays.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Invoice Prefix</label>
                  <input
                    type="text"
                    value={systemSettings.invoicePrefix}
                    onChange={(e) => setSystemSettings({ ...systemSettings, invoicePrefix: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Receipt Prefix</label>
                  <input
                    type="text"
                    value={systemSettings.receiptPrefix}
                    onChange={(e) => setSystemSettings({ ...systemSettings, receiptPrefix: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Official Logo</label>
                  <div className="relative aspect-square bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden">
                    {systemSettings.companyLogo ? (
                      <>
                        <img src={systemSettings.companyLogo} alt="Logo" className="w-full h-full object-contain p-4 bg-white" />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <label className="cursor-pointer p-2 bg-white border border-gray-100 rounded-full text-blue-600 hover:scale-110 transition-transform shadow-sm">
                            <Upload className="h-4 w-4" />
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'companyLogo')} />
                          </label>
                          <button 
                            type="button"
                            onClick={() => setSystemSettings(prev => ({ ...prev, companyLogo: '' }))}
                            className="p-2 bg-white border border-gray-100 rounded-full text-red-600 hover:scale-110 transition-transform shadow-sm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-primary transition-colors hover:bg-gray-100">
                        <Upload className="h-8 w-8" />
                        <span className="text-xs font-bold uppercase tracking-wider text-center px-4">Upload Logo<br/><span className="text-[10px] text-gray-400 normal-case">(Max 500KB)</span></span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'companyLogo')} />
                      </label>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Official Signature</label>
                  <div className="relative aspect-square bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden">
                    {systemSettings.companySignature ? (
                      <>
                        <img src={systemSettings.companySignature} alt="Signature" className="w-full h-full object-contain p-4 bg-white" />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <label className="cursor-pointer p-2 bg-white border border-gray-100 rounded-full text-blue-600 hover:scale-110 transition-transform shadow-sm">
                            <Upload className="h-4 w-4" />
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'companySignature')} />
                          </label>
                          <button 
                            type="button"
                            onClick={() => setSystemSettings(prev => ({ ...prev, companySignature: '' }))}
                            className="p-2 bg-white border border-gray-100 rounded-full text-red-600 hover:scale-110 transition-transform shadow-sm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-primary transition-colors hover:bg-gray-100">
                        <Upload className="h-8 w-8" />
                        <span className="text-xs font-bold uppercase tracking-wider text-center px-4">Upload Signature<br/><span className="text-[10px] text-gray-400 normal-case">(Max 500KB)</span></span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'companySignature')} />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={onSaveSystemSettings}
                className="w-full py-4 text-white font-bold rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
                style={currentThemeStyle}
              >
                <Save className="h-5 w-5" /> Save Branding & Setup
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 lg:col-span-2">
        {/* Password Section */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-school-gradient p-4 md:p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl text-white">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Change Password</h2>
                <p className="text-sm text-white/70">Update your login credentials.</p>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-8">
            <form onSubmit={handleSubmit(onChangePassword)} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
              <input
                {...register('currentPassword')}
                type="password"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all"
                placeholder="••••••••"
              />
              {errors.currentPassword && <p className="mt-1 text-xs text-red-500">{errors.currentPassword.message}</p>}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                <input
                  {...register('newPassword')}
                  type="password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all"
                  placeholder="••••••••"
                />
                {errors.newPassword && <p className="mt-1 text-xs text-red-500">{errors.newPassword.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                <input
                  {...register('confirmPassword')}
                  type="password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all"
                  placeholder="••••••••"
                />
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 text-white font-bold rounded-2xl shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              style={currentThemeStyle}
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
              Update Password
            </button>
          </form>
        </div>
      </div>

      {/* System Config Section */}
        <div className="space-y-8">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-school-gradient p-4 md:p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl text-white">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Contact Settings</h2>
                  <p className="text-sm text-white/70">System-wide contact information.</p>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-8 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">System Contact Email</label>
                <input
                  type="email"
                  value={systemSettings.contactEmail}
                  onChange={(e) => setSystemSettings({ ...systemSettings, contactEmail: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none transition-all"
                  placeholder="support@example.com"
                />
              </div>
              <button 
                onClick={onSaveSystemSettings}
                className="w-full py-3 text-white font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
                style={currentThemeStyle}
              >
                <Save className="h-4 w-4" /> Save Contact Info
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-school-gradient p-4 md:p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl text-white">
                  <Bell className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Notifications</h2>
                  <p className="text-sm text-white/70">Manage system alerts.</p>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-8 space-y-4">
              {[
                { key: 'newSignup', label: 'New School Signup' },
                { key: 'subscriptionExpiry', label: 'Subscription Expiry Alerts' },
                { key: 'paymentReceived', label: 'Payment Received Notifications' },
              ].map((item) => (
                <label key={item.key} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <span className="text-sm font-bold text-gray-700">{item.label}</span>
                  <input 
                    type="checkbox"
                    checked={(systemSettings.notifications as any)[item.key]}
                    onChange={(e) => setSystemSettings({
                      ...systemSettings,
                      notifications: {
                        ...systemSettings.notifications,
                        [item.key]: e.target.checked
                      }
                    })}
                    className="w-5 h-5 accent-primary"
                  />
                </label>
              ))}
              <button 
                onClick={onSaveSystemSettings}
                className="w-full py-3 text-white font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
                style={currentThemeStyle}
              >
                <Save className="h-4 w-4" /> Save Notification Settings
              </button>
            </div>
          </div>

          {/* Theme Settings */}
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-school-gradient p-4 md:p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl text-white">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Dashboard Theme</h2>
                  <p className="text-sm text-white/70">Customize the look and feel of the super admin panel.</p>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-8 space-y-6">
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
                      value={primaryColor}
                      onChange={(e) => setSystemSettings({ ...systemSettings, primaryColor: e.target.value })}
                      type="color"
                      className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer"
                    />
                    <input
                      value={primaryColor}
                      onChange={(e) => setSystemSettings({ ...systemSettings, primaryColor: e.target.value })}
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
                        value={secondaryColor}
                        onChange={(e) => setSystemSettings({ ...systemSettings, secondaryColor: e.target.value })}
                        type="color"
                        className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer"
                      />
                      <input
                        value={secondaryColor}
                        onChange={(e) => setSystemSettings({ ...systemSettings, secondaryColor: e.target.value })}
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
                  checked={isGradient}
                  onChange={(e) => setSystemSettings({ ...systemSettings, isGradient: e.target.checked })}
                  id="isGradient"
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="isGradient" className="text-sm text-gray-600">Enable Gradient Mode</label>
              </div>

              <button 
                onClick={onSaveSystemSettings}
                className="w-full py-3 text-white font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
                style={currentThemeStyle}
              >
                <Save className="h-4 w-4" /> Save Theme Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
