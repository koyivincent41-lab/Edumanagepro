import React, { useState, useEffect } from 'react';
import { 
  School, 
  Users, 
  CreditCard, 
  TrendingUp, 
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck
} from 'lucide-react';
import { collection, getDocs, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getExchangeRates } from '../../services/currencyService';

export default function Overview() {
  const [stats, setStats] = useState({
    totalSchools: 0,
    activeSchools: 0,
    inactiveSchools: 0,
    suspendedSchools: 0,
    trialSchools: 0,
    expiredSubscriptions: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    recentSignups: [] as any[],
    recentPlanChanges: [] as any[],
  });
  const [loading, setLoading] = useState(true);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [rates, setRates] = useState<any>(null);

  useEffect(() => {
    // Fetch system settings
    getDoc(doc(db, 'settings', 'system')).then(snap => {
      if (snap.exists()) setSystemSettings(snap.data());
    });

    // Fetch exchange rates
    getExchangeRates().then(setRates);

    const unsubscribeSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      const schools = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Calculate total revenue with conversion if needed
      // Note: We'll use the schools' totalPaid field and convert to system currency
      const calculateRevenue = () => {
        if (!rates || !systemSettings) return schools.reduce((sum, s) => sum + (s.totalPaid || 0), 0);
        
        return schools.reduce((sum, s) => {
          const amount = s.totalPaid || 0;
          const schoolCurrency = s.currency || 'UGX';
          const targetCurrency = systemSettings.currency || 'UGX';
          
          if (schoolCurrency === targetCurrency) return sum + amount;
          
          const sourceRate = rates[schoolCurrency] || 1;
          const targetRate = rates[targetCurrency] || 1;
          const convertedAmount = (amount / sourceRate) * targetRate;
          
          return sum + convertedAmount;
        }, 0);
      };

      setStats(prev => ({
        ...prev,
        totalSchools: schools.length,
        activeSchools: schools.filter(s => s.status === 'active').length,
        inactiveSchools: schools.filter(s => s.status === 'inactive').length,
        suspendedSchools: schools.filter(s => s.status === 'suspended').length,
        trialSchools: schools.filter(s => s.subscriptionStatus === 'trial').length,
        expiredSubscriptions: schools.filter(s => s.subscriptionStatus === 'expired').length,
        activeSubscriptions: schools.filter(s => s.subscriptionStatus === 'active').length,
        totalRevenue: calculateRevenue(),
        recentSignups: schools.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
      }));
      setLoading(false);
    }, (error) => {
      console.error("Schools listener error:", error);
      setLoading(false);
    });

    const unsubscribeHistory = onSnapshot(
      query(collection(db, 'subscription_history'), where('action', 'in', ['upgrade', 'downgrade', 'assign']), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const changes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).slice(0, 5);
        setStats(prev => ({ ...prev, recentPlanChanges: changes }));
      },
      (error) => {
        console.error("Subscription history listener error:", error);
      }
    );

    return () => {
      unsubscribeSchools();
      unsubscribeHistory();
    };
  }, []);

  const cards = [
    { name: 'Total Schools', value: stats.totalSchools, icon: School, color: 'bg-blue-500' },
    { name: 'Active Schools', value: stats.activeSchools, icon: CheckCircle2, color: 'bg-green-500' },
    { name: 'Trial Schools', value: stats.trialSchools, icon: Clock, color: 'bg-yellow-500' },
    { name: 'Suspended', value: stats.suspendedSchools, icon: XCircle, color: 'bg-red-500' },
    { name: 'Active Subs', value: stats.activeSubscriptions, icon: CreditCard, color: 'bg-indigo-500' },
    { name: 'Expired Subs', value: stats.expiredSubscriptions, icon: AlertCircle, color: 'bg-orange-500' },
    { name: 'Revenue (Total)', value: `${systemSettings?.currency || 'UGX'} ${stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: 'bg-emerald-500' },
    { name: 'Inactive Schools', value: stats.inactiveSchools, icon: XCircle, color: 'bg-gray-500' },
  ];

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-3xl"></div>)}
      </div>
      <div className="h-96 bg-gray-200 rounded-3xl"></div>
    </div>;
  }

  return (
    <div className="space-y-8">
      <div className="bg-school-gradient p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center overflow-hidden p-1 shrink-0">
              {systemSettings?.companyLogo ? (
                <img src={systemSettings.companyLogo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <ShieldCheck className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">System Overview</h1>
              <p className="text-sm text-white/80 font-medium tracking-wide">Monitor and manage the entire EduManagePro network.</p>
            </div>
          </div>
          <div className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-[10px] font-black text-white uppercase tracking-widest">
            Updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div key={card.name} className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 ${card.color} rounded-2xl`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{card.name}</p>
            <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="bg-school-gradient px-8 py-4 flex items-center justify-between">
            <h3 className="font-black text-white uppercase tracking-[0.2em] text-xs">Recent School Signups</h3>
            <button className="text-[10px] font-black text-white/80 hover:text-white uppercase tracking-widest transition-colors">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">School</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Owner</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Package</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {stats.recentSignups.map((school) => (
                  <tr key={school.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{school.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(school.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{school.ownerName}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-xs font-bold uppercase">
                        {school.packageId}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        school.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 
                        school.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' : 
                        'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      }`}>
                        {school.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="bg-school-gradient px-8 py-4">
            <h3 className="font-black text-white uppercase tracking-[0.2em] text-xs">Recent Plan Changes</h3>
          </div>
          <div className="p-6 space-y-4">
            {stats.recentPlanChanges.map((change) => (
              <div key={change.id} className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${
                  change.action === 'upgrade' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                  change.action === 'downgrade' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                  'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                }`}>
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {change.notes}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(change.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
            {stats.recentPlanChanges.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No recent plan changes</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="bg-school-gradient px-8 py-4">
            <h3 className="font-black text-white uppercase tracking-[0.2em] text-xs">Quick Actions</h3>
          </div>
          <div className="p-6 space-y-4">
            {[
              { name: 'Add New Package', icon: Package, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' },
              { name: 'Review Pending Schools', icon: Clock, color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/30' },
              { name: 'System Settings', icon: Settings, color: 'text-gray-500 bg-gray-50 dark:bg-gray-800' },
            ].map((action) => (
              <button key={action.name} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-left border border-transparent hover:border-gray-100 dark:hover:border-gray-800">
                <div className={`p-3 ${action.color} rounded-xl`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{action.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Package({ className }: { className?: string }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>;
}

function Settings({ className }: { className?: string }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
}
