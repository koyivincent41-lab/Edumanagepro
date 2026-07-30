import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Video, 
  FileText,
  Award,
  LogOut, 
  Menu,
  X,
  GraduationCap,
  Home
} from 'lucide-react';
import DashboardOverview from './DashboardOverview';
import LiveClasses from './LiveClasses';
import Assignments from './Assignments';
import AssignmentView from './AssignmentView';
import Results from './Results';

export default function StudentPortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const studentSession = sessionStorage.getItem('studentSession');
    if (!studentSession) {
      navigate('/student-login');
      return;
    }
    setSession(JSON.parse(studentSession));
  }, [navigate]);

  if (!session) return null;

  const handleLogout = () => {
    sessionStorage.removeItem('studentSession');
    navigate('/student-login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/student-portal/dashboard', icon: LayoutDashboard },
    { name: 'Live Classes', path: '/student-portal/live-classes', icon: Video },
    { name: 'Assignments', path: '/student-portal/assignments', icon: FileText },
    { name: 'Results', path: '/student-portal/results', icon: Award },
  ];

  const SidebarContent = () => (
    <>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">Student</h1>
            <p className="text-[10px] text-brand-200 font-bold uppercase tracking-widest">Portal</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white font-bold">
            {session.fullName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{session.fullName}</p>
            <p className="text-xs text-white/70 truncate">{session.admissionNumber}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-white text-primary font-bold shadow-md' 
                  : 'text-white/80 hover:bg-white/10 hover:text-white font-medium'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-white/70'}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 text-white/80 hover:bg-white/10 hover:text-white rounded-xl transition-colors font-medium text-sm"
        >
          <LogOut className="h-5 w-5 text-white/70" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 flex-col bg-school-gradient fixed inset-y-0 shadow-2xl z-20">
        <SidebarContent />
      </aside>

      {/* Mobile Header & Sidebar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-school-gradient text-white flex items-center justify-between px-4 z-30 shadow-md">
        <div className="flex items-center gap-2">
           <GraduationCap className="h-6 w-6" />
           <span className="font-bold text-sm uppercase tracking-widest">Student Portal</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 -mr-2">
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-20 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}>
          <aside 
            className="w-72 h-full bg-school-gradient flex flex-col shadow-2xl transition-transform transform translate-x-0"
            onClick={e => e.stopPropagation()}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 flex flex-col min-h-screen pt-16 lg:pt-0">
        <div className="flex-1 p-4 md:p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/student-portal/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardOverview session={session} />} />
            <Route path="/live-classes" element={<LiveClasses session={session} />} />
            <Route path="/assignments" element={<Assignments session={session} />} />
            <Route path="/assignments/:id" element={<AssignmentView session={session} />} />
            <Route path="/results" element={<Results session={session} />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
