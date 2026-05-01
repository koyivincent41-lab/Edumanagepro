import React, { useState, useEffect } from 'react';
import { School, Package } from '../../types';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, collection, addDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { CreditCard, AlertCircle, CheckCircle2, Loader2, Calendar, Globe, Phone, Mail, X } from 'lucide-react';
import { getExchangeRates, SUPPORTED_CURRENCIES, ExchangeRates } from '../../services/currencyService';
import { subscriptionService } from '../../services/subscriptionService';

export default function Billing({ school }: { school: School | null }) {
  const [pkg, setPkg] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [showMpesaModal, setShowMpesaModal] = useState(false);
  const [loadingMpesa, setLoadingMpesa] = useState(false);
  const [mpesaCode, setMpesaCode] = useState('');
  const [mpesaSchoolName, setMpesaSchoolName] = useState('');
  const [mpesaNotes, setMpesaNotes] = useState('');
  const [billingInfo, setBillingInfo] = useState({
    firstName: school?.name?.split(' ')[0] || '',
    lastName: school?.name?.split(' ').slice(1).join(' ') || 'Admin',
    email: school?.email || '',
    phone: school?.phone || '',
  });

  useEffect(() => {
    const fetchPackage = async () => {
      if (!school?.packageId) {
        setLoading(false);
        return;
      }
      try {
        const pkgDoc = await getDoc(doc(db, 'packages', school.packageId));
        if (pkgDoc.exists()) {
          setPkg({ id: pkgDoc.id, ...pkgDoc.data() } as Package);
        }
      } catch (error) {
        console.error('Error fetching package:', error);
      } finally {
        setLoading(false);
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
    fetchRates();
  }, [school?.packageId, school?.currency]);

  if (!school) return null;

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

  const billingCycle = (school as any).billingCycle || 'monthly';
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

  const handleSubmitMpesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkg || !mpesaCode || !mpesaSchoolName) {
      toast.error("Please fill in all required fields.");
      return;
    }
    
    if (mpesaCode.trim().length !== 10) {
      toast.error("M-PESA confirmation code must be exactly 10 characters.");
      return;
    }
    
    setLoadingMpesa(true);
    try {
      await addDoc(collection(db, 'payment_submissions'), {
        schoolId: school.id,
        schoolName: school.name,
        schoolEmail: school.email,
        phoneNumber: billingInfo.phone,
        submittedSchoolName: mpesaSchoolName,
        selectedPackageId: pkg.id,
        selectedPackageName: pkg.name,
        billingCycle: billingCycle,
        originalPrice: price,
        payableAmountKES: convertedPrice,
        paymentMethod: 'MPESA',
        mpesaConfirmationCode: mpesaCode,
        paymentStatus: 'Pending Approval',
        subscriptionStatus: 'Pending Approval',
        submittedAt: new Date().toISOString(),
        notes: mpesaNotes
      });
      
      await setDoc(doc(db, 'schools', school.id), {
        subscriptionStatus: 'pending_approval'
      }, { merge: true });
      
      toast.success("Your payment request has been submitted successfully and is pending verification by the administrator.");
      setShowMpesaModal(false);
      setMpesaCode('');
      setMpesaSchoolName('');
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
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Current Plan Details */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">Current Plan</h3>
          
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Selected Package</p>
              <p className="text-xl font-bold text-primary">{pkg?.name || 'Unknown Plan'}</p>
            </div>

            <div className="flex items-center justify-between py-4 border-y border-gray-100">
              <div>
                <p className="text-sm text-gray-500 mb-1">Billing Cycle</p>
                <p className="font-semibold text-gray-900 capitalize">
                  {billingCycle === 'yearly' ? '12 Months' : billingCycle === 'six-months' ? '6 Months' : 'Monthly'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 mb-1">Amount</p>
                <p className="font-bold text-gray-900">{currencyInfo.symbol}{displayPrice}</p>
                {rates && currency !== 'USD' && (
                  <p className="text-[10px] font-bold text-gray-400 flex items-center justify-end gap-1 mt-1">
                    <Globe className="h-3 w-3" />
                    1 USD = {rates[currency]?.toLocaleString()} {currency}
                  </p>
                )}
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
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
            <div className="p-2 bg-primary/10 rounded-xl">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Payment Details</h3>
          </div>

          <form onSubmit={handleSubmitMpesa} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={billingInfo.firstName}
                  onChange={(e) => setBillingInfo(prev => ({ ...prev, firstName: e.target.value }))}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-primary outline-none text-sm"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={billingInfo.lastName}
                  onChange={(e) => setBillingInfo(prev => ({ ...prev, lastName: e.target.value }))}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-primary outline-none text-sm"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={billingInfo.email}
                  onChange={(e) => setBillingInfo(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:border-primary outline-none text-sm"
                  placeholder="billing@school.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  required
                  value={billingInfo.phone}
                  onChange={(e) => setBillingInfo(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:border-primary outline-none text-sm"
                  placeholder="254700000000"
                />
              </div>
            </div>

            <div className="pt-4">
              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loadingMpesa || !pkg || isPendingApproval}
                  className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-green-200 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3"
                >
                  <CreditCard className="h-5 w-5" />
                  {isPendingApproval ? 'Pending Approval' : 'Pay with M-PESA'}
                </button>
              </div>
            </div>
          </form>

          {/* M-PESA Payment Modal */}
          {showMpesaModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden p-8 relative">
                <button onClick={() => setShowMpesaModal(false)} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full">
                  <X className="h-6 w-6 text-gray-400" />
                </button>
                <h3 className="text-xl font-bold text-gray-900 mb-6">M-PESA Payment Instructions</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 mb-6">
                  <li>Go to M-PESA on your phone</li>
                  <li>Select Lipa na M-PESA</li>
                  <li>Select PayBill</li>
                  <li>Enter the Business Number: <strong>222111</strong></li>
                  <li>Enter Account Number: <strong>2929156</strong></li>
                  <li>Enter Amount: <strong>{currencyInfo.symbol}{displayPrice}</strong></li>
                  <li>Enter your M-PESA PIN and confirm</li>
                </ol>
                <form onSubmit={handleSubmitMpesa} className="space-y-4">
                  <input
                    type="text"
                    required
                    value={mpesaSchoolName}
                    onChange={(e) => setMpesaSchoolName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-primary"
                    placeholder="Enter Full School Name"
                  />
                  <input
                    type="text"
                    required
                    value={mpesaCode}
                    onChange={(e) => setMpesaCode(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-primary"
                    placeholder="Enter M-PESA Confirmation Code"
                  />
                  <textarea
                    value={mpesaNotes}
                    onChange={(e) => setMpesaNotes(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-primary"
                    placeholder="Optional Notes"
                  />
                  <button
                    type="submit"
                    disabled={loadingMpesa}
                    className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-green-200 hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    {loadingMpesa ? 'Submitting...' : 'Submit Confirmation Code'}
                  </button>
                </form>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100 space-y-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black text-center">Support</p>
            <div className="flex items-center justify-center gap-6">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                <Phone className="h-3 w-3 text-primary" />
                <span>+254 700 000 000</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                <Mail className="h-3 w-3 text-primary" />
                <span>billing@edumanagepro.com</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
