import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { GraduationCap, Loader2, ArrowRight } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';

export default function Login() {
  const [staffNumber, setStaffNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffNumber.trim()) {
      toast.error('Please enter your Staff ID');
      return;
    }

    setLoading(true);
    // Mock login
    sessionStorage.setItem('teacherExamsAuth', JSON.stringify({
      id: 'mock-teacher-id',
      schoolId: 'mock-school-id',
      schoolName: 'Mock School',
      branchId: 'mock-branch-id',
      fullName: 'Teacher',
      staffNumber: staffNumber.trim(),
      academicYear: '2026'
    }));

    toast.success(`Welcome back!`);
    navigate('/teacher-exams/dashboard');
    setLoading(false);
  };

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="bg-maroon p-3 rounded-2xl shadow-xl shadow-maroon/20">
              <GraduationCap className="h-10 w-10 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-black text-gray-900 tracking-tight">
            Teacher <span className="text-maroon">Exams</span> Portal
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            Enter your Staff ID to access your dashboard
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-2xl shadow-gray-200/50 sm:rounded-3xl sm:px-10 border border-gray-100">
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label htmlFor="staffId" className="block text-sm font-bold text-gray-700 mb-2">
                  Staff ID / User ID
                </label>
                <div className="relative">
                  <input
                    id="staffId"
                    type="text"
                    required
                    value={staffNumber}
                    onChange={(e) => setStaffNumber(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-maroon/20 focus:border-maroon transition-all text-lg font-medium"
                    placeholder="Enter your Staff ID"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-lg font-bold text-white bg-maroon hover:bg-maroon/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      Sign In to Portal
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-400">Secure Access</span>
                </div>
              </div>
            </div>
          </div>
          
          <p className="mt-8 text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Teacher Exams Portal. All rights reserved.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
