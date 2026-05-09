import React from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { School } from '../../../types';
import { MessageSquare, Clock, FileText } from 'lucide-react';

import SendSMS from './SendSMS';
import History from './History';
import Templates from './Templates';

const tabs = [
  { name: 'Send SMS', path: '/dashboard/sms/send', icon: MessageSquare },
  { name: 'History', path: '/dashboard/sms/history', icon: Clock },
  { name: 'Templates', path: '/dashboard/sms/templates', icon: FileText },
];

export default function SMSModule({ schoolId, school }: { schoolId: string, school: School | null }) {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SMS Management</h1>
          <p className="text-gray-500 mt-1">Send SMS messages to parents</p>
        </div>
      </div>

      <div className="bg-white p-2 rounded-2xl border border-gray-100 flex gap-2 overflow-x-auto shadow-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.name}
              to={tab.path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {tab.name}
            </NavLink>
          );
        })}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm min-h-[500px]">
        <Routes>
          <Route path="/" element={<Navigate to="send" replace />} />
          <Route path="send" element={<SendSMS schoolId={schoolId} />} />
          <Route path="history" element={<History schoolId={schoolId} />} />
          <Route path="templates" element={<Templates schoolId={schoolId} />} />
        </Routes>
      </div>
    </div>
  );
}
