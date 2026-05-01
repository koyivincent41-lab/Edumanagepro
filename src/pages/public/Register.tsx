import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, CreditCard, Wallet, Globe, GraduationCap, Lock, ChevronDown } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import { auth as firebaseAuth, db } from '../../firebase';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, query, where, getDocs, runTransaction, limit, onSnapshot, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Package } from '../../types';
import { getExchangeRates, SUPPORTED_CURRENCIES, ExchangeRates } from '../../services/currencyService';
import { COUNTRIES } from '../../constants/countries';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrorHandler';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  schoolName: z.string().min(3, 'School name must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(10, 'Phone number must be at least 10 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  country: z.string().min(1, 'Please select a country'),
  currency: z.string().min(1, 'Please select a currency'),
  academicYear: z.string().min(4, 'Academic year is required'),
  packageId: z.string().min(1, 'Please select a package'),
  billingCycle: z.enum(['monthly', 'six-months', 'yearly']),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      country: 'KE',
      currency: 'KES',
      academicYear: new Date().getFullYear().toString(),
      packageId: '',
      billingCycle: 'monthly',
    },
  });

  const watchCountry = watch('country') || 'KE';
  const watchCurrency = watch('currency') || 'KES';
  const watchPackageId = watch('packageId');
  const watchBillingCycle = watch('billingCycle') || 'monthly';

  useEffect(() => {
    // Automatically update currency when country changes
    const country = COUNTRIES.find(c => c.code === watchCountry);
    if (country) {
      setValue('currency', country.currency);
    }
  }, [watchCountry, setValue]);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const q = query(
          collection(db, 'packages'),
          where('status', '==', 'active')
        );
        const querySnapshot = await getDocs(q);
        const pkgs = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Package)).sort((a, b) => (a.order || 0) - (b.order || 0));
        
        setPackages(pkgs);
        if (pkgs.length > 0 && !watchPackageId) {
          setValue('packageId', pkgs[0].id);
        }
      } catch (error) {
        console.error('Error fetching packages:', error);
        toast.error('Failed to load packages');
      } finally {
        setLoadingPackages(false);
      }
    };

    fetchPackages();

    const fetchRates = async () => {
      const r = await getExchangeRates();
      setRates(r);
    };
    fetchRates();
  }, []);

  const convertPrice = (price: number) => {
    const currency = SUPPORTED_CURRENCIES.find(c => c.code === watchCurrency) || SUPPORTED_CURRENCIES[0];
    const rate = (rates && rates[watchCurrency]) ? rates[watchCurrency] : 
                 (watchCurrency === 'USD' ? 1 : 
                  (watchCurrency === 'KES' ? 130 : 
                   watchCurrency === 'UGX' ? 3800 : 
                   watchCurrency === 'TZS' ? 2500 : 
                   watchCurrency === 'RWF' ? 1250 : 1));
    const converted = price * rate;
    return {
      value: converted.toLocaleString(undefined, { 
        minimumFractionDigits: ['KES', 'UGX', 'TZS', 'RWF'].includes(watchCurrency) ? 0 : 2, 
        maximumFractionDigits: ['KES', 'UGX', 'TZS', 'RWF'].includes(watchCurrency) ? 0 : 2 
      }),
      symbol: currency.symbol,
      rate: rate
    };
  };

  const getSelectedPackage = () => packages.find(p => p.id === watchPackageId);

  const selectedPkg = getSelectedPackage();
  const selectedPrice = selectedPkg 
    ? (watchBillingCycle === 'yearly' 
        ? (selectedPkg.monthlyPrice * 12) * 0.7 
        : watchBillingCycle === 'six-months' 
          ? selectedPkg.monthlyPrice * 6 
          : selectedPkg.monthlyPrice)
    : 0;
  const convertedSelectedPrice = convertPrice(selectedPrice);

  const onSubmit = async (data: RegisterForm) => {
    if (!data.packageId) {
      toast.error('Please select a package');
      return;
    }

    setIsSubmitting(true);
    try {
      const { user } = await createUserWithEmailAndPassword(firebaseAuth, data.email, data.password);
      
      // Create School document
      const schoolRef = doc(collection(db, 'schools'));
      const schoolId = schoolRef.id;
      
      const trialDays = selectedPkg?.trialDays || 14;
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + trialDays);

      await setDoc(schoolRef, {
        id: schoolId,
        name: data.schoolName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        country: data.country,
        currency: data.currency,
        academicYear: data.academicYear,
        packageId: data.packageId,
        status: 'active',
        subscriptionStatus: 'trial',
        trialExpiry: trialExpiry.toISOString(),
        createdAt: new Date().toISOString(),
        ownerId: user.uid,
        studentCount: 0,
        userCount: 1
      });

      // Create User Profile document
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: data.email,
        fullName: data.fullName,
        role: 'owner',
        schoolId: schoolId,
        status: 'active',
        createdAt: new Date().toISOString()
      });

      toast.success('Registration successful! Welcome to EduManagePro.');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('User already exists. Please sign in');
      } else if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
        const pId = firebaseAuth.app.options.projectId;
        const consoleLink = `https://console.firebase.google.com/project/${pId}/authentication/providers`;
        toast.error(
          <div className="flex flex-col gap-1">
            <p className="font-black text-[10px] uppercase tracking-widest text-red-500">Registration Restricted</p>
            <p className="text-[10px] font-medium leading-relaxed">
              Email/Password registration is either disabled or restricted for project: <span className="font-mono text-maroon font-bold select-all">{pId}</span>
              <br />
              1. Enable "Email/Password" in Firebase Console.
              <br />
              2. Add <span className="font-mono font-bold">{window.location.hostname}</span> to "Authorized Domains" in Auth settings.
            </p>
            <a href={consoleLink} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-500 hover:underline mt-1">Open Firebase Settings &rarr;</a>
          </div>,
          { duration: 25000 }
        );
      } else if (error.code === 'auth/invalid-api-key' || error.code === 'auth/api-key-not-valid') {
        toast.error('Firebase API Key is invalid. Please check your firebase-applet-config.json.');
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <div className="min-h-screen relative py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-maroon/10 dark:bg-maroon/20 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gray-400/10 dark:bg-gray-800/20 blur-[120px] animate-pulse delay-700" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9)_0%,rgba(243,244,246,0.4)_50%,transparent_100%)] dark:bg-[radial-gradient(circle_at_center,rgba(17,24,39,0.8)_0%,transparent_100%)]" />
          
          {/* Decorative floating elements */}
          <div className="absolute top-[10%] right-[10%] w-96 h-96 bg-maroon/5 rounded-full blur-3xl animate-bounce duration-[15s]" />
          <div className="absolute bottom-[10%] left-[10%] w-96 h-96 bg-gray-300/10 dark:bg-gray-700/5 rounded-full blur-3xl animate-bounce duration-[18s] delay-1000" />
        </div>

        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">
              Register Your <span className="text-maroon">School</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">Join EduManagePro today and start your 7-day free trial.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl p-8 md:p-12 rounded-[3.5rem] border border-white/50 dark:border-gray-800 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group">
            {/* Decorative border glow */}
            <div className="absolute inset-0 border-2 border-transparent bg-gradient-to-br from-maroon/10 via-transparent to-gray-400/10 rounded-[3.5rem] pointer-events-none opacity-50" />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 relative">
              {/* Left Column: School & Account Info */}
              <div className="space-y-10">
                <div className="space-y-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-maroon/10 rounded-xl">
                      <GraduationCap className="h-5 w-5 text-maroon" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest text-sm">School Information</h3>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Your Full Name</label>
                    <input
                      {...register('fullName')}
                      className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
                      placeholder="e.g. John Doe"
                    />
                    {errors.fullName && <p className="mt-1 text-[10px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.fullName.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">School Name</label>
                    <input
                      {...register('schoolName')}
                      className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
                      placeholder="e.g. Crownhill Academy"
                    />
                    {errors.schoolName && <p className="mt-1 text-[10px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.schoolName.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">School Address</label>
                    <textarea
                      {...register('address')}
                      rows={3}
                      className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 resize-none"
                      placeholder="Physical location"
                    />
                    {errors.address && <p className="mt-1 text-[10px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.address.message}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Country</label>
                      <div className="relative group/select">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within/select:text-maroon transition-colors" />
                        <select
                          {...register('country')}
                          className="w-full pl-12 pr-12 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-gray-900 dark:text-white appearance-none cursor-pointer"
                        >
                          {COUNTRIES.map(c => (
                            <option key={c.code} value={c.code} className="bg-white dark:bg-gray-900">{c.name}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none bg-maroon rounded-lg p-1 shadow-sm">
                          <ChevronDown className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      {errors.country && <p className="mt-1 text-[10px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.country.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Currency</label>
                      <select
                        {...register('currency')}
                        className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-gray-900 dark:text-white appearance-none cursor-pointer"
                      >
                        {SUPPORTED_CURRENCIES.map(c => (
                          <option key={c.code} value={c.code} className="bg-white dark:bg-gray-900">{c.code} ({c.symbol}) - {c.name}</option>
                        ))}
                      </select>
                      {rates && watchCurrency !== 'USD' && (
                        <p className="mt-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 flex items-center gap-1 ml-1">
                          <Globe className="h-3 w-3" />
                          Rate: 1 USD = {rates[watchCurrency]?.toLocaleString()} {watchCurrency}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Academic Year</label>
                    <div className="relative group/select">
                      <select
                        {...register('academicYear')}
                        className="w-full px-5 pr-12 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-gray-900 dark:text-white appearance-none cursor-pointer"
                      >
                        {Array.from({ length: 2090 - new Date().getFullYear() + 1 }, (_, i) => {
                          const year = new Date().getFullYear() + i;
                          return <option key={year} value={year.toString()} className="bg-white dark:bg-gray-900">{year}</option>;
                        })}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none bg-maroon rounded-lg p-1 shadow-sm">
                        <ChevronDown className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/10 rounded-xl">
                      <Lock className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest text-sm">Account & Security</h3>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Phone Number</label>
                    <input
                      {...register('phone')}
                      className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
                      placeholder="+254..."
                    />
                    {errors.phone && <p className="mt-1 text-[10px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.phone.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Email Address</label>
                    <input
                      {...register('email')}
                      type="email"
                      className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
                      placeholder="school@example.com"
                    />
                    {errors.email && <p className="mt-1 text-[10px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.email.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Password</label>
                    <input
                      {...register('password')}
                      type="password"
                      className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
                      placeholder="••••••••"
                    />
                    {errors.password && <p className="mt-1 text-[10px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.password.message}</p>}
                  </div>
                </div>
              </div>

              {/* Right Column: Package & Billing */}
              <div className="space-y-10">
                <div className="space-y-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                      <CreditCard className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest text-sm">Select Package & Billing</h3>
                  </div>
                  
                  {loadingPackages ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-10 w-10 animate-spin text-maroon" />
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {packages.map((pkg) => {
                          const price = watchBillingCycle === 'yearly' 
                            ? (pkg.monthlyPrice * 12) * 0.7 
                            : watchBillingCycle === 'six-months'
                              ? pkg.monthlyPrice * 6
                              : pkg.monthlyPrice;
                          const converted = convertPrice(price);
                          return (
                            <label key={pkg.id} className="relative cursor-pointer group">
                              <input
                                type="radio"
                                {...register('packageId')}
                                value={pkg.id}
                                className="peer sr-only"
                              />
                              <div className="p-5 text-center border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-800/50 rounded-[2rem] peer-checked:border-maroon peer-checked:bg-maroon/5 dark:peer-checked:bg-maroon/10 peer-checked:ring-4 peer-checked:ring-maroon/5 transition-all group-hover:border-maroon/30 h-full flex flex-col justify-center shadow-sm">
                                <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 peer-checked:text-maroon mb-2">{pkg.name}</span>
                                <span className="block text-lg font-black text-gray-900 dark:text-white">{converted.symbol}{converted.value}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      {errors.packageId && <p className="mt-1 text-[10px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.packageId.message}</p>}
                      
                      <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                        <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4 ml-1">Billing Cycle</label>
                        <div className="flex flex-wrap gap-3">
                          <label className="flex-1 min-w-[100px] relative cursor-pointer group">
                            <input
                              type="radio"
                              {...register('billingCycle')}
                              value="monthly"
                              className="peer sr-only"
                            />
                            <div className="py-3 text-center border border-gray-100 dark:border-gray-700 rounded-2xl peer-checked:border-maroon peer-checked:bg-maroon peer-checked:text-white transition-all text-[10px] font-black uppercase tracking-widest shadow-sm">
                              Monthly
                            </div>
                          </label>
                          <label className="flex-1 min-w-[100px] relative cursor-pointer group">
                            <input
                              type="radio"
                              {...register('billingCycle')}
                              value="six-months"
                              className="peer sr-only"
                            />
                            <div className="py-3 text-center border border-gray-100 dark:border-gray-700 rounded-2xl peer-checked:border-maroon peer-checked:bg-maroon peer-checked:text-white transition-all text-[10px] font-black uppercase tracking-widest shadow-sm">
                              6 Months
                            </div>
                          </label>
                          <label className="flex-1 min-w-[100px] relative cursor-pointer group">
                            <input
                              type="radio"
                              {...register('billingCycle')}
                              value="yearly"
                              className="peer sr-only"
                            />
                            <div className="py-3 text-center border border-gray-100 dark:border-gray-700 rounded-2xl peer-checked:border-maroon peer-checked:bg-maroon peer-checked:text-white transition-all text-[10px] font-black uppercase tracking-widest shadow-sm">
                              12 Months (-30%)
                            </div>
                          </label>
                        </div>
                      </div>

                      {selectedPkg && (
                        <div className="bg-gradient-to-br from-maroon/5 to-gray-400/5 p-8 rounded-[3rem] border border-white/50 dark:border-gray-800 shadow-inner mt-8 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Wallet className="h-24 w-24 dark:text-white" />
                          </div>
                          <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2 relative z-10">
                            <CheckCircle2 className="h-5 w-5 text-maroon" />
                            Trial Summary
                          </h4>
                          <div className="space-y-4 text-sm relative z-10">
                            <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Selected Plan:</span>
                              <span className="font-black text-gray-900 dark:text-white uppercase tracking-wider">{selectedPkg.name}</span>
                            </div>
                            <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Billing Cycle:</span>
                              <span className="font-black text-gray-900 dark:text-white uppercase tracking-wider capitalize">{watchBillingCycle.replace('-', ' ')}</span>
                            </div>
                            <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Trial Period:</span>
                              <span className="px-3 py-1 bg-maroon/10 text-maroon rounded-full font-black text-[10px] uppercase tracking-widest">7 Days Free</span>
                            </div>
                            <div className="pt-4 border-t border-gray-200/50 dark:border-gray-800 flex justify-between items-center text-gray-900 dark:text-white">
                              <span className="font-black uppercase tracking-widest text-xs">Due Today:</span>
                              <span className="text-2xl font-black">{convertedSelectedPrice.symbol}0.00</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-6 italic font-medium">
                            * Your card will not be charged today. You can set up your payment method later from your school dashboard.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-16 pt-10 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row items-center justify-between gap-8 relative">
              <p className="text-xs text-gray-400 dark:text-gray-500 font-medium max-w-xs text-center md:text-left leading-relaxed">
                By registering, you agree to our <Link to="/terms" className="text-maroon font-bold hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-maroon font-bold hover:underline">Privacy Policy</Link>.
              </p>
              <button
                type="submit"
                disabled={isSubmitting || loadingPackages}
                className="w-full md:w-auto px-16 py-5 bg-maroon text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-2xl shadow-maroon/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3 relative group/btn overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite]" />
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Initializing Workspace...
                  </>
                ) : (
                  <>
                    Start Free Trial & Register
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-10 text-center">
            <p className="text-sm text-gray-500 font-medium">
              Already have a school account?{' '}
              <Link to="/login" className="font-black text-maroon hover:underline decoration-2 underline-offset-4 transition-all">Sign In Here</Link>
            </p>
          </div>

          <p className="mt-12 text-center text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">
            &copy; {new Date().getFullYear()} EduManagePro Systems
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}

