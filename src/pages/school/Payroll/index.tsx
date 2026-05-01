import React, { useState } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { School } from '../../../types';
import { 
  LayoutDashboard, 
  Users, 
  DollarSign, 
  FileText, 
  Calendar, 
  Settings, 
  CreditCard,
  TrendingDown,
  TrendingUp,
  Briefcase
} from 'lucide-react';

// Sub-components (to be created)
import PayrollDashboard from './Dashboard';
import Employees from './Employees';
import SalaryStructures from './SalaryStructures';
import Allowances from './Allowances';
import Deductions from './Deductions';
import Periods from './Periods';
import Process from './Process';
import Payslips from './Payslips';
import Loans from './Loans';
import Reports from './Reports';
import PayrollSettings from './Settings';

interface PayrollModuleProps {
  schoolId: string;
  school: School | null;
}

export default function PayrollModule({ schoolId, school }: PayrollModuleProps) {
  const location = useLocation();

  const tabs = [
    { name: 'Dashboard', path: '/dashboard/payroll', icon: LayoutDashboard },
    { name: 'Employees', path: '/dashboard/payroll/employees', icon: Users },
    { name: 'Salary Structures', path: '/dashboard/payroll/structures', icon: Briefcase },
    { name: 'Allowances', path: '/dashboard/payroll/allowances', icon: TrendingUp },
    { name: 'Deductions', path: '/dashboard/payroll/deductions', icon: TrendingDown },
    { name: 'Periods', path: '/dashboard/payroll/periods', icon: Calendar },
    { name: 'Process Payroll', path: '/dashboard/payroll/process', icon: DollarSign },
    { name: 'Payslips', path: '/dashboard/payroll/payslips', icon: FileText },
    { name: 'Loans & Advances', path: '/dashboard/payroll/loans', icon: CreditCard },
    { name: 'Reports', path: '/dashboard/payroll/reports', icon: FileText },
    { name: 'Settings', path: '/dashboard/payroll/settings', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">Payroll Management</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Manage staff salaries, allowances, deductions, and payslips.</p>
          </div>
        </div>
      </div>

      {/* Horizontal Scrollable Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path || (tab.path === '/dashboard/payroll' && location.pathname === '/dashboard/payroll/');
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isActive 
                    ? 'bg-school-gradient text-white shadow-md' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-primary'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
        <Routes>
          <Route path="/" element={<PayrollDashboard schoolId={schoolId} school={school} />} />
          <Route path="/employees" element={<Employees schoolId={schoolId} school={school} />} />
          <Route path="/structures" element={<SalaryStructures schoolId={schoolId} school={school} />} />
          <Route path="/allowances" element={<Allowances schoolId={schoolId} school={school} />} />
          <Route path="/deductions" element={<Deductions schoolId={schoolId} school={school} />} />
          <Route path="/periods" element={<Periods schoolId={schoolId} school={school} />} />
          <Route path="/process" element={<Process schoolId={schoolId} school={school} />} />
          <Route path="/payslips" element={<Payslips schoolId={schoolId} school={school} />} />
          <Route path="/loans" element={<Loans schoolId={schoolId} school={school} />} />
          <Route path="/reports" element={<Reports schoolId={schoolId} school={school} />} />
          <Route path="/settings" element={<PayrollSettings schoolId={schoolId} school={school} />} />
          <Route path="*" element={<Navigate to="/dashboard/payroll" replace />} />
        </Routes>
      </div>
    </div>
  );
}
