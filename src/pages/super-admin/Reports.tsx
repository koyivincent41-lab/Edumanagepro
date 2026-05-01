import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  School, 
  CreditCard, 
  Calendar,
  Download,
  Printer,
  Loader2,
  Filter,
  ChevronDown
} from 'lucide-react';
import { collection, getDocs, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getExchangeRates } from '../../services/currencyService';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSchools: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    newSignupsThisMonth: 0
  });
  const [systemBranding, setSystemBranding] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [packageDistribution, setPackageDistribution] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [rates, setRates] = useState<any>(null);

  useEffect(() => {
      const fetchData = async () => {
      try {
        // Fetch system branding & settings
        const brandingSnap = await getDoc(doc(db, 'settings', 'system'));
        const brandingData = brandingSnap.data();
        if (brandingData) setSystemBranding(brandingData);

        // Fetch exchange rates
        const exchangeRates = await getExchangeRates();
        setRates(exchangeRates);

        // Fetch packages
        const packagesSnap = await getDocs(collection(db, 'packages'));
        const packages = packagesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

        // Fetch schools
        const schoolsSnap = await getDocs(collection(db, 'schools'));
        const schools = schoolsSnap.docs.map(d => d.data() as any);
        
        const activeSubs = schools.filter(s => s.subscriptionStatus === 'active').length;
        
        // Calculate total revenue from active subscriptions based on package prices in USD
        const totalRevenueUSD = schools.reduce((sum: number, s: any) => {
          if (s.subscriptionStatus === 'active' && s.packageId) {
            const pkg = packages.find((p: any) => p.id === s.packageId);
            if (pkg) {
              const billingCycle = s.billingCycle || 'monthly';
              let priceUSD = 0;
              if (billingCycle === 'yearly') {
                priceUSD = (pkg.monthlyPrice * 12) * 0.7; // 30% discount
              } else if (billingCycle === 'six-months') {
                priceUSD = pkg.monthlyPrice * 6;
              } else {
                priceUSD = pkg.monthlyPrice;
              }
              return sum + priceUSD;
            }
          }
          return sum;
        }, 0);

        let totalRev = totalRevenueUSD;
        if (exchangeRates && brandingData) {
          const targetCurrency = brandingData.currency || 'UGX';
          if (targetCurrency !== 'USD') {
            const targetRate = exchangeRates[targetCurrency] || 1;
            totalRev = totalRevenueUSD * targetRate;
          }
        }
        
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const newSignups = schools.filter(s => new Date(s.createdAt) >= firstDayOfMonth).length;

        setStats({
          totalSchools: schools.length,
          activeSubscriptions: activeSubs,
          totalRevenue: totalRev,
          newSignupsThisMonth: newSignups
        });

        // Mock revenue data for chart (scaled to system currency)
        const targetCurrency = brandingData?.currency || 'UGX';
        const scale = targetCurrency === 'USD' ? 0.00027 : 1;
        setRevenueData([
          { month: 'Jan', revenue: 4500000 * scale },
          { month: 'Feb', revenue: 5200000 * scale },
          { month: 'Mar', revenue: 4800000 * scale },
          { month: 'Apr', revenue: 6100000 * scale },
          { month: 'May', revenue: 5900000 * scale },
          { month: 'Jun', revenue: 7200000 * scale },
        ]);

        // Package distribution
        const pkgCounts: any = {};
        schools.forEach(s => {
          pkgCounts[s.packageId] = (pkgCounts[s.packageId] || 0) + 1;
        });
        setPackageDistribution(Object.entries(pkgCounts).map(([name, value]) => ({ name, value })));

        // Recent Subscription Activities based on schools list
        // Filter schools that have some active status or a package
        const recentSchools = [...schools]
          .filter(s => s.subscriptionStatus === 'active' || s.subscriptionStatus === 'trial')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);
          
        setRecentActivity(recentSchools);

        setLoading(false);
      } catch (error) {
        console.error("Error fetching reports data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const COLORS = ['#800000', '#1e40af', '#065f46', '#581c87', '#991b1b'];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-school-gradient p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {systemBranding?.companyLogo ? (
              <img src={systemBranding.companyLogo} alt="Logo" className="h-12 w-12 object-contain bg-white rounded-xl p-1" />
            ) : (
              <div className="p-3 bg-white/20 rounded-2xl text-white">
                <BarChart3 className="h-6 w-6" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black text-white">System Reports</h1>
              <p className="text-sm text-white/80 font-medium tracking-wide">Comprehensive analytics and performance metrics.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white font-bold hover:bg-white/20 transition-all flex items-center gap-2">
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button 
              onClick={() => window.print()}
              className="px-4 py-2 bg-white text-primary rounded-xl text-sm font-bold shadow-lg hover:scale-105 transition-all flex items-center gap-2"
            >
              <Printer className="h-4 w-4" /> Print Report
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Schools', value: stats.totalSchools, icon: School, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Active Subs', value: stats.activeSubscriptions, icon: CreditCard, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Revenue', value: `${systemBranding?.currency || 'UGX'} ${stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: 'text-maroon', bg: 'bg-maroon/5' },
          { label: 'New Signups', value: stats.newSignupsThisMonth, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Live</span>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{stat.label}</p>
            <h3 className="text-2xl font-black text-gray-900">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Chart */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Revenue Growth</h3>
              <p className="text-xs text-gray-500">Monthly revenue trends for the current year.</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              <Calendar className="h-3 w-3" /> 2024
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#800000" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#800000" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                  tickFormatter={(value) => {
                    if (systemBranding?.currency === 'USD') return `$${value.toFixed(0)}`;
                    return `${(value / 1000000).toFixed(1)}M`;
                  }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`${systemBranding?.currency || 'UGX'} ${value.toLocaleString()}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#800000" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Package Distribution */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Package Distribution</h3>
              <p className="text-xs text-gray-500">Breakdown of schools by subscription plan.</p>
            </div>
            <Filter className="h-5 w-5 text-gray-400" />
          </div>
          <div className="h-80 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={packageDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {packageDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {packageDistribution.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-xs font-bold text-gray-700">{entry.name}</span>
                  <span className="text-xs font-medium text-gray-400 ml-auto">{entry.value} Schools</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Recent Subscription Activity</h3>
          <button className="text-xs font-bold text-primary hover:underline">View All Activity</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">School</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentActivity.map((activity) => (
                <tr key={activity.id || activity.name} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-xs uppercase">
                        {activity.name?.charAt(0) || 'S'}
                      </div>
                      <span className="text-sm font-bold text-gray-900">{activity.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-sm text-gray-600 capitalize">Subscription - {activity.packageId || 'N/A'}</td>
                  <td className="px-8 py-4 text-sm font-black text-gray-900">{activity.currency || systemBranding?.currency || 'UGX'} {(activity.totalPaid || 0).toLocaleString()}</td>
                  <td className="px-8 py-4 text-sm text-gray-500">{new Date(activity.createdAt).toLocaleDateString()}</td>
                  <td className="px-8 py-4">
                    <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest ${
                      activity.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' :
                      activity.subscriptionStatus === 'trial' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {activity.subscriptionStatus || 'Unknown'}
                    </span>
                  </td>
                </tr>
              ))}
              {recentActivity.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-8 text-center text-gray-500 font-medium">No recent subscriptions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
