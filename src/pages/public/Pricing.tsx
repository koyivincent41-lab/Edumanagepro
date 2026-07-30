import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, ShieldCheck, Zap, Users, BarChart3, Loader2, Globe } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Package } from '../../types';
import { getExchangeRates, SUPPORTED_CURRENCIES, ExchangeRates } from '../../services/currencyService';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrorHandler';

interface PricingSettings {
  title: string;
  subtitle: string;
  highlights: string[];
  buttonLabel: string;
  showTrialBadge: boolean;
}

export default function Pricing() {
  const navigate = useNavigate();
  const [isYearly, setIsYearly] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [settings, setSettings] = useState<PricingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);

  const convertPrice = (price: number) => {
    const currency = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency) || SUPPORTED_CURRENCIES[0];
    const rate = rates ? rates[selectedCurrency] : 1;
    const converted = price * (rate || 1);
    const zeroFractionCurrencies = ['KES', 'UGX', 'TZS', 'RWF', 'NGN', 'ETB', 'ZMW', 'MWK'];
    const isZeroFraction = zeroFractionCurrencies.includes(selectedCurrency);
    
    return {
      value: converted.toLocaleString(undefined, { 
        minimumFractionDigits: isZeroFraction ? 0 : 2, 
        maximumFractionDigits: isZeroFraction ? 0 : 2 
      }),
      symbol: currency.symbol
    };
  };

  useEffect(() => {
    const q = query(collection(db, 'packages'), orderBy('order', 'asc'));
    const unsubscribePackages = onSnapshot(
      q, 
      (snapshot) => {
        const packageData = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Package));
        setPackages(packageData);
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'packages')
    );

    const unsubscribeSettings = onSnapshot(
      doc(db, 'settings', 'pricing'), 
      (snapshot) => {
        if (snapshot.exists()) {
          setSettings(snapshot.data() as PricingSettings);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'settings/pricing')
    );

    const fetchRates = async () => {
      const r = await getExchangeRates();
      setRates(r);
    };
    fetchRates();

    return () => {
      unsubscribePackages();
      unsubscribeSettings();
    };
  }, []);

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PublicLayout>
    );
  }

  const title = settings?.title || 'Simple, Transparent Pricing';
  const subtitle = settings?.subtitle || 'Choose the plan that fits your school\'s size and needs.';
  const buttonLabel = settings?.buttonLabel || 'Start Free Trial';

  return (
    <PublicLayout>
      <section className="py-32 bg-white dark:bg-gray-950 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-maroon/5 dark:bg-maroon/10 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gray-400/5 dark:bg-gray-800/10 blur-[120px] animate-pulse delay-700" />
          
          {/* Decorative floating elements */}
          <div className="absolute top-[20%] right-[10%] w-96 h-96 bg-maroon/5 rounded-full blur-3xl animate-bounce duration-[20s]" />
          <div className="absolute bottom-[20%] left-[10%] w-96 h-96 bg-gray-300/10 dark:bg-gray-700/5 rounded-full blur-3xl animate-bounce duration-[25s] delay-1000" />
        </div>

        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gray-50 dark:bg-gray-900/50 -z-10 skew-x-12 translate-x-20"></div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-striped-primary opacity-10"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8 relative z-10">
          <div className="text-center mb-16">
            <h1 className="text-3xl md:text-4xl md:text-6xl font-black text-gray-900 dark:text-white mb-6 tracking-tighter leading-tight whitespace-pre-line">
              {title}
            </h1>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10 font-medium whitespace-pre-line">
              {subtitle}
            </p>

            {/* Highlights */}
            {settings?.highlights && settings.highlights.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mb-16">
                {settings.highlights.map((highlight, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">{highlight}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Toggle & Currency */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 mb-12">
              <div className="flex items-center justify-center gap-4 md:gap-6 bg-gray-100 dark:bg-gray-900 p-2 rounded-3xl inline-flex">
                <button 
                  onClick={() => setIsYearly(false)}
                  className={`px-8 py-3 rounded-2xl text-sm font-black transition-all ${!isYearly ? 'bg-primary text-white shadow-lg' : 'text-gray-500 dark:text-gray-400 hover:text-primary'}`}
                >
                  Monthly
                </button>
                 <button 
                  onClick={() => setIsYearly(true)}
                  className={`px-8 py-3 rounded-2xl text-sm font-black transition-all ${isYearly ? 'bg-primary text-white shadow-lg' : 'text-gray-500 dark:text-gray-400 hover:text-primary'}`}
                >
                  12 Months <span className="ml-1 text-[10px] opacity-70">-30%</span>
                </button>
              </div>

              <div className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2 rounded-2xl shadow-sm">
                <Globe className="h-4 w-4 text-gray-400 ml-2" />
                <select 
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="bg-transparent text-sm font-bold text-gray-700 dark:text-gray-300 outline-none pr-4 cursor-pointer"
                >
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code} className="bg-white dark:bg-gray-900">{c.code} ({c.symbol})</option>
                  ))}
                </select>
              </div>
            </div>
            {rates && selectedCurrency !== 'USD' && (
              <p className="mt-2 text-[10px] font-bold text-gray-400 flex items-center justify-center gap-1">
                <Globe className="h-3 w-3" />
                Rate: 1 USD = {rates[selectedCurrency]?.toLocaleString()} {selectedCurrency}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative p-8 rounded-[2.5rem] border-2 transition-all duration-500 hover:shadow-2xl hover:-translate-y-4 ${
                  pkg.isFeatured 
                    ? 'bg-primary text-white border-primary shadow-2xl shadow-primary/20 scale-105 z-10' 
                    : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-100 dark:border-gray-800 shadow-xl'
                }`}
              >
                {pkg.isFeatured && pkg.status === 'active' && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gray-900 dark:bg-black text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-full shadow-xl whitespace-nowrap">
                    Most Popular
                  </div>
                )}

                {pkg.status === 'inactive' && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gray-400 text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-full shadow-xl whitespace-nowrap">
                    Currently Unavailable
                  </div>
                )}
                
                {settings?.showTrialBadge && pkg.status === 'active' && (
                  <div className={`absolute top-4 right-4 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${pkg.isFeatured ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                    {pkg.trialDays} Days Free
                  </div>
                )}

                <div className={`mb-8 ${pkg.status === 'inactive' ? 'opacity-50' : ''}`}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-4">
                    <h3 className={`text-lg font-black uppercase tracking-widest ${pkg.isFeatured && pkg.status === 'active' ? 'text-white' : 'text-primary'}`}>{pkg.name}</h3>
                    {pkg.status === 'inactive' && (
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 text-[8px] font-bold rounded uppercase">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl md:text-2xl font-black tracking-tighter">
                      {convertPrice(isYearly ? (pkg.monthlyPrice * 12 * 0.7) / 12 : pkg.monthlyPrice).symbol}{convertPrice(isYearly ? (pkg.monthlyPrice * 12 * 0.7) / 12 : pkg.monthlyPrice).value}
                    </span>
                    <div className="flex flex-col">
                      <span className={`text-[8px] font-black uppercase tracking-widest ${pkg.isFeatured && pkg.status === 'active' ? 'text-primary-100' : 'text-gray-400 dark:text-gray-500'}`}>
                        / mo
                      </span>
                      {isYearly && (
                        <span className="text-[8px] font-bold opacity-60">
                          Total: {convertPrice(pkg.monthlyPrice * 12 * 0.7).symbol}{convertPrice(pkg.monthlyPrice * 12 * 0.7).value} / yr
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className={`mb-8 p-4 rounded-2xl flex flex-col gap-3 ${pkg.isFeatured ? 'bg-white/10' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${pkg.isFeatured ? 'bg-white/20' : 'bg-primary/10'}`}>
                      <Users className={`h-4 w-4 ${pkg.isFeatured ? 'text-white' : 'text-primary'}`} />
                    </div>
                    <div>
                      <p className={`text-[8px] font-black uppercase tracking-widest ${pkg.isFeatured ? 'text-primary-100' : 'text-gray-400 dark:text-gray-500'}`}>Capacity</p>
                      <p className="text-sm font-black tracking-tight">Up to {pkg.studentLimit.toLocaleString()} Students</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${pkg.isFeatured ? 'bg-white/20' : 'bg-primary/10'}`}>
                      <Zap className={`h-4 w-4 ${pkg.isFeatured ? 'text-white' : 'text-primary'}`} />
                    </div>
                    <div>
                      <p className={`text-[8px] font-black uppercase tracking-widest ${pkg.isFeatured ? 'text-primary-100' : 'text-gray-400 dark:text-gray-500'}`}>Trial</p>
                      <p className="text-sm font-black tracking-tight">{pkg.trialDays} Days Free</p>
                    </div>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {pkg.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-[10px] font-bold">
                      <div className={`p-0.5 rounded-full flex-shrink-0 ${pkg.isFeatured ? 'bg-white/20' : 'bg-primary/10'}`}>
                        <CheckCircle2 className={`h-3 w-3 ${pkg.isFeatured ? 'text-white' : 'text-primary'}`} />
                      </div>
                      <span className={pkg.isFeatured ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => pkg.status === 'active' && navigate('/register')}
                  className={`block w-full py-4 text-center font-black rounded-xl transition-all uppercase tracking-widest text-[10px] shadow-xl ${
                    pkg.status === 'inactive'
                      ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed pointer-events-none'
                      : pkg.isFeatured 
                        ? 'bg-white text-primary hover:bg-gray-100' 
                        : 'bg-primary text-white hover:bg-primary-800'
                  }`}
                >
                  {pkg.status === 'active' ? buttonLabel : 'Not Available'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
