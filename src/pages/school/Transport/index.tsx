import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Bus, Map, Users } from 'lucide-react';
import { School } from '../../../types';
import Vehicles from './Vehicles';
import RoutesPage from './Routes';

export default function TransportModule({ schoolId, school }: { schoolId: string; school: School | null }) {
  const location = useLocation();

  const tabs = [
    { name: 'Vehicles', path: '', icon: Bus },
    { name: 'Routes', path: '/routes', icon: Map },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-black text-gray-900">Transport Management</h1>
        <p className="text-gray-500">Manage school vehicles, routes, and transport assignments.</p>
      </div>

      <div className="flex overflow-x-auto no-scrollbar gap-2 p-1 bg-gray-100 rounded-xl">
        {tabs.map(tab => {
          const isActive = location.pathname.endsWith(tab.path) || (tab.path === '' && location.pathname.endsWith('/transport'));
          return (
            <Link
              key={tab.name}
              to={`/dashboard/transport${tab.path}`}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.name}
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[500px]">
        <Routes>
          <Route path="/" element={<Vehicles schoolId={schoolId} />} />
          <Route path="/routes" element={<RoutesPage schoolId={schoolId} school={school} />} />
        </Routes>
      </div>
    </div>
  );
}
