import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, ShieldCheck, Zap, Users, BarChart3, Loader2, Globe, ChevronDown, Plus, Minus, Clock, Cloud, Sun, CloudRain } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Package } from '../../types';
import { getExchangeRates, SUPPORTED_CURRENCIES, ExchangeRates } from '../../services/currencyService';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrorHandler';

export default function Home() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState<any>(null);

  const currentCurrency = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency) || SUPPORTED_CURRENCIES[0];

  const services = [
    "School Management System",
    "Hospital Management System",
    "Hotel Management Systems",
    "Web App Development",
    "Phone Applications Development"
  ];

  const getWeatherIcon = (code: number) => {
    if (code <= 3) return <Sun className="h-12 w-12 text-yellow-400" />;
    if (code <= 67) return <CloudRain className="h-12 w-12 text-blue-400" />;
    return <Cloud className="h-12 w-12 text-gray-400" />;
  };

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
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const packageData = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Package))
          .filter(pkg => pkg.status === 'active');
        setPackages(packageData);
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'packages')
    );

    const fetchRates = async () => {
      const r = await getExchangeRates();
      setRates(r);
    };
    fetchRates();

    const timer = setInterval(() => setTime(new Date()), 1000);

    // Fetch weather with a fallback to avoid console errors in restricted environments
    fetch('https://api.open-meteo.com/v1/forecast?latitude=51.5085&longitude=-0.1257&current=temperature_2m,weather_code&timezone=auto')
      .then(res => {
        if (!res.ok) throw new Error('Weather API response not ok');
        return res.json();
      })
      .then(data => setWeather(data))
      .catch(err => {
        // Silent fail for weather as it's just a decorative feature
        console.log('Weather data unavailable, using default');
        setWeather({
          current: {
            temperature_2m: 20,
            weather_code: 0
          }
        });
      });

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative pt-32 pb-40 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-maroon/5 dark:bg-maroon/10 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gray-400/5 dark:bg-gray-800/10 blur-[120px] animate-pulse delay-700" />
          
          {/* Decorative floating elements */}
          <div className="absolute top-[20%] right-[10%] w-96 h-96 bg-maroon/5 rounded-full blur-3xl animate-bounce duration-[20s]" />
          <div className="absolute bottom-[20%] left-[10%] w-96 h-96 bg-gray-300/10 dark:bg-gray-700/5 rounded-full blur-3xl animate-bounce duration-[25s] delay-1000" />
        </div>

        {/* Background Image with Overlay */}
        <div className="absolute inset-0 -z-10">
          <img 
            src="https://images.unsplash.com/photo-1541339907198-e08756ebafe3?auto=format&fit=crop&q=80&w=2000" 
            alt="Modern University Building" 
            className="w-full h-full object-cover opacity-10 dark:opacity-5"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white/90 to-white dark:from-gray-950 dark:via-gray-950/90 dark:to-gray-950"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8 text-center relative">
          {/* Scrolling Text Section */}
          <div className="max-w-5xl mx-auto mb-8 overflow-hidden rounded-full bg-gradient-to-r from-gray-900 via-[#800000] to-gray-900 py-3 shadow-2xl border border-white/10 relative flex items-center">
            <div className="animate-scroll flex whitespace-nowrap">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center">
                  {services.map((service, index) => (
                    <React.Fragment key={index}>
                      <span className="mx-6 text-sm font-black uppercase tracking-widest text-white/90">
                        {service}
                      </span>
                      <span className="text-white/40 text-lg font-black">•</span>
                    </React.Fragment>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Zap className="h-4 w-4" />
            <span>The #1 School Management SaaS</span>
          </div>
          <h1 className="text-3xl md:text-4xl md:text-6xl font-black tracking-tighter text-gray-900 dark:text-white mb-6 leading-[1.1]">
            Manage Your School <br />
            <span className="text-primary">With Confidence.</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
            EduManagePro is the modern, stable, and scalable platform for schools to manage 
            operations, fee invoicing, and student records in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6">
            <Link
              to="/register"
              className="w-full sm:w-auto px-10 py-5 bg-primary text-white font-black rounded-2xl shadow-2xl shadow-primary/40 hover:scale-105 transition-all flex items-center justify-center gap-3 uppercase tracking-wider text-sm"
            >
              Start Your 7-Day Free Trial
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/pricing"
              className="w-full sm:w-auto px-10 py-5 bg-white dark:bg-gray-900 text-primary font-black rounded-2xl border-2 border-primary hover:bg-primary hover:text-white transition-all uppercase tracking-wider text-sm shadow-xl"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Widgets Section */}
      <section className="py-16 bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
            {/* Left Column: Clock, Date, Weather */}
            <div className="lg:col-span-1 space-y-8">
               {/* Clock & Date Card */}
               <div className="bg-white dark:bg-gray-900 p-4 md:p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center text-center hover:shadow-xl transition-shadow duration-300">
                  <Clock className="h-8 w-8 text-[#800000] mb-4" />
                  <div className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter mb-2">
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 font-medium uppercase tracking-widest text-sm">
                    {time.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
               </div>
               
               {/* Weather Card */}
               <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-4 md:p-8 rounded-3xl shadow-sm text-white hover:shadow-xl transition-shadow duration-300">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-300">
                    <Cloud className="h-5 w-5" /> Local Weather
                  </h3>
                  {weather ? (
                     <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                        <div>
                           <div className="text-5xl font-black tracking-tighter">{Math.round(weather.current.temperature_2m)}°C</div>
                           <div className="text-gray-400 text-sm mt-1 font-medium">Current Temperature</div>
                        </div>
                        {getWeatherIcon(weather.current.weather_code)}
                     </div>
                  ) : (
                     <div className="animate-pulse flex space-x-4">
                       <div className="flex-1 space-y-4 py-1">
                         <div className="h-10 bg-gray-700 rounded w-1/2"></div>
                         <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                       </div>
                     </div>
                  )}
               </div>
            </div>
            
            {/* Right Column: Google Calendar */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl transition-shadow duration-300">
               <iframe 
                 src="https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=UTC&showTitle=0&showPrint=0&showTabs=0&showCalendars=0&showTz=0" 
                 style={{border: 0}} 
                 width="100%" 
                 height="400" 
                 frameBorder="0" 
                 scrolling="no" 
                 className="rounded-2xl dark:invert dark:hue-rotate-180 dark:opacity-80"
                 title="Google Calendar"
               ></iframe>
            </div>
          </div>
        </div>
      </section>

      {/* Clients Section */}
      <section className="py-16 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8">
          <p className="text-center text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-8">
            Trusted by Leading Schools
          </p>
          <div className="flex flex-wrap justify-center items-center gap-4 md:gap-8 md:gap-16 transition-all duration-500">
            {['Lakewood Junior Academy', 'Pharo', 'Riviera', 'Green Hills', 'Crown Hill'].map((client, i) => (
              <div key={i} className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-gray-400 dark:text-gray-600" />
                <span className="text-xl font-black tracking-tight bg-gradient-to-r from-gray-500 to-[#800000] text-transparent bg-clip-text dark:from-gray-400 dark:to-[#a00000]">{client}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-striped-primary opacity-20"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8">
          <div className="text-center mb-16">
            <h2 className="text-xl md:text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">Everything You Need to Run Your School</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl mx-auto font-medium">Powerful features designed to simplify administration and improve efficiency.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                title: 'Multi-Tenant SaaS',
                desc: 'Secure, isolated workspaces for every school with independent data management.',
                icon: ShieldCheck,
              },
              {
                title: 'Fee Invoicing',
                desc: 'Automated fee generation, manual payment tracking, and professional receipts.',
                icon: BarChart3,
              },
              {
                title: 'Student Records',
                desc: 'Comprehensive student and parent management with full financial history.',
                icon: Users,
              }
            ].map((feature, i) => (
              <div key={i} className="group bg-white dark:bg-gray-950 p-10 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
                <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mb-8 group-hover:bg-primary group-hover:rotate-12 transition-all duration-500">
                  <feature.icon className="h-8 w-8 text-primary group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">{feature.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-medium">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-32 bg-white dark:bg-gray-950 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8">
          <div className="text-center mb-16">
            <h2 className="text-xl md:text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">Frequently Asked Questions</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl mx-auto font-medium">Learn how EduManagePro can transform your school's daily operations.</p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {[
              {
                q: "What services does EduManagePro offer?",
                a: "EduManagePro provides a comprehensive suite of tools for school administration, including student records management, fee invoicing and tracking, payroll processing, expense management, and detailed reporting."
              },
              {
                q: "How will this system help track day-to-day operations?",
                a: "Our system centralizes all your school's data. You can easily monitor daily attendance, track fee payments in real-time, manage staff payroll, and generate instant reports to keep a pulse on your school's performance and financial health."
              },
              {
                q: "Is my school's data secure?",
                a: "Yes, we use a secure multi-tenant architecture. This means your school's data is completely isolated and accessible only by your authorized staff, ensuring maximum privacy and security."
              },
              {
                q: "Can I manage multiple branches or schools?",
                a: "Absolutely. Our platform is designed to support multi-school environments, allowing administrators to manage multiple institutions from a single, unified dashboard."
              },
              {
                q: "How does the fee invoicing and tracking work?",
                a: "You can automatically generate invoices for different fee types (tuition, transport, etc.) and track payments. The system provides real-time balances, sends reminders, and generates professional receipts."
              },
              {
                q: "Does the system support staff payroll?",
                a: "Yes, our integrated payroll module allows you to manage employee salaries, allowances, and deductions. It automatically generates unique staff IDs and payroll numbers, and produces downloadable, branded payslips."
              },
              {
                q: "Can parents access the system?",
                a: "Yes, parents can have their own portal to view their children's academic progress, attendance records, fee balances, and download invoices and receipts directly."
              },
              {
                q: "Is the system customizable for our school's branding?",
                a: "Definitely! You can upload your school's logo, set your primary brand colors, and add your motto and contact details. All generated reports, invoices, and payslips will feature your official letterhead."
              },
              {
                q: "What kind of reports can I generate?",
                a: "You can generate a wide variety of reports including fee collection summaries, expense reports, payroll summaries, and student enrollment statistics. Reports can be exported to PDF, Excel, or CSV."
              },
              {
                q: "Do you offer technical support and training?",
                a: "Yes, we provide comprehensive onboarding, training for your staff, and ongoing technical support to ensure you get the most out of EduManagePro."
              }
            ].map((faq, i) => (
              <div 
                key={i} 
                className="bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-all duration-300"
              >
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                  className="w-full px-4 md:px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 text-left focus:outline-none"
                >
                  <span className="text-lg font-bold text-gray-900 dark:text-white pr-4">{faq.q}</span>
                  <div className={`p-2 rounded-full transition-colors shrink-0 ${openFaqIndex === i ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                    {openFaqIndex === i ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </div>
                </button>
                <div 
                  className={`transition-all duration-300 ease-in-out ${
                    openFaqIndex === i ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <p className="px-4 md:px-6 pb-6 text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-32 bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8">
          <div className="text-center mb-16">
            <h2 className="text-xl md:text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">What Our Satisfied Customers Say</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl mx-auto font-medium">Hear from the schools that have transformed their operations with EduManagePro.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
            {[
              {
                name: "Sarah Johnson",
                role: "Principal, Lakewood Junior Academy",
                text: "EduManagePro has completely streamlined our fee invoicing and student record management. It's been a game-changer for our administration team.",
              },
              {
                name: "David Mwangi",
                role: "Administrator, Crown Hill Academy",
                text: "The multi-tenant architecture gives us peace of mind knowing our data is secure and isolated. Plus, the parent portal is fantastic!",
              },
              {
                name: "Elena Rodriguez",
                role: "Bursar, Green Hills International",
                text: "Managing payroll and expenses has never been easier. The automated reports save us hours of work every single week.",
              }
            ].map((testimonial, i) => (
              <div key={i} className="bg-white dark:bg-gray-950 p-4 md:p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-1 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-yellow-400 text-lg">★</span>
                  ))}
                </div>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-medium mb-8 italic">"{testimonial.text}"</p>
                <div>
                  <p className="text-gray-900 dark:text-white font-black tracking-tight">{testimonial.name}</p>
                  <p className="text-primary text-xs font-bold uppercase tracking-widest">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
