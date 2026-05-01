import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  BookOpen, 
  FileText, 
  Receipt, 
  CreditCard, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Mail,
  TrendingUp,
  AlertCircle,
  BarChart3,
  DollarSign,
  Layers,
  Tag,
  Calendar,
  ChevronDown,
  Clock,
  Send,
  Globe,
  GitBranch
} from 'lucide-react';
import { auth, db } from '../../firebase';
import { doc, getDoc, onSnapshot, collection, updateDoc, query, where, setDoc } from 'firebase/firestore';
import { UserProfile, School, Term } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrorHandler';
import { toast } from 'sonner';
import ThemeToggle from '../../components/ThemeToggle';
import AnalogClock from '../../components/AnalogClock';
import { subscriptionService } from '../../services/subscriptionService';
import { useBranch } from '../../context/BranchContext';

// Sub-pages
import SchoolOverview from './Overview';
import Parents from './Parents';
import Students from './Students';
import Invoices from './Invoices';
import Receipts from './Receipts';
import Payments from './Payments';
import Expenses from './Expenses';
import Reports from './Reports';
import SettingsPage from './Settings';
import Classes from './Classes';
import FeeTypes from './FeeTypes';
import Streams from './Streams';
import UsersPage from './Users';
import Billing from './Billing';
import Inbox from './Inbox';
import Website from './Website';
import Employees from './Employees';
import Attendance from './Attendance';
import Subjects from './Subjects';
import Branches from './Branches';
import ExamsPortal from './ExamsPortal';

import PayrollModule from './Payroll';

