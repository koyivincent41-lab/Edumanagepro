import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { UserProfile } from '../types';

export default function ParentProtectedRoute({ 
  children 
}: { 
  profile?: UserProfile | null, 
  user?: any,
  loading?: boolean, 
  children: React.ReactNode 
}) {
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const parentDocId = localStorage.getItem('parentDocId');
    const parentId = localStorage.getItem('parentId');
    const schoolId = localStorage.getItem('parentSchoolId');
    const parentName = localStorage.getItem('parentName') || 'Parent';

    if (parentDocId && parentId && schoolId) {
      setLocalProfile({
        uid: parentDocId,
        email: `${parentId}@school.internal`,
        fullName: parentName,
        role: 'parent',
        status: 'active',
        schoolId: schoolId,
        createdAt: new Date().toISOString()
      });
    }
    
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!localProfile) {
    return <Navigate to="/parent-portal/login" replace />;
  }

  // Pass the synthesized profile to the child components
  return <>{React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { profile: localProfile } as any);
    }
    return child;
  })}</>;
}

