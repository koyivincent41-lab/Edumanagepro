import React, { useState } from 'react';
import ParentLayout from '../../components/ParentLayout';
import { auth } from '../../firebase';
import { updatePassword } from 'firebase/auth';
import { UserProfile } from '../../types';
import { toast } from 'sonner';

export default function AccountSettings({ profile }: { profile: UserProfile }) {
  const [newPassword, setNewPassword] = useState('');

  const handleUpdatePassword = async () => {
    if (!auth.currentUser) return;
    try {
      await updatePassword(auth.currentUser, newPassword);
      toast.success('Password updated successfully');
      setNewPassword('');
    } catch (error) {
      toast.error('Failed to update password');
    }
  };

  return (
    <ParentLayout profile={profile}>
      <h1 className="text-3xl font-black text-white dark:text-white mb-8">Account Settings</h1>
      <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input type="email" value={profile.email} disabled className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
          </div>
          <button onClick={handleUpdatePassword} className="w-full bg-primary p-4 rounded-xl font-bold text-white hover:bg-primary/90">Update Password</button>
        </div>
      </div>
    </ParentLayout>
  );
}
