import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { User, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { UserProfile } from '../types';
import { toast } from 'sonner';

export default function ParentProtectedRoute({ 
  profile, 
  user,
  loading, 
  children 
}: { 
  profile: UserProfile | null, 
  user: User | null,
  loading: boolean, 
  children: React.ReactNode 
}) {
  const [isInvalidAccount, setIsInvalidAccount] = useState(false);

  useEffect(() => {
    if (!loading && user && !profile) {
      // User is authenticated but has no profile document.
      // This means the account is invalid or incomplete.
      setIsInvalidAccount(true);
      toast.error("Account profile not found. Please contact the school administrator.");
      signOut(auth);
    }
  }, [loading, user, profile]);

  if (loading || (!profile && auth.currentUser)) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isInvalidAccount || !profile || profile.role !== 'parent') {
    return <Navigate to="/parent-portal/login" replace />;
  }

  return <>{children}</>;
}
