import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, School, GraduationCap, LayoutDashboard, ChevronDown, User, Users, ShieldCheck, FileText, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ThemeToggle from './ThemeToggle';
import DigitalClock from './DigitalClock';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isLoginDropdownOpen, setIsLoginDropdownOpen] = React.useState(false);
  const location = useLocation();
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsLoginDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Pricing', path: '/pricing' },
    { name: 'About Us', path: '/about' },
    { name: 'Contact Us', path: '/contact' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* Top Branding Bar */}
      <div className="h-1 bg-maroon w-full"></div>
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="p-2 bg-maroon rounded-xl group-hover:scale-110 transition-transform">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <span className="text-2xl font-bold tracking-tight text-maroon dark:text-maroon-400">
                  EduManage <span className="text-gray-400 dark:text-gray-500 font-light">Pro</span>
                </span>
              </Link>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm font-bold uppercase tracking-widest transition-all hover:text-maroon dark:hover:text-maroon-400 ${
                    isActive(link.path) ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
              
              <div className="flex items-center gap-4 ml-4">
                <div className="hidden xl:block">
                  <DigitalClock />
                </div>
                <ThemeToggle />
                
                {/* Login Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setIsLoginDropdownOpen(!isLoginDropdownOpen)}
                    className="flex items-center gap-2 px-8 py-3 text-xs font-black uppercase tracking-widest text-maroon dark:text-maroon-400 border-2 border-maroon dark:border-maroon-400 rounded-xl hover:bg-maroon hover:text-white dark:hover:bg-maroon-400 dark:hover:text-gray-950 transition-all shadow-sm"
                  >
                    Login
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isLoginDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isLoginDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-64 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 p-2 overflow-hidden"
                      >
                        <Link
                          to="/login"
                          onClick={() => setIsLoginDropdownOpen(false)}
                          className="flex items-center gap-3 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                        >
                          <div className="p-2 bg-maroon/10 rounded-lg group-hover:bg-maroon group-hover:text-white transition-colors">
                            <ShieldCheck className="w-5 h-5 text-maroon group-hover:text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">School Admin</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Management Portal</p>
                          </div>
                        </Link>

                        <Link
                          to="/login"
                          state={{ tab: 'exams' }}
                          onClick={() => setIsLoginDropdownOpen(false)}
                          className="flex items-center gap-3 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group border-b border-gray-50 dark:border-gray-800"
                        >
                          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <FileText className="w-5 h-5 text-blue-600 group-hover:text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">Exams Portal</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Teacher Portal</p>
                          </div>
                        </Link>

                        <Link
                          to="/login"
                          state={{ tab: 'attendance' }}
                          onClick={() => setIsLoginDropdownOpen(false)}
                          className="flex items-center gap-3 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group border-b border-gray-50 dark:border-gray-800"
                        >
                          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <Calendar className="w-5 h-5 text-indigo-600 group-hover:text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">Learner Attendance</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Mark Attendance</p>
                          </div>
                        </Link>

                        <Link
                          to="/payslip"
                          onClick={() => setIsLoginDropdownOpen(false)}
                          className="flex items-center gap-3 p-4 rounded-xl hover:bg-maroon/5 dark:hover:bg-maroon/10 transition-colors group border-b border-gray-50 dark:border-gray-800"
                        >
                          <div className="p-2 bg-maroon/10 rounded-lg group-hover:bg-maroon group-hover:text-white transition-colors">
                            <FileText className="w-5 h-5 text-maroon group-hover:text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">Employee Pay Slip</p>
                            <p className="text-[10px] text-maroon font-bold uppercase tracking-wider">Access Payslips</p>
                          </div>
                        </Link>

                        <Link
                          to="/mobile/login"
                          onClick={() => setIsLoginDropdownOpen(false)}
                          className="flex items-center gap-3 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                        >
                          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Users className="w-5 h-5 text-blue-600 group-hover:text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">Employees</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Attendance App</p>
                          </div>
                        </Link>

                        <Link
                          to="/parent-portal/login"
                          onClick={() => setIsLoginDropdownOpen(false)}
                          className="flex items-center gap-3 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                        >
                          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg group-hover:bg-green-600 group-hover:text-white transition-colors">
                            <User className="w-5 h-5 text-green-600 group-hover:text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">Parent Portal</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Student Progress</p>
                          </div>
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Link
                  to="/register"
                  className="px-8 py-3 text-xs font-black uppercase tracking-widest text-white bg-maroon rounded-xl shadow-xl shadow-maroon/20 hover:scale-105 transition-all"
                >
                  Register School
                </Link>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center gap-4">
              <ThemeToggle />
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 animate-in slide-in-from-top duration-300">
            <div className="px-4 pt-2 pb-6 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`block px-3 py-4 text-base font-medium ${
                    isActive(link.path) ? 'text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 rounded-lg' : 'text-gray-500 dark:text-gray-400'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
              <Link
                to="/super-admin/login"
                className="block px-3 py-4 text-base font-medium text-gray-500 dark:text-gray-400 hover:text-maroon"
                onClick={() => setIsMenuOpen(false)}
              >
                Super Admin
              </Link>
              <div className="pt-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Login Portals</p>
                  <div className="grid grid-cols-1 gap-2">
                    <Link
                      to="/login"
                      state={{ tab: 'exams' }}
                      className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-bold">Exams Portal</span>
                    </Link>
                    <Link
                      to="/login"
                      state={{ tab: 'attendance' }}
                      className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Calendar className="w-5 h-5 text-indigo-600" />
                      <span className="text-sm font-bold">Learner Attendance</span>
                    </Link>
                    <Link
                      to="/login"
                      className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <ShieldCheck className="w-5 h-5 text-maroon" />
                      <span className="text-sm font-bold">School Admin</span>
                    </Link>
                    <Link
                      to="/payslip"
                      className="flex items-center gap-3 p-4 bg-maroon/5 dark:bg-maroon/10 rounded-2xl border border-maroon/20"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <FileText className="w-5 h-5 text-maroon" />
                      <span className="text-sm font-bold text-maroon">Employee Pay Slip</span>
                    </Link>
                    <Link
                      to="/mobile/login"
                      className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Users className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-bold">Employees</span>
                    </Link>
                    <Link
                      to="/parent-portal/login"
                      className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <User className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-bold">Parent Portal</span>
                    </Link>
                  </div>
                </div>
                <Link
                  to="/register"
                  className="block w-full px-4 py-4 text-center text-sm font-black uppercase tracking-widest text-white bg-maroon rounded-2xl shadow-lg shadow-maroon/20"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Register School
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-gray-900 via-[#800000] to-gray-900 border-t border-gray-800 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
              <Link to="/" className="flex items-center gap-2 mb-6">
                <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-sm">
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">EduManagePro</span>
              </Link>
              <p className="text-gray-300 max-w-sm leading-relaxed mb-6">
                The modern, stable, and scalable school management platform designed to streamline 
                your administration and fee invoicing.
              </p>
              <div className="space-y-3">
                <div className="text-sm text-gray-300">
                  <p className="font-bold text-white mb-1">Phone:</p>
                  <p>USA Office: +1(719) 351-3094</p>
                  <p>Kenya Office: +254729934770</p>
                </div>
                <p className="text-sm text-gray-300">
                  <span className="font-bold text-white">Location:</span> 2510 Piros Dr, Colorado Springs
                </p>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white mb-6 uppercase text-xs tracking-widest">Platform</h4>
              <ul className="space-y-4">
                <li><Link to="/pricing" className="text-gray-300 hover:text-white text-sm transition-colors">Pricing</Link></li>
                <li><Link to="/about" className="text-gray-300 hover:text-white text-sm transition-colors">About Us</Link></li>
                <li><Link to="/contact" className="text-gray-300 hover:text-white text-sm transition-colors">Contact</Link></li>
                <li><Link to="/super-admin/login" className="text-gray-300 hover:text-white text-sm transition-colors">Super Admin</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-6 uppercase text-xs tracking-widest">Legal</h4>
              <ul className="space-y-4">
                <li><Link to="/privacy-policy" className="text-gray-300 hover:text-white text-sm transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms-of-service" className="text-gray-300 hover:text-white text-sm transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col items-center justify-center gap-6">
            <div className="flex gap-6">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <span className="sr-only">Twitter</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.224-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
              </a>
            </div>
            <p className="text-gray-400 text-sm text-center">
              &copy; {new Date().getFullYear()} EduManagePro. All rights reserved.
              <span className="mx-2">|</span>
              <Link to="/super-admin/login" className="hover:text-white transition-colors">Super Admin</Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
