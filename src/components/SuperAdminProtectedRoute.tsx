import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { UserProfile } from '../types';

interface SuperAdminProtectedRouteProps {
  profile: UserProfile | null;
  loading: boolean;
  children: React.ReactNode;
}

export default function SuperAdminProtectedRoute({ profile, loading, children }: SuperAdminProtectedRouteProps) {
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile || profile.role !== 'super-admin') {
    // If logged in but not super-admin, redirect to their respective dashboard or home
    if (profile) {
      return <Navigate to="/dashboard" replace />;
    }
    // If not logged in at all, redirect to super admin login
    return <Navigate to="/super-admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
