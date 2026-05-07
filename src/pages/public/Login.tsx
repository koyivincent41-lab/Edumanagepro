import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, GraduationCap, Mail, Lock, Eye, EyeOff, FileText, Search } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';

import { UserProfile } from '../../types';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login({ profile }: { profile: UserProfile | null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Exams Portal State
  const [staffNumber, setStaffNumber] = useState('');
  const [isExamsSubmitting, setIsExamsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'admin' | 'exams' | 'attendance'>(
    (location.state as any)?.tab === 'attendance' ? 'attendance' : 
    (location.state as any)?.tab === 'exams' ? 'exams' : 'admin'
  );
  
  React.useEffect(() => {
    if (profile && profile.status === 'active') {
      if (profile.role === 'super-admin') {
        navigate('/super-admin/dashboard');
      } else if (profile.role === 'parent') {
        navigate('/parent-portal/dashboard');
      } else if (profile.role === 'employee') {
        // Sync with Teacher Exams Portal session requirements
        sessionStorage.setItem('teacherExamsAuth', JSON.stringify({
          id: profile.employeeId,
          schoolId: profile.schoolId,
          schoolName: (profile as any).schoolName,
          academicYear: (profile as any).academicYear,
          branchId: profile.branchId,
          fullName: profile.fullName,
          staffNumber: profile.staffNumber,
          classTeacherAssignment: profile.classTeacherAssignment
        }));
        
        if (activeTab === 'attendance') {
           navigate('/teacher-exams/dashboard', { state: { tab: 'learner_attendance' } });
        } else {
           navigate('/teacher-exams/dashboard');
        }
      } else {
        navigate('/dashboard');
      }
    }
  }, [profile, navigate, activeTab]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const handleExamsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffNumber.trim()) {
      toast.error('Please enter your Staff ID');
      return;
    }

    setIsExamsSubmitting(true);
    try {
      const q = query(collection(db, 'employees'), where('staffNumber', '==', staffNumber.trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error('Invalid Staff ID');
        setIsExamsSubmitting(false);
        return;
      }

      const employeeDoc = snap.docs[0];
      const employeeData = employeeDoc.data();

      if (employeeData.status !== 'active') {
        toast.error('Your account is not active');
        setIsExamsSubmitting(false);
        return;
      }

      // Store employee info in session storage for the dashboard
      sessionStorage.setItem('teacherExamsAuth', JSON.stringify({
        id: employeeDoc.id,
        schoolId: employeeData.schoolId,
        branchId: employeeData.branchId,
        fullName: employeeData.fullName,
        staffNumber: employeeData.staffNumber,
        classTeacherAssignment: employeeData.classTeacherAssignment
      }));

      toast.success('Login successful');
      if (activeTab === 'attendance') {
        navigate('/teacher-exams/dashboard', { state: { tab: 'learner_attendance' } });
      } else {
        navigate('/teacher-exams/dashboard');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('Email/Password login is not enabled in your Firebase project. Please go to the Firebase Console -> Authentication -> Sign-in method and enable "Email/Password".', {
          duration: 10000,
        });
      } else if (error.code === 'auth/invalid-api-key' || error.code === 'auth/api-key-not-valid') {
        toast.error('Firebase API Key is invalid. Please check your firebase-applet-config.json.');
      } else {
        toast.error('Email or password is incorrect');
      }
    } finally {
      setIsExamsSubmitting(false);
    }
  };

  const onLogin = async (data: LoginForm) => {
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      toast.success('Logged in successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
        const pId = auth.app.options.projectId;
        const consoleLink = `https://console.firebase.google.com/project/${pId}/authentication/providers`;
        toast.error(
          <div className="flex flex-col gap-1">
            <p className="font-black text-[10px] uppercase tracking-widest text-red-500">Auth Method Restricted</p>
            <p className="text-[10px] font-medium leading-relaxed">
              Email/Password is either disabled or restricted for project: <span className="font-mono text-maroon font-bold select-all">{pId}</span>
              <br />
              1. Enable "Email/Password" in Firebase Console.
              <br />
              2. Add <span className="font-mono font-bold">{window.location.hostname}</span> to "Authorized Domains" in Auth settings.
            </p>
            <a href={consoleLink} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-500 hover:underline mt-1">Open Firebase Settings &rarr;</a>
          </div>,
          { duration: 25000 }
        );
      } else if (error.code === 'auth/invalid-api-key' || error.code === 'auth/api-key-not-valid') {
        toast.error('Firebase API Key is invalid. Please check your firebase-applet-config.json.');
      } else {
        toast.error('Email or password is incorrect');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Logged in successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
        const pId = auth.app.options.projectId;
        const consoleLink = `https://console.firebase.google.com/project/${pId}/authentication/providers`;
        toast.error(
          <div className="flex flex-col gap-1">
            <p className="font-black text-[10px] uppercase tracking-widest text-red-500">Google Auth Restricted</p>
            <p className="text-[10px] font-medium leading-relaxed">
              Google Login is either disabled or restricted for project: <span className="font-mono text-maroon font-bold select-all">{pId}</span>
              <br />
              1. Enable "Google" in Firebase Console.
              <br />
              2. Add <span className="font-mono font-bold">{window.location.hostname}</span> to "Authorized Domains" in Auth settings.
            </p>
            <a href={consoleLink} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-500 hover:underline mt-1">Open Firebase Settings &rarr;</a>
          </div>,
          { duration: 25000 }
        );
      } else {
        toast.error('Login failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <div className="min-h-screen relative flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-maroon/10 dark:bg-maroon/20 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gray-400/10 dark:bg-gray-800/20 blur-[120px] animate-pulse delay-700" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9)_0%,rgba(243,244,246,0.4)_50%,transparent_100%)] dark:bg-[radial-gradient(circle_at_center,rgba(17,24,39,0.8)_0%,transparent_100%)]" />
          
          {/* Decorative floating elements */}
          <div className="absolute top-[20%] right-[15%] w-64 h-64 bg-maroon/5 rounded-full blur-3xl animate-bounce duration-[10s]" />
          <div className="absolute bottom-[20%] left-[15%] w-64 h-64 bg-gray-300/10 dark:bg-gray-700/5 rounded-full blur-3xl animate-bounce duration-[12s] delay-1000" />
        </div>

        <div className="max-w-md w-full relative z-10">
          <div className="text-center mb-10">
            <div className="inline-flex p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-maroon/10 mb-6 border border-white/50 dark:border-gray-800">
              <GraduationCap className="h-10 w-10 text-maroon" />
            </div>
            <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">
              Welcome <span className="text-maroon">Back</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Sign in to manage your school workspace.</p>
          </div>

          <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl p-8 lg:p-10 rounded-[3rem] border border-white/50 dark:border-gray-800 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group">
            {/* Decorative border glow */}
            <div className="absolute inset-0 border-2 border-transparent bg-gradient-to-br from-maroon/20 via-transparent to-gray-400/20 rounded-[3rem] pointer-events-none opacity-50" />
            
            {/* Tab Switcher */}
            <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-8 relative z-10 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex-1 py-3 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${
                  activeTab === 'admin' 
                    ? 'bg-white dark:bg-gray-700 text-maroon shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                Admin & Staff
              </button>
              <button
                onClick={() => setActiveTab('exams')}
                className={`flex-1 py-3 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${
                  activeTab === 'exams' 
                    ? 'bg-white dark:bg-gray-700 text-maroon shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                Exams Portal
              </button>
              <button
                onClick={() => setActiveTab('attendance')}
                className={`flex-1 py-3 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${
                  activeTab === 'attendance' 
                    ? 'bg-white dark:bg-gray-700 text-maroon shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                Learner Attendance
              </button>
            </div>

            {activeTab === 'admin' ? (
              <form onSubmit={handleSubmit(onLogin)} className="space-y-6 relative">
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Email Address</label>
                  <div className="relative group/input">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within/input:text-maroon transition-colors" />
                    <input
                      {...register('email')}
                      type="email"
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
                      placeholder="school@gmail.com"
                    />
                  </div>
                  {errors.email && <p className="mt-1 text-[10px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Password</label>
                    <Link to="/forgot-password" title="Coming soon" className="text-[10px] font-black uppercase tracking-widest text-maroon/60 hover:text-maroon transition-colors">Forgot Password?</Link>
                  </div>
                  <div className="relative group/input">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within/input:text-maroon transition-colors" />
                    <input
                      {...register('password')}
                      type={showPassword ? 'text' : 'password'}
                      className="w-full pl-12 pr-12 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-maroon transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-[10px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.password.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-5 bg-maroon text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-2xl shadow-maroon/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3 overflow-hidden relative group/btn"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite]" />
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    'Sign In to Workspace'
                  )}
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-100 dark:border-gray-800"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.2em]">
                    <span className="px-6 bg-white/0 backdrop-blur-md text-gray-400 dark:text-gray-500">Or</span>
                  </div>
                </div>

                <button
                  onClick={handleGoogleLogin}
                  disabled={isSubmitting}
                  type="button"
                  className="w-full py-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-200 transition-all flex items-center justify-center gap-3 shadow-sm"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </button>
              </form>
            ) : (
              <div className="space-y-6 relative">
                <div className="text-center mb-6">
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {activeTab === 'attendance' ? 'Enter your Staff ID to access the attendance module.' : 'Enter your Staff ID to access the exams portal.'}
                  </p>
                </div>
                <form onSubmit={handleExamsLogin} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Employee Unique ID</label>
                    <div className="relative group/input">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within/input:text-maroon transition-colors" />
                      <input
                        type="text"
                        value={staffNumber}
                        onChange={(e) => setStaffNumber(e.target.value.toUpperCase())}
                        className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 uppercase"
                        placeholder="ENTER STAFF ID"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isExamsSubmitting}
                    className="w-full py-5 bg-maroon text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-2xl shadow-maroon/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 relative overflow-hidden group/btn"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite]" />
                    {isExamsSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Entering...
                      </>
                    ) : (
                      activeTab === 'attendance' ? 'Enter Attendance Portal' : 'Enter Exams Portal'
                    )}
                  </button>
                </form>
              </div>
            )}

            <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-800 text-center space-y-4">
              <div className="flex justify-center gap-4">
                <Link to="/payslip" className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-maroon transition-colors flex items-center gap-2">
                  <FileText className="h-3 w-3" />
                  Pay Slips
                </Link>
                <span className="text-gray-200 dark:text-gray-800">|</span>
                <Link to="/register" className="text-[10px] font-black uppercase tracking-widest text-maroon hover:underline decoration-2 underline-offset-4 transition-all">Create Account</Link>
              </div>

              <div className="mt-8 pt-4 border-t border-gray-50 dark:border-gray-800/50">
                <p className="text-[9px] text-center text-gray-400 dark:text-gray-500 font-bold uppercase tracking-[0.2em] mb-1">
                  Active Project: <span className="text-maroon select-all">{auth.app.options.projectId}</span>
                </p>
                <p className="text-[7px] text-center text-gray-400/40 uppercase tracking-widest leading-relaxed">
                  Verify this ID in your Firebase Console matches yours.
                </p>
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">
            &copy; {new Date().getFullYear()} EduManagePro Systems
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
