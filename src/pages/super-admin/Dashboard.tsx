import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  School, 
  Package, 
  CreditCard, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Users,
  TrendingUp,
  AlertCircle,
  Layout,
  Inbox as InboxIcon,
  Send,
  Clock,
  ShieldCheck,
  BarChart3
} from 'lucide-react';
import { auth, db } from '../../firebase';
import { collection, getDocs, query, where, onSnapshot, orderBy, doc } from 'firebase/firestore';
import { toast } from 'sonner';
import { UserProfile } from '../../types';
import ThemeToggle from '../../components/ThemeToggle';
import AnalogClock from '../../components/AnalogClock';
import DigitalClock from '../../components/DigitalClock';

// Sub-pages
import Overview from './Overview';
import Schools from './Schools';
import Packages from './Packages';
import Subscriptions from './Subscriptions';
import SettingsPage from './Settings';
import Pricing from './Pricing';
import Inbox from './Inbox';
import Outbox from './Outbox';
import Reports from './Reports';
import PaymentsInbox from './PaymentsInbox';

interface SuperAdminDashboardProps {
  profile: UserProfile;
}

interface SystemSettings {
  primaryColor?: string;
  secondaryColor?: string;
  isGradient?: boolean;
  companyLogo?: string;
  companyName?: string;
}

export default function SuperAdminDashboard({ profile }: SuperAdminDashboardProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showClock, setShowClock] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    onSnapshot(doc(db, 'settings', 'system'), (snap) => {
      if (snap.exists()) setSystemSettings(snap.data() as SystemSettings);
    });

    const unsubscribeInbox = onSnapshot(
      query(collection(db, 'system_emails'), where('type', '==', 'incoming'), where('read', '==', false)),
      (snapshot) => setUnreadCount(snapshot.size)
    );

    const unsubscribePayments = onSnapshot(
      query(collection(db, 'payment_submissions'), where('paymentStatus', '==', 'Pending Approval')),
      (snapshot) => setPendingPaymentsCount(snapshot.size)
    );

    return () => {
      unsubscribeInbox();
      unsubscribePayments();
    };
  }, []);

  const primaryColor = systemSettings?.primaryColor || '#800000';
  const secondaryColor = systemSettings?.secondaryColor || '#800000';
  const isGradient = systemSettings?.isGradient || false;

  const menuItems = [
    { name: 'Overview', path: '/super-admin/dashboard', icon: LayoutDashboard },
    { name: 'Schools', path: '/super-admin/schools', icon: School },
    { name: 'Payments Inbox', path: '/super-admin/payments', icon: InboxIcon, badge: pendingPaymentsCount },
    { name: 'Packages', path: '/super-admin/packages', icon: Package },
    { name: 'Subscriptions', path: '/super-admin/subscriptions', icon: CreditCard, badge: pendingPaymentsCount },
    { name: 'Reports', path: '/super-admin/reports', icon: BarChart3 },
    { name: 'Inbox', path: '/super-admin/inbox', icon: InboxIcon, badge: unreadCount },
    { name: 'Outbox', path: '/super-admin/outbox', icon: Send },
    { name: 'Settings', path: '/super-admin/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/super-admin/login');
    toast.success('Logged out successfully');
  };

  return (
    <div 
      className="min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors duration-300"
      style={{ 
        '--school-primary': primaryColor,
        '--school-secondary': secondaryColor,
        '--school-gradient': isGradient ? `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` : primaryColor
      } as React.CSSProperties}
    >
      {/* Sidebar */}
      <aside className={`bg-gray-900 dark:bg-black text-white transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <div className="p-2 bg-white rounded-lg shrink-0 overflow-hidden w-10 h-10 flex items-center justify-center">
            {systemSettings?.companyLogo ? (
              <img src={systemSettings.companyLogo} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <ShieldCheck className="h-6 w-6 text-primary" />
            )}
          </div>
          {isSidebarOpen && <span className="font-bold tracking-tight truncate">{systemSettings?.companyName || 'Super Admin'}</span>}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                  isActive ? 'bg-school-gradient text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 shrink-0" />
                  {isSidebarOpen && <span className="text-sm font-medium">{item.name}</span>}
                </div>
                {isSidebarOpen && item.badge !== undefined && item.badge > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Analog Clock in Sidebar */}
        {isSidebarOpen && (
          <div className="p-6 flex flex-col items-center gap-4 border-t border-white/10">
            <button 
              onClick={() => setShowClock(!showClock)}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
            >
              <Clock className="h-3 w-3" />
              {showClock ? 'Hide Clock' : 'Show Clock'}
            </button>
            {showClock && <AnalogClock />}
          </div>
        )}

        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 p-3 w-full rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-all"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {isSidebarOpen && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 shrink-0">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400">
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:block">
              <DigitalClock />
            </div>
            <ThemeToggle />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{profile.fullName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Super Admin Role</p>
            </div>
            <div className="w-10 h-10 bg-school-gradient/10 rounded-full flex items-center justify-center text-primary font-bold">
              {profile.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-950">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/dashboard" element={<Overview />} />
            <Route path="/schools" element={<Schools />} />
            <Route path="/packages" element={<Packages />} />
            <Route path="/payments" element={<PaymentsInbox />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/outbox" element={<Outbox />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
