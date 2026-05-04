import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Receipt, History, Settings, LogOut, GraduationCap, Menu, X, Bell } from 'lucide-react';
import { collection, onSnapshot, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import ThemeToggle from './ThemeToggle';
import { UserProfile } from '../types';

export default function ParentLayout({ children, profile }: { children: React.ReactNode, profile?: UserProfile }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!profile?.schoolId || !profile?.uid) return;

    let unsub: any;

    const fetchUnreadCount = async () => {
      try {
        const parentsQuery = query(
          collection(db, 'schools', profile.schoolId!, 'parents'), 
          where('uid', '==', profile.uid)
        );
        const parentsSnapshot = await getDocs(parentsQuery);
        
        let parentId = '';
        if (!parentsSnapshot.empty) {
          parentId = parentsSnapshot.docs[0].id;
        } else {
          const parentDoc = await getDoc(doc(db, 'schools', profile.schoolId!, 'parents', profile.uid));
          if (parentDoc.exists()) {
            parentId = parentDoc.id;
          }
        }

        if (!parentId) return null;

        const notificationsQuery = query(
          collection(db, 'schools', profile.schoolId!, 'notifications'),
          where('parentId', '==', parentId),
          where('read', '==', false)
        );

        return onSnapshot(notificationsQuery, (snapshot) => {
          setUnreadCount(snapshot.docs.length);
        });
      } catch (error) {
        console.error("Error fetching unread notifications:", error);
        return null;
      }
    };

    fetchUnreadCount().then(u => { unsub = u; });

    return () => {
      if (unsub) unsub();
    };
  }, [profile]);

  const handleLogout = async () => {
    localStorage.removeItem('parentDocId');
    localStorage.removeItem('parentId');
    localStorage.removeItem('parentSchoolId');
    localStorage.removeItem('parentName');
    navigate('/parent-portal/login');
  };

  const navLinks = [
    { name: 'Dashboard', path: '/parent-portal/dashboard', icon: LayoutDashboard },
    { name: 'Inbox', path: '/parent-portal/inbox', icon: Bell },
    { name: 'My Children', path: '/parent-portal/children', icon: Users },
    { name: 'Invoices', path: '/parent-portal/invoices', icon: FileText },
    { name: 'Receipts', path: '/parent-portal/receipts', icon: Receipt },
    { name: 'Payment History', path: '/parent-portal/payment-history', icon: History },
    { name: 'Account Settings', path: '/parent-portal/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors duration-300">
      {/* Sidebar */}
      <aside className={`print:hidden bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col shrink-0`}>
        <div className="p-6 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
          <div className="p-2 bg-primary rounded-xl shrink-0">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold tracking-tight text-gray-900 dark:text-white truncate">EduManage<span className="text-primary">Pro</span></span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Parent Portal</span>
            </div>
          )}
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary'
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5 shrink-0" />
                  {link.name === 'Inbox' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                  )}
                </div>
                {isSidebarOpen && (
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-sm font-bold">{link.name}</span>
                    {link.name === 'Inbox' && unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
        
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
      <main className="flex-1 flex flex-col h-screen overflow-hidden print:overflow-visible print:h-auto">
        <header className="print:hidden h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400">
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {profile && (
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{profile.fullName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest">Parent</p>
                </div>
                <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold shadow-sm">
                  {profile.fullName.charAt(0)}
                </div>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-950 print:p-0 print:bg-white print:overflow-visible">
          {children}
        </div>
      </main>
    </div>
  );
}