export default function SchoolDashboard({ profile }: { profile: UserProfile }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showClock, setShowClock] = useState(false);
  const [school, setSchool] = useState<School | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [packageName, setPackageName] = useState<string>('');
  const navigate = useNavigate();
  const location = useLocation();
  const { currentBranch, setCurrentBranch, branches } = useBranch();

  useEffect(() => {
    if (!profile.schoolId) return;
    const unsubscribe = onSnapshot(doc(db, 'schools', profile.schoolId), (snapshot) => {
      if (snapshot.exists()) {
        const schoolData = { id: snapshot.id, ...snapshot.data() } as School;
        setSchool(schoolData);
      }
    }, (error) => {
      handleFirestoreError(error, 'read', `schools/${profile.schoolId}`);
    });

    return () => unsubscribe();
  }, [profile.schoolId]);

  useEffect(() => {
    if (!school?.packageId) {
      setPackageName('');
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'packages', school.packageId), (snapshot) => {
      if (snapshot.exists()) {
        const pkg = snapshot.data();
        setPackageName(pkg.name);
      } else {
        setPackageName(school.packageId);
      }
    });
    return () => unsubscribe();
  }, [school?.packageId]);

  useEffect(() => {
    if (!profile.schoolId) return;
    const unsubscribe = onSnapshot(
      query(collection(db, 'schools', profile.schoolId, 'inbox'), where('status', '==', 'unread')),
      (snapshot) => setUnreadCount(snapshot.size)
    );
    return () => unsubscribe();
  }, [profile.schoolId]);

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ...( ['owner', 'admin'].includes(profile.role) ? [{ name: 'Manage Branches', path: '/dashboard/branches', icon: GitBranch }] : []),
    { name: 'Inbox', path: '/dashboard/inbox', icon: Mail },
    { name: 'Parents', path: '/dashboard/parents', icon: Users },
    { name: 'Students', path: '/dashboard/students', icon: GraduationCap },
    { name: 'Employees', path: '/dashboard/employees', icon: Users },
    { name: 'Attendance', path: '/dashboard/attendance', icon: Clock },
    { name: 'Staff & Users', path: '/dashboard/users', icon: Users },
    { name: 'Payroll', path: '/dashboard/payroll', icon: DollarSign },
    { name: 'Invoices', path: '/dashboard/invoices', icon: FileText },
    { name: 'Payments', path: '/dashboard/payments', icon: CreditCard },
    { name: 'Receipts', path: '/dashboard/receipts', icon: Receipt },
    { name: 'Expenses', path: '/dashboard/expenses', icon: DollarSign },
    { name: 'Reports', path: '/dashboard/reports', icon: BarChart3 },
    { name: 'Classes', path: '/dashboard/classes', icon: Layers },
    { name: 'Subjects', path: '/dashboard/subjects', icon: BookOpen },
    { name: 'Streams', path: '/dashboard/streams', icon: BookOpen },
    { name: 'Exams Portal', path: '/dashboard/exams', icon: FileText },
    { name: 'Fee Types', path: '/dashboard/fee-types', icon: Tag },
    { name: 'Our Website', path: '/dashboard/website', icon: Globe },
    { name: 'Settings', path: '/dashboard/settings', icon: Settings },
    ...( ['owner', 'admin'].includes(profile.role) ? [{ name: 'Billing & Plan', path: '/dashboard/billing', icon: CreditCard }] : []),
  ];

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      operation,
      path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      }
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    return error;
  };

  const handleYearChange = async (year: string) => {
    if (!profile.schoolId) return;
    try {
      await setDoc(doc(db, 'schools', profile.schoolId), {
        academicYear: year
      }, { merge: true });
      toast.success(`Academic year changed to ${year}`);
    } catch (error) {
      handleFirestoreError(error, 'update', `schools/${profile.schoolId}`);
      console.error('Error updating academic year:', error);
      toast.error('Failed to update academic year');
    }
  };

  const handleTermChange = async (term: Term) => {
    if (!profile.schoolId) return;
    try {
      await setDoc(doc(db, 'schools', profile.schoolId), {
        currentTerm: term
      }, { merge: true });
      toast.success(`Current term changed to ${term}`);
    } catch (error) {
      handleFirestoreError(error, 'update', `schools/${profile.schoolId}`);
      console.error('Error updating current term:', error);
      toast.error('Failed to update current term');
    }
  };

  const currentYear = new Date().getFullYear();
  const academicYears = [];
  // Generate years from 2024 to 2060
  for (let y = 2024; y <= 2060; y++) {
    academicYears.push(y.toString());
  }

  // Automatic Academic Year Update on January 1st
  useEffect(() => {
    const checkAndAutoUpdateYear = async () => {
      if (!school || !profile.schoolId) return;
      
      const now = new Date();
      const currentYearStr = now.getFullYear().toString();
      
      // If it's January 1st and the school's academic year hasn't been updated to the current year yet
      if (now.getMonth() === 0 && now.getDate() === 1 && school.academicYear !== currentYearStr) {
        try {
          await setDoc(doc(db, 'schools', profile.schoolId), {
            academicYear: currentYearStr,
            currentTerm: 'Term 1', // Reset to Term 1 for the new year
            updatedAt: new Date().toISOString()
          }, { merge: true });
          toast.info(`Happy New Year! Academic year automatically updated to ${currentYearStr}`);
        } catch (error) {
          console.error('Failed to auto-update academic year:', error);
        }
      }
    };

    checkAndAutoUpdateYear();
  }, [school, profile.schoolId]);

  const getExpiryDate = () => {
    if (school?.subscriptionStatus === 'trial' && school?.trialExpiry) return new Date(school.trialExpiry);
    if (school?.subscriptionStatus === 'active' && school?.subscriptionExpiry) return new Date(school.subscriptionExpiry);
    return null;
  };

  const expiryDate = getExpiryDate();
  const now = new Date();
  
  // isExpired is true if we are past the due date
  const isExpired = expiryDate ? now > expiryDate : (school?.subscriptionStatus === 'expired');
  
  // isDeactivated is true if we are 2 days past the due date (grace period over)
  const deactivationDate = expiryDate ? new Date(expiryDate.getTime() + 2 * 24 * 60 * 60 * 1000) : null;
  const isDeactivated = deactivationDate ? now > deactivationDate : (school?.subscriptionStatus === 'expired');

  // Auto-deactivate if grace period is over
  useEffect(() => {
    const checkAndDeactivate = async () => {
      if (school && isDeactivated && school.subscriptionStatus !== 'expired') {
        try {
          await setDoc(doc(db, 'schools', school.id), {
            subscriptionStatus: 'expired'
          }, { merge: true });
        } catch (error) {
          console.error('Failed to auto-deactivate expired subscription:', error);
        }
      }
    };
    checkAndDeactivate();
  }, [isDeactivated, school]);

  // If deactivated and not on billing page, force redirect (only for owners/admins)
  useEffect(() => {
    if (isDeactivated) {
      if (['owner', 'admin'].includes(profile.role)) {
        if (location.pathname !== '/dashboard/billing') {
          navigate('/dashboard/billing', { replace: true });
        }
      }
    }
  }, [isDeactivated, location.pathname, navigate, profile.role]);

  return (
    <div 
      className="min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors duration-300"
      style={{ 
        '--school-primary': school?.primaryColor || '#800000',
        '--school-secondary': school?.secondaryColor || school?.primaryColor || '#800000',
        '--school-gradient': school?.isGradient 
          ? `linear-gradient(135deg, ${school.primaryColor}, ${school.secondaryColor})` 
          : school?.primaryColor || '#800000'
      } as React.CSSProperties}
    >
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 lg:relative
        bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 
        ${isSidebarOpen ? 'w-64' : 'w-20'} 
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col
      `}>
        <div className="p-6 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
          <div className="p-2 bg-school-gradient rounded-lg shrink-0 shadow-sm">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          {isSidebarOpen && <span className="font-bold tracking-tight text-primary truncate">{school?.name || 'EduManagePro'}</span>}
        </div>

        {/* Plan Badge */}
        {isSidebarOpen && school?.packageId && (
          <div className="px-6 py-3">
            <div className="bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/20 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">Active Plan</span>
                <span className="px-1.5 py-0.5 bg-school-gradient text-white text-[9px] font-black rounded uppercase">{packageName || school.packageId}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-school-gradient" 
                    style={{ width: `${Math.min(100, ((school.studentCount || 0) / 100) * 100)}%` }} 
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{school.studentCount || 0} Students</span>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isDisabled = isDeactivated && item.path !== '/dashboard/billing';
            return (
              <Link
                key={item.path}
                to={isDisabled ? '#' : item.path}
                onClick={(e) => {
                  if (isDisabled) {
                    e.preventDefault();
                    toast.error('Your subscription has expired. Please complete your payment to reactivate your dashboard.');
                  }
                }}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all relative ${
                  isActive ? 'bg-school-gradient text-white shadow-lg shadow-primary/20' : 
                  isDisabled ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed opacity-50' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary'
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {isSidebarOpen && <span className="text-sm font-bold">{item.name}</span>}
                {item.name === 'Inbox' && unreadCount > 0 && (
                  <span className={`absolute ${isSidebarOpen ? 'right-4' : 'top-2 right-2'} flex items-center justify-center min-w-[1.25rem] h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full shadow-sm shadow-red-500/40`}>
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Analog Clock in Sidebar */}
        {isSidebarOpen && (
          <div className="p-6 flex flex-col items-center gap-4 border-t border-gray-100 dark:border-gray-800">
            <button 
              onClick={() => setShowClock(!showClock)}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-primary transition-colors"
            >
              <Clock className="h-3 w-3" />
              {showClock ? 'Hide Clock' : 'Show Clock'}
            </button>
            {showClock && <AnalogClock />}
          </div>
        )}

        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 p-3 w-full rounded-xl text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {isSidebarOpen && <span className="text-sm font-bold">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-2 lg:gap-4">
            <button 
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                } else {
                  setIsSidebarOpen(!isSidebarOpen);
                }
              }} 
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400"
            >
              {window.innerWidth < 1024 ? (
                isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />
              ) : (
                isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />
              )}
            </button>
            
            {/* Branch Switcher */}
            {['owner', 'admin'].includes(profile.role) && (
              <div className={`relative group ${isDeactivated ? 'pointer-events-none opacity-50' : ''} hidden md:block`}>
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer">
                  <GitBranch className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate max-w-[150px]">
                    {currentBranch ? currentBranch.name : 'All Branches'}
                  </span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
                {!isDeactivated && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                    <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                      <p className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Branch</p>
                      <button
                        onClick={() => setCurrentBranch(null)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          currentBranch === null 
                            ? 'bg-school-gradient text-white shadow-md' 
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-primary'
                        }`}
                      >
                        All Branches (Overview)
                      </button>
                      {branches.map(branch => (
                        <button
                          key={branch.id}
                          onClick={() => setCurrentBranch(branch)}
                          className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                            currentBranch?.id === branch.id 
                              ? 'bg-school-gradient text-white shadow-md' 
                              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-primary'
                          }`}
                        >
                          {branch.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Academic Year Selector */}
            <div className={`relative group ${isDeactivated ? 'pointer-events-none opacity-50' : ''} hidden sm:block`}>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{school?.academicYear || 'Select Year'}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>
              {!isDeactivated && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                  <div className="p-2 space-y-1">
                    <p className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Academic Year</p>
                    {academicYears.map(year => (
                      <button
                        key={year}
                        onClick={() => handleYearChange(year)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          school?.academicYear === year 
                            ? 'bg-school-gradient text-white shadow-md' 
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-primary'
                        }`}
                      >
                        {year} Academic Year
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Term Selector */}
            <div className={`relative group ${isDeactivated ? 'pointer-events-none opacity-50' : ''} hidden md:block`}>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer">
                <Layers className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{school?.currentTerm || 'Select Term'}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>
              {!isDeactivated && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                  <div className="p-2 space-y-1">
                    <p className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Current Term</p>
                    {['Term 1', 'Term 2', 'Term 3'].map(term => (
                      <button
                        key={term}
                        onClick={() => handleTermChange(term as any)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          school?.currentTerm === term 
                            ? 'bg-school-gradient text-white shadow-md' 
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-primary'
                        }`}
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{profile.fullName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest">{profile.role}</p>
            </div>
            <div className="w-10 h-10 bg-school-gradient text-white rounded-full flex items-center justify-center font-bold shadow-sm">
              {profile.fullName.charAt(0)}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-gray-50 dark:bg-gray-950">
          <Routes>
            <Route path="/" element={<SchoolOverview school={school} />} />
            <Route path="/inbox" element={<Inbox school={school} defaultTab="inbox" />} />
            <Route path="/parents" element={<Parents schoolId={profile.schoolId!} />} />
            <Route path="/students" element={<Students schoolId={profile.schoolId!} school={school} />} />
            <Route path="/employees" element={<Employees school={school} />} />
            <Route path="/attendance" element={<Attendance school={school} />} />
            <Route path="/invoices" element={<Invoices schoolId={profile.schoolId!} school={school} />} />
            <Route path="/payments" element={<Payments schoolId={profile.schoolId!} school={school} />} />
            <Route path="/receipts" element={<Receipts schoolId={profile.schoolId!} school={school} />} />
            <Route path="/expenses" element={<Expenses schoolId={profile.schoolId!} school={school} />} />
            <Route path="/reports" element={<Reports schoolId={profile.schoolId!} school={school} />} />
            <Route path="/classes" element={<Classes schoolId={profile.schoolId!} />} />
            <Route path="/subjects" element={<Subjects school={school} />} />
            <Route path="/streams" element={<Streams schoolId={profile.schoolId!} />} />
            <Route path="/exams/*" element={<ExamsPortal schoolId={profile.schoolId!} school={school} />} />
            <Route path="/fee-types" element={<FeeTypes schoolId={profile.schoolId!} school={school} />} />
            <Route path="/users" element={<UsersPage schoolId={profile.schoolId!} school={school} />} />
            <Route path="/branches" element={<Branches schoolId={profile.schoolId!} school={school} />} />
            <Route path="/payroll/*" element={<PayrollModule schoolId={profile.schoolId!} school={school} />} />
            <Route path="/website" element={<Website school={school} />} />
            <Route path="/settings" element={<SettingsPage school={school} />} />
            <Route path="/billing" element={<Billing school={school} />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

