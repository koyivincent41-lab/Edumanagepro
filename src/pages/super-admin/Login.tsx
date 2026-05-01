import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, ShieldAlert, ArrowRight, Mail, Lock, Users, KeyRound } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../../lib/firebase-utils';

import { UserProfile } from '../../types';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name is required').optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function SuperAdminLogin({ profile }: { profile: UserProfile | null }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (profile && profile.role === 'super-admin' && profile.status === 'active') {
      navigate('/super-admin/dashboard');
    }
  }, [profile, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onAuth = async (data: LoginForm) => {
    setIsSubmitting(true);
    const ADMIN_EMAIL = 'koyivincent41@gmail.com';
    const SECONDARY_ADMIN_EMAIL = 'crownhillacademy@gmail.com';
    const inputEmail = data.email.toLowerCase().trim();
    const DEFAULT_ADMIN_PASSWORD = 'Admin@2026';

    try {
      if (isRegistering) {
        // 1. Authorization Check
        if (inputEmail !== ADMIN_EMAIL && inputEmail !== SECONDARY_ADMIN_EMAIL) {
          toast.error('Unauthorized email. Only authorized administrators can register.');
          setIsSubmitting(false);
          return;
        }

        // 2. Create Auth User
        try {
          const { user } = await createUserWithEmailAndPassword(auth, inputEmail, data.password);
          
          // 3. Create User Profile
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: inputEmail,
            fullName: data.fullName || 'Super Admin',
            role: 'super-admin',
            schoolId: null,
            status: 'active',
            createdAt: new Date().toISOString()
          });
        } catch (error: any) {
          if (error.code === 'auth/email-already-in-use') {
            toast.error('This email is already registered. Please sign in instead.');
            setIsRegistering(false);
            setIsSubmitting(false);
            return;
          }
          throw error;
        }
        
        toast.success('Super Admin account created successfully!');
      } else {
        // Login Logic
        try {
          const { user } = await signInWithEmailAndPassword(auth, inputEmail, data.password);
          
          // Ensure profile exists for admin
          const profileDoc = await getDoc(doc(db, 'users', user.uid));
          if (!profileDoc.exists()) {
            await setDoc(doc(db, 'users', user.uid), {
              uid: user.uid,
              email: inputEmail,
              fullName: 'Super Admin',
              role: 'super-admin',
              schoolId: null,
              status: 'active',
              createdAt: new Date().toISOString()
            });
          }
        } catch (error: any) {
          // Bootstrap Logic: If it's the primary admin and login fails, check if we should create it
          const isInvalid = error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential';
          
          if ((inputEmail === ADMIN_EMAIL || inputEmail === SECONDARY_ADMIN_EMAIL) && data.password === DEFAULT_ADMIN_PASSWORD && isInvalid) {
            // Try to create the user if they don't exist
            try {
              await createUserWithEmailAndPassword(auth, inputEmail, data.password);
            } catch (createError: any) {
              // If creation fails because they exist, it means the password was just wrong
              if (createError.code === 'auth/email-already-in-use') {
                throw error; // Throw the original login error
              }
              throw createError;
            }
          } else {
            throw error;
          }
        }
        toast.success('Super Admin logged in!');
      }

      navigate('/super-admin/dashboard');
    } catch (error: any) {
      console.error('Super Admin Auth error:', error);
      const message = error.message || 'Authentication failed';
      
      if (error.code === 'auth/operation-not-allowed') {
        const pId = auth.app.options.projectId;
        const consoleLink = `https://console.firebase.google.com/project/${pId}/authentication/providers`;
        toast.error(
          <div className="flex flex-col gap-1">
            <p className="font-black text-[10px] uppercase tracking-widest text-red-500">Auth Method Disabled</p>
            <p className="text-[10px] font-medium text-white/80">Email/Password is not enabled for project ID: <span className="font-mono text-maroon font-bold select-all">{pId}</span></p>
            <a href={consoleLink} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-400 hover:underline mt-1">Open Firebase Console &rarr;</a>
          </div>,
          { duration: 25000 }
        );
      } else if (error.code === 'auth/invalid-api-key' || error.code === 'auth/api-key-not-valid') {
        toast.error('Firebase API Key is invalid. Please check your firebase-applet-config.json.');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error('Invalid email or password.');
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Too many failed attempts. Please try again later or reset your password.');
      } else if (error.code === 'auth/network-request-failed') {
        toast.error('Network error. Please check your connection.');
      } else {
        toast.error(`Error: ${message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = prompt('Please enter your admin email to receive a password reset link:');
    if (!email) return;

    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent! Please check your inbox.');
    } catch (error: any) {
      console.error('Reset error:', error);
      toast.error(error.message || 'Failed to send reset email.');
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      const inputEmail = user.email?.toLowerCase() || '';

      const ADMIN_EMAIL = 'koyivincent41@gmail.com';
      const SECONDARY_ADMIN_EMAIL = 'crownhillacademy@gmail.com';

      if (inputEmail !== ADMIN_EMAIL && inputEmail !== SECONDARY_ADMIN_EMAIL) {
        toast.error('Unauthorized access. This account is not a super admin.');
        await auth.signOut();
        return;
      }

      toast.success('Super Admin logged in!');
      navigate('/super-admin/dashboard');
    } catch (error: any) {
      console.error('Super Admin Login error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Login cancelled.');
      } else if (error.code === 'auth/operation-not-allowed') {
        const pId = auth.app.options.projectId;
        const consoleLink = `https://console.firebase.google.com/project/${pId}/authentication/providers`;
        toast.error(
          <div className="flex flex-col gap-1">
            <p className="font-black text-[10px] uppercase tracking-widest text-red-500">Google Auth Disabled</p>
            <p className="text-[10px] font-medium text-white/80">Google Login is not enabled for project: <span className="font-mono text-maroon font-bold select-all">{pId}</span></p>
            <a href={consoleLink} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-400 hover:underline mt-1">Open Firebase Console &rarr;</a>
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
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-gray-950">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-maroon/10 blur-[150px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gray-400/10 blur-[150px] animate-pulse delay-700" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.4)_0%,transparent_100%)]" />
      </div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex p-4 bg-white/5 backdrop-blur-2xl rounded-[2rem] shadow-2xl shadow-maroon/20 mb-6 border border-white/10">
            <ShieldAlert className="h-10 w-10 text-maroon" />
          </div>
          <h1 className="text-4xl font-black text-white mb-3 tracking-tight uppercase">
            Super <span className="text-maroon">Admin</span>
          </h1>
          <p className="text-gray-500 font-medium tracking-widest uppercase text-[10px]">Restricted Area • Authorized Personnel Only</p>
        </div>

        <div className="bg-white/5 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/10 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          {/* Decorative border glow */}
          <div className="absolute inset-0 border-2 border-transparent bg-gradient-to-br from-maroon/30 via-transparent to-gray-400/30 rounded-[3rem] pointer-events-none opacity-50" />
          
          <form onSubmit={handleSubmit(onAuth)} className="space-y-6 relative">
            {isRegistering && (
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 ml-1">Full Name</label>
                <div className="relative group/input">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within/input:text-maroon transition-colors" />
                  <input
                    {...register('fullName')}
                    type="text"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border border-white/5 bg-white/5 focus:bg-white/10 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-white placeholder:text-gray-600"
                    placeholder="John Doe"
                  />
                </div>
                {errors.fullName && <p className="mt-1 text-[10px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.fullName.message}</p>}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 ml-1">Admin Email</label>
              <div className="relative group/input">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within/input:text-maroon transition-colors" />
                <input
                  {...register('email')}
                  type="email"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-white/5 bg-white/5 focus:bg-white/10 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-white placeholder:text-gray-600"
                  placeholder="admin@gmail.com"
                />
              </div>
              {errors.email && <p className="mt-1 text-[10px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500">Password</label>
                {!isRegistering && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[10px] font-black uppercase tracking-widest text-maroon/60 hover:text-maroon transition-colors"
                  >
                    Reset?
                  </button>
                )}
              </div>
              <div className="relative group/input">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within/input:text-maroon transition-colors" />
                <input
                  {...register('password')}
                  type="password"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-white/5 bg-white/5 focus:bg-white/10 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-medium text-white placeholder:text-gray-600"
                  placeholder="••••••••"
                />
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
                  {isRegistering ? 'Creating...' : 'Verifying...'}
                </>
              ) : (
                <>
                  {isRegistering ? 'Initialize Admin' : 'Enter Workspace'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                reset();
              }}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-maroon transition-colors"
            >
              {isRegistering ? 'Back to Sign In' : 'Request Admin Access'}
            </button>
          </div>

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.2em]">
              <span className="px-6 bg-transparent text-gray-600">Secure Gateway</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
            className="w-full py-4 bg-white/5 border border-white/5 text-gray-300 font-bold rounded-2xl hover:bg-white/10 hover:border-white/10 transition-all flex items-center justify-center gap-3 shadow-sm"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <div className="mt-8 pt-6 border-t border-white/5">
            <p className="text-[9px] text-center text-gray-600 font-bold uppercase tracking-[0.2em] mb-1">
              Active Project: <span className="text-maroon select-all">{auth.app.options.projectId}</span>
            </p>
            <p className="text-[7px] text-center text-gray-500/40 uppercase tracking-widest leading-relaxed">
              Ensure "Email/Password" is ENABLED for THIS project ID.
            </p>
          </div>
        </div>
        
        <div className="mt-10 text-center">
          <Link to="/" className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-600 hover:text-maroon transition-colors flex items-center justify-center gap-2">
            &larr; Exit to Public Site
          </Link>
        </div>
      </div>
    </div>
  );
}
