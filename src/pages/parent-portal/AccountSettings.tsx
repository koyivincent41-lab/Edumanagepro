import React from 'react';
import ParentLayout from '../../components/ParentLayout';
import { UserProfile } from '../../types';

export default function AccountSettings({ profile }: { profile: UserProfile }) {
  return (
    <ParentLayout profile={profile}>
      <h1 className="text-xl md:text-3xl font-black text-white dark:text-white mb-8">Account Settings</h1>
      <div className="bg-white dark:bg-gray-900 p-4 md:p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Parent Name</label>
            <input type="text" value={profile.fullName} disabled className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Parent ID (Login ID)</label>
            <input type="text" value={profile.email.split('@')[0]} disabled className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <p className="text-xs text-gray-500 mt-4">For updates to your account information, please contact the school administration.</p>
        </div>
      </div>
    </ParentLayout>
  );
}
