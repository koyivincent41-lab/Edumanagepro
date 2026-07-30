import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, User, Users, ArrowLeft } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';

export default function MobileLogin() {
  const [staffId, setStaffId] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId.trim()) {
      toast.error('Please enter your Staff ID');
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, 'employees'), where('staffNumber', '==', staffId.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast.error('Invalid Staff ID');
        return;
      }

      const employeeDoc = querySnapshot.docs[0];
      const employeeData = employeeDoc.data();

      if (employeeData.status !== 'active') {
        toast.error('Your account is not active. Please contact admin.');
        return;
      }

      // Store employee info in session/local storage for MVP
      localStorage.setItem('employeeId', employeeDoc.id);
      localStorage.setItem('employeeName', employeeData.fullName);
      localStorage.setItem('schoolId', employeeData.schoolId);

      navigate('/mobile/attendance');
      toast.success('Logged in successfully');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="min-h-screen relative flex items-center justify-center py-12 px-4 sm:px-4 md:px-6 lg:px-4 md:px-8 overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/10 dark:bg-blue-500/20 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-maroon/10 dark:bg-maroon/20 blur-[120px] animate-pulse delay-700" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9)_0%,rgba(243,244,246,0.4)_50%,transparent_100%)] dark:bg-[radial-gradient(circle_at_center,rgba(17,24,39,0.8)_0%,transparent_100%)]" />
        </div>

        <div className="max-w-md w-full relative z-10">
          <div className="text-center mb-10">
            <div className="inline-flex p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-blue-500/10 mb-6 border border-white/50 dark:border-gray-800">
              <Users className="h-10 w-10 text-blue-600" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">
              Employee <span className="text-blue-600">Portal</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Sign in using your Employee Unique ID.</p>
          </div>

          <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl p-10 rounded-[3rem] border border-white/50 dark:border-gray-800 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group">
            {/* Decorative border glow */}
            <div className="absolute inset-0 border-2 border-transparent bg-gradient-to-br from-blue-500/20 via-transparent to-maroon/20 rounded-[3rem] pointer-events-none opacity-50" />
            
            <form onSubmit={handleLogin} className="space-y-6 relative">
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Staff ID / Unique ID</label>
                <div className="relative group/input">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within/input:text-blue-600 transition-colors" />
                  <input
                    type="text"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
                    placeholder="Enter your Staff ID"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-2xl shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3 overflow-hidden relative group/btn"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite]" />
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  'Sign In to Portal'
                )}
              </button>

              <Link
                to="/"
                className="w-full py-4 border border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-3 w-3" />
                Exit to Public Area
              </Link>
            </form>

            <div className="relative my-10">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100 dark:border-gray-800"></div>
              </div>
              <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.2em]">
                <span className="px-4 md:px-6 bg-white/0 backdrop-blur-md text-gray-400 dark:text-gray-500">Secure Access</span>
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-800 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                Need help?{' '}
                <Link to="/contact" className="font-black text-blue-600 hover:underline decoration-2 underline-offset-4 transition-all">Contact Admin</Link>
              </p>
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

