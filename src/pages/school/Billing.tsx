import React, { useState, useEffect } from 'react';
import { School, Package, SubscriptionPayment } from '../../types';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, collection, addDoc, setDoc, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';
import { CreditCard, AlertCircle, CheckCircle2, Loader2, Calendar, Globe, Phone, Mail, X, Info, Clock, Package as PackageIcon, Tag } from 'lucide-react';
import { getExchangeRates, SUPPORTED_CURRENCIES, ExchangeRates } from '../../services/currencyService';
import { subscriptionService } from '../../services/subscriptionService';
import { MPESA_CONFIG } from '../../constants/mpesa';

export default function Billing({ school }: { school: School | null }) {
  const [pkg, setPkg] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [showMpesaModal, setShowMpesaModal] = useState(false);
  const [loadingMpesa, setLoadingMpesa] = useState(false);
  const [mpesaCode, setMpesaCode] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState(school?.phone || '');
  const [mpesaAmount, setMpesaAmount] = useState('0');
  const [mpesaNotes, setMpesaNotes] = useState('');
  const [billingInfo, setBillingInfo] = useState({
    firstName: school?.name?.split(' ')[0] || '',
    lastName: school?.name?.split(' ').slice(1).join(' ') || 'Admin',
    email: school?.email || '',
    phone: school?.phone || '',
  });

  const [packages, setPackages] = useState<Package[]>([]);
  const [submissions, setSubmissions] = useState<SubscriptionPayment[]>([]);
  const [selectingPlan, setSelectingPlan] = useState(false);

  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'six-months' | 'yearly'>((school as any).billingCycle || 'monthly');

  useEffect(() => {
    const fetchPackage = async () => {
      if (!school?.packageId) {
        setLoading(false);
        setSelectingPlan(true);
        return;
      }
      try {
        const pkgDoc = await getDoc(doc(db, 'packages', school.packageId));
        if (pkgDoc.exists()) {
          setPkg({ id: pkgDoc.id, ...pkgDoc.data() } as Package);
          setSelectingPlan(false);
        } else {
          setSelectingPlan(true);
        }
      } catch (error) {
        console.error('Error fetching package:', error);
        setSelectingPlan(true);
      } finally {
        setLoading(false);
      }
    };

    const fetchAllPackages = async () => {
      try {
        const q = query(collection(db, 'packages'), where('status', '==', 'active'));
        const snap = await getDocs(q);
        setPackages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Package)));
      } catch (error) {
        console.error('Error fetching packages:', error);
      }
    };

    const fetchSubmissions = async () => {
      if (!school?.id) return;
      try {
        const q = query(collection(db, 'payment_submissions'), where('schoolId', '==', school.id));
        const unsubscribe = onSnapshot(q, (snap) => {
          setSubmissions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
        });
        return unsubscribe;
      } catch (error) {
        console.error('Error fetching submissions:', error);
      }
    };

    const fetchRates = async () => {
      try {
        const r = await getExchangeRates();
        setRates(r);
      } catch (error) {
        console.error('Error fetching exchange rates:', error);
      }
    };

    fetchPackage();
    fetchAllPackages();
    fetchSubmissions();
    fetchRates();
  }, [school?.packageId, school?.id]);

  if (!school) return null;

  const handleSelectPackage = async (p: Package) => {
    setPkg(p);
    setSelectingPlan(false);
    // update packageId in school if it was empty
    if (!school.packageId) {
      try {
        await updateDoc(doc(db, 'schools', school.id), { packageId: p.id });
      } catch (e) {
        console.error('Error updating school package:', e);
      }
    }
  };

  const isTrial = school.subscriptionStatus === 'trial';
  const isPendingApproval = school.subscriptionStatus === 'pending_approval';
  const trialExpiry = school.trialExpiry ? new Date(school.trialExpiry) : null;
  const subscriptionExpiry = school.subscriptionExpiry ? new Date(school.subscriptionExpiry) : null;
  
  const isExpired = (isTrial && trialExpiry && new Date() > trialExpiry) || 
                    (!isTrial && !isPendingApproval && subscriptionExpiry && new Date() > subscriptionExpiry) ||
                    (school.subscriptionStatus === 'expired');

  const calculateDaysLeft = (expiryDate: Date | null) => {
    if (!expiryDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = isTrial ? calculateDaysLeft(trialExpiry) : calculateDaysLeft(subscriptionExpiry);

  const billingCycle = selectedBillingCycle;
  const price = pkg 
    ? (billingCycle === 'yearly' 
        ? (pkg.monthlyPrice * 12) * 0.7 
        : billingCycle === 'six-months' 
          ? pkg.monthlyPrice * 6 
          : pkg.monthlyPrice) 
    : 0;
  const currency = school.currency || 'USD';
  const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency) || SUPPORTED_CURRENCIES[0];
  
  const rate = (rates && rates[currency]) ? rates[currency] : (currency === 'USD' ? 1 : (rates ? 1 : 1));
  // Fallback to manual rates if rates object is loaded but missing the specific currency
  const finalRate = (rates && rates[currency]) ? rates[currency] : 
                   (currency === 'KES' ? 130 : 
                    currency === 'UGX' ? 3800 : 
                    currency === 'TZS' ? 2500 : 
                    currency === 'RWF' ? 1250 : 1);
  
  const convertedPrice = price * finalRate;
  const displayPrice = convertedPrice.toLocaleString(undefined, { 
    minimumFractionDigits: ['KES', 'UGX', 'TZS', 'RWF'].includes(currency) ? 0 : 2, 
    maximumFractionDigits: ['KES', 'UGX', 'TZS', 'RWF'].includes(currency) ? 0 : 2 
  });

  useEffect(() => {
    if (pkg && rates) {
      setMpesaAmount(displayPrice.replace(/,/g, ''));
    }
  }, [pkg, rates, displayPrice]);

  const handleSubmitMpesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkg) {
      toast.error("Package information not found.");
      return;
    }

    const code = mpesaCode.trim().toUpperCase();
    
    // Validation
    if (code.length !== 10) {
      toast.error("M-PESA transaction code must be exactly 10 characters.");
      return;
    }

    if (!/^[A-Z0-9]+$/.test(code)) {
      toast.error("M-PESA transaction code must be alphanumeric (A-Z, 0-9) only.");
      return;
    }

    if (!mpesaPhone) {
      toast.error("Please provide your M-PESA phone number.");
      return;
    }

    const amountNum = parseFloat(mpesaAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount paid.");
      return;
    }
    
    setLoadingMpesa(true);
    try {
      // Check for unique transaction code across ALL schools
      const duplicateQuery = query(
        collection(db, 'payment_submissions'), 
        where('mpesaConfirmationCode', '==', code)
      );
      const duplicateSnap = await getDocs(duplicateQuery);
      
      if (!duplicateSnap.empty) {
        toast.error("This transaction code has already been submitted. If you believe this is an error, please contact support.");
        setLoadingMpesa(false);
        return;
      }

      await addDoc(collection(db, 'payment_submissions'), {
        schoolId: school.id,
        schoolName: school.name,
        schoolEmail: school.email,
        phoneNumber: mpesaPhone,
        selectedPackageId: pkg.id,
        selectedPackageName: pkg.name,
        billingCycle: billingCycle,
        originalPrice: price,
        payableAmountKES: amountNum,
        paymentMethod: 'MPESA',
        mpesaConfirmationCode: code,
        paymentStatus: 'Pending Approval',
        subscriptionStatus: 'Pending Approval',
        submittedAt: new Date().toISOString(),
        notes: mpesaNotes
      });
      
      await setDoc(doc(db, 'schools', school.id), {
        subscriptionStatus: 'pending_approval'
      }, { merge: true });
      
      toast.success("Payment submitted successfully. Awaiting verification.");
      setShowMpesaModal(false);
      setMpesaCode('');
      setMpesaNotes('');
    } catch (error) {
      console.error('Failed to submit M-PESA payment', error);
      toast.error('Failed to submit payment request. Please try again.');
    } finally {
      setLoadingMpesa(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-school-gradient p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Billing & Subscription</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Manage your school's subscription plan and payment details.</p>
          </div>
        </div>
      </div>

      {isExpired && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-red-600 shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-bold text-red-900">
              {isTrial ? 'Your free trial has expired' : 'Your subscription has expired'}
            </h3>
            <p className="text-red-700 mt-1">
              {isTrial 
                ? `Your 7-day free trial ended on ${trialExpiry?.toLocaleDateString()}. Please complete your payment to continue using EduManagePro and access your school dashboard.`
                : `Your subscription ended on ${subscriptionExpiry?.toLocaleDateString()}. Please complete your payment to reactivate your account.`}
            </p>
            <div className="mt-4">
              <button 
                onClick={() => setSelectingPlan(true)}
                className="text-sm font-bold text-red-600 hover:underline flex items-center gap-1"
              >
                Change or select a different plan &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {selectingPlan ? (
        <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Select a Subscription Plan</h2>
              <p className="text-sm text-gray-500">Choose the best plan for your school's needs</p>
            </div>
            
            {/* Billing Cycle Toggle */}
            <div className="bg-gray-100 p-1 rounded-2xl flex items-center gap-1">
              {[
                { id: 'monthly', label: 'Monthly' },
                { id: 'six-months', label: '6 Months' },
                { id: 'yearly', label: 'Yearly (Save 30%)' }
              ].map((cycle) => (
                <button
                  key={cycle.id}
                  onClick={() => setSelectedBillingCycle(cycle.id as any)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    selectedBillingCycle === cycle.id 
                      ? 'bg-white text-primary shadow-sm' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {cycle.label}
                </button>
              ))}
            </div>

            {pkg && (
              <button 
                onClick={() => setSelectingPlan(false)}
                className="text-sm font-bold text-primary hover:underline"
              >
                Cancel
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((p) => {
              const displayPrice = selectedBillingCycle === 'yearly' 
                ? Math.round((p.monthlyPrice * 12) * 0.7) 
                : selectedBillingCycle === 'six-months' 
                  ? p.monthlyPrice * 6 
                  : p.monthlyPrice;
              
              const subLabel = selectedBillingCycle === 'yearly' ? '/ year' : selectedBillingCycle === 'six-months' ? '/ 6 months' : '/ month';

              return (
                <div 
                  key={p.id} 
                  onClick={() => handleSelectPackage(p)}
                  className={`p-6 rounded-[2rem] border-2 cursor-pointer transition-all hover:scale-[1.02] ${pkg?.id === p.id ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-primary/20'}`}
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <PackageIcon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{p.name}</h3>
                  <p className="text-xs text-gray-500 mb-4">{p.description}</p>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-black text-gray-900">${displayPrice}</span>
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">{subLabel}</span>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {p.features.slice(0, 3).map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button 
                    className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${pkg?.id === p.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {pkg?.id === p.id ? 'Selected' : 'Choose Plan'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Current Plan Details */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">Current Plan</h3>
          
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Selected Package</p>
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold text-primary">{pkg?.name || 'Unknown Plan'}</p>
                <button 
                  onClick={() => setSelectingPlan(true)}
                  className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-primary transition-all underline underline-offset-4"
                >
                  Change Plan
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4 py-4 border-y border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">Billing Cycle</p>
                  <p className="font-semibold text-gray-900 capitalize">
                    {billingCycle === 'yearly' ? '12 Months (7.2 months paid)' : billingCycle === 'six-months' ? '6 Months' : 'Monthly'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">Amount</p>
                  <p className="font-bold text-gray-900">{currencyInfo.symbol}{displayPrice}</p>
                  {rates && currency !== 'USD' && (
                    <p className="text-[10px] font-bold text-gray-400 flex items-center justify-end gap-1 mt-1">
                      <Globe className="h-3 w-3" />
                      1 USD = {rates[currency]?.toLocaleString()} {currency}
                    </p>
                  )}
                </div>
              </div>

              {/* Quick Cycle Switcher */}
              <div className="flex items-center justify-between gap-1 p-1 bg-gray-50 rounded-xl">
                {[
                  { id: 'monthly', label: 'Mon' },
                  { id: 'six-months', label: '6M' },
                  { id: 'yearly', label: '12M' }
                ].map((cycle) => (
                  <button
                    key={cycle.id}
                    onClick={() => setSelectedBillingCycle(cycle.id as any)}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                      selectedBillingCycle === cycle.id 
                        ? 'bg-white text-primary shadow-sm ring-1 ring-gray-100' 
                        : 'text-gray-400 hover:text-gray-500'
                    }`}
                  >
                    {cycle.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-2">Status</p>
              {isPendingApproval ? (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Pending Approval
                  </span>
                  <span className="text-sm text-gray-600">Awaiting admin verification</span>
                </div>
              ) : isTrial ? (
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${isExpired ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {isExpired ? 'Trial Expired' : 'Free Trial'}
                  </span>
                  {!isExpired && <span className="text-sm text-gray-600">{daysLeft} days remaining</span>}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${isExpired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} flex items-center gap-1`}>
                    {isExpired ? <AlertCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />} 
                    {isExpired ? 'Expired' : `Active (${pkg?.name || 'Subscription'})`}
                  </span>
                  {!isExpired && <span className="text-sm text-gray-600">{daysLeft} days remaining</span>}
                </div>
              )}
            </div>

            {school.subscriptionExpiry && !isTrial && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Next Billing Date</p>
                <div className="flex items-center gap-2 text-gray-900 font-medium">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {new Date(school.subscriptionExpiry).toLocaleDateString()}
                </div>
              </div>
            )}
            
            {isTrial && trialExpiry && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Registration Date</p>
                <div className="flex items-center gap-2 text-gray-900 font-medium mb-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {new Date(school.createdAt).toLocaleDateString()}
                </div>
                <p className="text-sm text-gray-500 mb-1">Trial Expiry Date</p>
                <div className="flex items-center gap-2 text-gray-900 font-medium">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {trialExpiry.toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Action */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-green-50 rounded-[2rem] flex items-center justify-center mb-6">
            <CreditCard className="h-8 w-8 text-green-600" />
          </div>
          
          <h3 className="text-2xl font-black text-gray-900 mb-2">Secure Payment</h3>
          <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto">
            Activate your {pkg?.name || 'subscription'} plan instantly via M-PESA manual verification.
          </p>

          <div className="w-full space-y-4">
            <button
              onClick={() => setShowMpesaModal(true)}
              disabled={isPendingApproval || !pkg}
              className="w-full py-5 bg-green-600 text-white rounded-3xl font-black uppercase tracking-widest text-sm shadow-xl shadow-green-200 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 flex items-center justify-center gap-3 group"
            >
              {isPendingApproval ? (
                <>
                  <Clock className="h-5 w-5 animate-pulse" />
                  Submission Pending Approval
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                  Pay via M-PESA
                </>
              )}
            </button>
            
            {isPendingApproval && (
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 py-2 rounded-xl border border-blue-100">
                Awaiting Verification by Administrator
              </p>
            )}
          </div>

          {/* Support Links */}
          <div className="mt-8 flex items-center justify-center gap-6">
            <a href="tel:+254700000000" className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-primary transition-colors">
              <Phone className="h-3 w-3" /> Call Support
            </a>
            <a href="mailto:billing@edumanagepro.com" className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-primary transition-colors">
              <Mail className="h-3 w-3" /> Email Billing
            </a>
          </div>

          {/* M-PESA Payment Modal */}
          {showMpesaModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden relative border border-white/20 animate-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-200">
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-900">M-PESA Checkout</h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Manual Verification Workflow</p>
                    </div>
                  </div>
                  <button onClick={() => setShowMpesaModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-all">
                    <X className="h-6 w-6 text-gray-400" />
                  </button>
                </div>

                <div className="p-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
                  {/* Instructions */}
                  <div className="bg-green-50/50 rounded-3xl p-8 mb-8 border border-green-100/50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <CreditCard className="w-24 h-24 rotate-12" />
                    </div>
                    <h4 className="text-xs font-black text-green-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Info className="h-4 w-4" /> Payment Instructions
                    </h4>
                    <div className="space-y-4">
                      {[
                        `Go to M-Pesa on your phone`,
                        `Select "Lipa na M-Pesa"`,
                        `Select "Pay Bill"`,
                        `Enter Business Number: ${MPESA_CONFIG.businessNumber}`,
                        `Enter Account Number: ${MPESA_CONFIG.accountNumber}`,
                        `Enter Amount: KES ${displayPrice}`,
                        `Enter your M-Pesa PIN and confirm`
                      ].map((step, i) => (
                        <div key={i} className="flex gap-4 text-sm items-center">
                          <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-xl flex items-center justify-center text-[10px] font-black shadow-lg shadow-green-100">
                            {i + 1}
                          </span>
                          <span className="text-gray-700 font-bold leading-none">{step}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-8 pt-6 border-t border-green-200/50 flex flex-col items-center">
                      <p className="text-[10px] text-green-600/70 font-black uppercase tracking-widest mb-1">Account Name</p>
                      <p className="text-sm font-black text-green-800 uppercase tracking-widest px-4 py-1 bg-green-100 rounded-lg">
                        {MPESA_CONFIG.accountName}
                      </p>
                    </div>
                  </div>

                  {/* Submission Form */}
                  <form onSubmit={handleSubmitMpesa} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Selected Plan</label>
                        <input
                          type="text"
                          readOnly
                          value={pkg?.name || ''}
                          className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-400 font-black text-xs uppercase tracking-widest"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Amount to Pay</label>
                        <div className="relative">
                          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">KES</span>
                          <input
                            type="number"
                            required
                            value={mpesaAmount}
                            onChange={(e) => setMpesaAmount(e.target.value)}
                            className="w-full pl-14 pr-5 py-4 bg-gray-50 border border-gray-200 outline-none focus:border-green-500 transition-colors rounded-2xl text-sm font-black text-gray-900"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Phone Number used</label>
                      <div className="relative">
                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="tel"
                          required
                          value={mpesaPhone}
                          onChange={(e) => setMpesaPhone(e.target.value)}
                          className="w-full pl-14 pr-5 py-4 bg-gray-50 border border-gray-200 outline-none focus:border-green-500 transition-colors rounded-2xl text-sm font-bold text-gray-900"
                          placeholder="2547XXXXXXXX"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Transaction Confirmation Code</label>
                      <div className="relative">
                        <Tag className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={mpesaCode}
                          onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                          maxLength={10}
                          className="w-full pl-14 pr-5 py-4 bg-gray-50 border border-gray-200 outline-none focus:border-green-500 transition-colors rounded-2xl text-sm font-mono font-black tracking-[0.2em] text-gray-900"
                          placeholder="QAB123XYZ9"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1 font-bold px-1">
                        <Info className="h-3 w-3" /> Alphanumeric, exactly 10 characters
                      </p>
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={loadingMpesa}
                        className="w-full py-5 bg-green-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-green-200 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                      >
                        {loadingMpesa ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Verifying Code...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-5 w-5" />
                            Complete Submission
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 mt-8">
        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Recent Payment Submissions
        </h3>
        
        {submissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {submissions.map((sub: any) => (
                  <tr key={sub.id} className="text-sm">
                    <td className="px-4 py-3 text-gray-600">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-mono font-bold text-maroon">{sub.mpesaConfirmationCode}</td>
                    <td className="px-4 py-3 font-bold">KES {sub.payableAmountKES.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                        sub.paymentStatus === 'Approved' ? 'bg-green-100 text-green-600' :
                        sub.paymentStatus === 'Rejected' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {sub.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm font-medium">No previous payment submissions found.</p>
          </div>
        )}
      </div>
    </>
    )}
  </div>
);
}
