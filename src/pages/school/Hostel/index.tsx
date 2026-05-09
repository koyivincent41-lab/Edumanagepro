import React from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { School } from '../../../types';
import { Building2, Bed, Users } from 'lucide-react';
import Hostels from './Hostels';
import Rooms from './Rooms';
import Allocation from './Allocation';

const tabs = [
  { name: 'Hostels', path: '/dashboard/hostel/hostels', icon: Building2 },
  { name: 'Rooms', path: '/dashboard/hostel/rooms', icon: Bed },
  { name: 'Allocation', path: '/dashboard/hostel/allocation', icon: Users },
];

export default function HostelModule({ schoolId, school }: { schoolId: string, school: School | null }) {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hostel Management</h1>
          <p className="text-gray-500 mt-1">Manage hostels, rooms, and allocations</p>
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
          <Route path="/" element={<Navigate to="hostels" replace />} />
          <Route path="hostels" element={<Hostels schoolId={schoolId} />} />
          <Route path="rooms" element={<Rooms schoolId={schoolId} />} />
          <Route path="allocation" element={<Allocation schoolId={schoolId} />} />
        </Routes>
      </div>
    </div>
  );
}
