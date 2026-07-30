import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { UserProfile } from '../types';
import { auth } from '../firebase';

interface SchoolProtectedRouteProps {
  profile: UserProfile | null;
  loading: boolean;
  children: React.ReactNode;
}

export default function SchoolProtectedRoute({ profile, loading, children }: SchoolProtectedRouteProps) {
  const location = useLocation();

  if (loading || (!profile && auth.currentUser)) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile || profile.role === 'super-admin' || profile.status === 'incomplete') {
    // If super-admin, redirect to super-admin dashboard
    if (profile?.role === 'super-admin') {
      return <Navigate to="/super-admin/dashboard" replace />;
    }
    // If profile is incomplete, sign out and redirect to register with error
    if (profile?.status === 'incomplete' && auth.currentUser) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-4 md:p-8 rounded-[2rem] shadow-xl max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-2">Account Incomplete</h2>
            <p className="text-gray-500 mb-8">Your account setup was not finished correctly. This may happen if you manually created a user or if registration failed.</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => auth.signOut().then(() => window.location.href = '/register')}
                className="w-full py-4 bg-maroon text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-maroon/20"
              >
                Go to Registration
              </button>
              <button 
                onClick={() => auth.signOut().then(() => window.location.href = '/login')}
                className="w-full py-4 bg-gray-100 text-gray-600 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-gray-200 transition-all"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      );
    }
    // If not logged in at all, redirect to school login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
