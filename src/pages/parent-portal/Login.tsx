import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Eye, EyeOff, GraduationCap, LogOut, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import ThemeToggle from '../../components/ThemeToggle';
import { UserProfile } from '../../types';

export default function ParentLogin({ profile }: { profile: UserProfile | null }) {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (profile && profile.role === 'parent') {
      navigate('/parent-portal/dashboard');
    }
  }, [profile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let email = emailOrUsername;
      
      // If it doesn't look like an email, try to find it by username
      if (!email.includes('@')) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', emailOrUsername));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          toast.error('Invalid username or email');
          setLoading(false);
          return;
        }
        
        email = querySnapshot.docs[0].data().email;
      }

      await signInWithEmailAndPassword(auth, email, password);
      navigate('/parent-portal/dashboard');
    } catch (error) {
      toast.error('Invalid email/username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 dark:bg-primary/20 blur-[150px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gray-400/10 dark:bg-gray-800/20 blur-[150px] animate-pulse delay-700" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_0%,transparent_100%)] dark:bg-[radial-gradient(circle_at_center,rgba(17,24,39,0.8)_0%,transparent_100%)]" />
      </div>

      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-white/70 dark:bg-gray-900/70 backdrop-blur-3xl p-10 rounded-[3rem] shadow-[0_32px_64px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] border border-white/50 dark:border-gray-800 relative z-10">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-primary/10 border border-white/50 dark:border-gray-800">
            <GraduationCap className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h2 className="text-4xl font-black text-center text-gray-900 dark:text-white mb-3 tracking-tight">Parent Portal</h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-10 font-medium">Access your children's financial records.</p>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Email or Username</label>
            <input
              type="text"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-950 focus:border-primary outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
              placeholder="parent@school.com"
              required
            />
          </div>
          <div className="relative space-y-2">
            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-950 focus:border-primary outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-11 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-2xl shadow-gray-900/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
          </button>
        </form>
        <div className="mt-6">
          <Link
            to="/"
            className="flex items-center justify-center gap-2 w-full py-4 text-xs font-black uppercase tracking-[0.2em] text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all"
          >
            <LogOut className="h-4 w-4" />
            EXIT TO PUBLIC SITE
          </Link>
        </div>
      </div>
    </div>
  );
}
