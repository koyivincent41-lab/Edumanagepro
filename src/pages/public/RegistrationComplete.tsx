import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight, Loader2, XCircle } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, collection, runTransaction, getDocs, query, where, limit } from 'firebase/firestore';
import { auth as firebaseAuth, db } from '../../firebase';
import { toast } from 'sonner';

const RegistrationComplete = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [email, setEmail] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const processedRef = useRef(false);

  useEffect(() => {
    const processCallback = async () => {
      if (processedRef.current) return;
      processedRef.current = true;

      const searchParams = new URLSearchParams(location.search);
      const reference = searchParams.get('reference');
      const trxref = searchParams.get('trxref');
      
      const pendingDataStr = localStorage.getItem('pendingRegistration');
      
      if (!pendingDataStr) {
        // If no pending data, maybe they just refreshed the page after success
        if (location.state?.email) {
          setEmail(location.state.email);
          setStatus('success');
        } else {
          setStatus('error');
          setErrorMessage('No pending registration found. Please try registering again.');
        }
        return;
      }

      const data = JSON.parse(pendingDataStr);
      setEmail(data.email);

      if (!reference && !trxref && data.paymentMethod === 'card') {
        setStatus('error');
        setErrorMessage('Payment reference missing. Please contact support.');
        return;
      }

      try {
        // 1. Check if school email already exists in Firestore
        const schoolQuery = query(
          collection(db, 'schools'), 
          where('email', '==', data.email),
          limit(1)
        );
        const schoolSnap = await getDocs(schoolQuery);
        
        if (!schoolSnap.empty) {
          setStatus('error');
          setErrorMessage('A school with this email already exists. Please login instead.');
          localStorage.removeItem('pendingRegistration');
          return;
        }

        // 2. Create Auth User
        let user;
        try {
          const userCredential = await createUserWithEmailAndPassword(firebaseAuth, data.email, data.password);
          user = userCredential.user;
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            // If user exists in Auth but school wasn't created (e.g., previous transaction failed),
            // try to sign them in to continue the process
            const { signInWithEmailAndPassword } = await import('firebase/auth');
            try {
              const userCredential = await signInWithEmailAndPassword(firebaseAuth, data.email, data.password);
              user = userCredential.user;
            } catch (signInError) {
              throw authError; // Throw original error if sign in fails (e.g., wrong password)
            }
          } else {
            throw authError;
          }
        }

        // 3. Create School and User Profile in Firestore
        const schoolId = doc(collection(db, 'schools')).id;
        
        await runTransaction(db, async (transaction) => {
          const schoolRef = doc(db, 'schools', schoolId);
          const userRef = doc(db, 'users', user.uid);
          
          const schoolData = {
            id: schoolId,
            name: data.schoolName,
            ownerName: data.schoolName + ' Admin',
            email: data.email,
            phone: data.phone,
            address: data.address,
            currency: data.currency,
            academicYear: data.academicYear,
            packageId: data.packageId,
            billingCycle: data.billingCycle,
            paymentMethod: data.paymentMethod,
            paymentReference: reference || trxref || 'paypal_pending',
            status: 'active',
            createdAt: new Date().toISOString(),
            trialExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          };

          const userData = {
            uid: user.uid,
            schoolId: schoolId,
            fullName: data.schoolName + ' Admin',
            email: data.email,
            role: 'owner',
            status: 'active',
            createdAt: new Date().toISOString(),
          };

          transaction.set(schoolRef, schoolData);
          transaction.set(userRef, userData);
        });

        // 4. Success
        localStorage.removeItem('pendingRegistration');
        await signOut(firebaseAuth); // Sign out so they can log in manually
        setStatus('success');
        toast.success('Registration and payment successful!');
      } catch (error: any) {
        console.error('Registration error:', error);
        
        if (error.code === 'auth/email-already-in-use') {
          // Check if the school was actually created (e.g., in a strict-mode double execution)
          const schoolQuery = query(
            collection(db, 'schools'), 
            where('email', '==', data.email),
            limit(1)
          );
          const schoolSnap = await getDocs(schoolQuery);
          
          if (!schoolSnap.empty) {
            // It was already created successfully in a previous execution
            localStorage.removeItem('pendingRegistration');
            setStatus('success');
            return;
          }
          
          setStatus('error');
          setErrorMessage('This email is already registered.');
        } else if (error.code === 'auth/operation-not-allowed') {
          setStatus('error');
          setErrorMessage('Email/Password registration is not enabled in Firebase.');
        } else {
          setStatus('error');
          setErrorMessage('Registration failed. Please try again or contact support.');
        }
      }
    };

    processCallback();
  }, [location]);

  return (
    <PublicLayout>
      <div className="min-h-screen relative flex items-center justify-center py-16 px-4 overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-maroon/10 dark:bg-maroon/20 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gray-400/10 dark:bg-gray-800/20 blur-[120px] animate-pulse delay-700" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9)_0%,rgba(243,244,246,0.4)_50%,transparent_100%)] dark:bg-[radial-gradient(circle_at_center,rgba(17,24,39,0.8)_0%,transparent_100%)]" />
        </div>

        <div className="max-w-md w-full relative z-10">
          <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl p-10 rounded-[3.5rem] border border-white/50 dark:border-gray-800 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] text-center relative overflow-hidden group">
            {/* Decorative border glow */}
            <div className="absolute inset-0 border-2 border-transparent bg-gradient-to-br from-maroon/10 via-transparent to-gray-400/10 rounded-[3.5rem] pointer-events-none opacity-50" />
            
            <div className="relative z-10">
              {status === 'processing' && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="relative mb-8">
                    <div className="absolute inset-0 bg-maroon/20 blur-2xl rounded-full animate-pulse" />
                    <Loader2 className="h-20 w-20 text-maroon animate-spin relative z-10" />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-4">Initializing Workspace</h2>
                  <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed">Please wait while we set up your school account and prepare your dashboard.</p>
                </div>
              )}

              {status === 'success' && (
                <>
                  <div className="flex justify-center mb-8">
                    <div className="h-24 w-24 bg-green-100 dark:bg-green-900/30 rounded-[2rem] flex items-center justify-center shadow-xl shadow-green-100/50 dark:shadow-green-900/20 rotate-3 animate-bounce">
                      <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                      Registration <span className="text-maroon">Complete!</span>
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                      Your 7-day free trial has started. We've successfully captured your payment details.
                    </p>
                    <div className="bg-gray-50/50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                      <p className="text-xs text-gray-500 dark:text-gray-500 font-medium uppercase tracking-widest mb-1">Confirmation sent to</p>
                      <p className="font-black text-gray-900 dark:text-white uppercase tracking-wider">{email}</p>
                    </div>
                  </div>

                  <div className="mt-10">
                    <Link
                      to="/login"
                      className="w-full py-5 bg-maroon text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-2xl shadow-maroon/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group/btn overflow-hidden relative"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite]" />
                      Go to Login
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </>
              )}

              {status === 'error' && (
                <>
                  <div className="flex justify-center mb-8">
                    <div className="h-24 w-24 bg-red-100 dark:bg-red-900/30 rounded-[2rem] flex items-center justify-center shadow-xl shadow-red-100/50 dark:shadow-red-900/20 -rotate-3">
                      <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                      Registration <span className="text-red-600">Failed</span>
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                      {errorMessage}
                    </p>
                  </div>

                  <div className="mt-10 flex flex-col gap-4">
                    <Link
                      to="/register"
                      className="w-full py-5 bg-maroon text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-2xl shadow-maroon/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center"
                    >
                      Try Again
                    </Link>
                    <Link
                      to="/contact"
                      className="w-full py-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-black uppercase tracking-[0.2em] text-xs rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center"
                    >
                      Contact Support
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>

          <p className="mt-12 text-center text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">
            &copy; {new Date().getFullYear()} EduManagePro Systems
          </p>
        </div>
      </div>
    </PublicLayout>
  );
};

export default RegistrationComplete;
