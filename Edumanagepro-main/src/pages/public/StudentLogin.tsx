import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'sonner';
import { Loader2, ArrowRight, UserSquare2, ShieldCheck, HelpCircle, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StudentLogin() {
  const [uniqueId, setUniqueId] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uniqueId.trim()) {
      toast.error('Please enter your Unique ID');
      return;
    }

    setLoading(true);
    try {
      // Use collectionGroup to find the student across all schools by their unique PIN/ID
      const studentQuery = query(collectionGroup(db, 'students'), where('studentPin', '==', uniqueId.trim()));
      const studentSnap = await getDocs(studentQuery);

      if (studentSnap.empty) {
        toast.error('Invalid Unique ID.');
        setLoading(false);
        return;
      }

      const studentDoc = studentSnap.docs[0];
      const studentData = studentDoc.data();
      const studentId = studentDoc.id;

      // Find the schoolId from the path
      const pathParts = studentDoc.ref.path.split('/');
      const schoolId = pathParts[1]; // schools/{schoolId}/students/{studentId}

      // Success Setup Session
      const sessionData = {
        id: studentId,
        ...studentData,
        schoolId: schoolId,
      };
      
      sessionStorage.setItem('studentSession', JSON.stringify(sessionData));
      toast.success('Login Successful!');
      navigate('/student-portal');

    } catch (error) {
      console.error('Login error:', error);
      toast.error('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-school-gradient rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20">
            <UserSquare2 className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-black text-gray-900 tracking-tight">
          Student Portal
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 font-medium">
          Enter your Unique ID to access your portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-2xl shadow-primary/5 sm:rounded-3xl sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="uniqueId" className="block text-sm font-bold text-gray-700 uppercase tracking-widest ml-1">
                Student Unique ID
              </label>
              <div className="mt-2 relative">
                <input
                  id="uniqueId"
                  type="text"
                  required
                  maxLength={4}
                  value={uniqueId}
                  onChange={(e) => setUniqueId(e.target.value.replace(/\D/g, ''))}
                  className="appearance-none block w-full px-4 py-4 border border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-mono text-center text-3xl font-black tracking-[0.5em]"
                  placeholder="0000"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-lg shadow-primary/30 text-sm font-black uppercase tracking-[0.2em] text-white bg-school-gradient hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Access Portal <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col gap-6">
            <Link 
              to="/" 
              className="flex items-center justify-center gap-2 w-full py-3 bg-gray-50 text-gray-600 font-bold rounded-2xl hover:bg-gray-100 transition-all border border-gray-100 shadow-sm"
            >
              <Home className="h-4 w-4" />
              Exit to Website
            </Link>

            <div className="text-center">
              <span className="text-sm text-gray-500 font-medium">Not a student? </span>
              <div className="mt-2 flex justify-center gap-4 text-sm font-bold">
                <Link to="/login" className="text-gray-900 hover:text-primary transition-colors">Staff Login</Link>
                <span className="text-gray-300">|</span>
                <Link to="/parent-portal/login" className="text-gray-900 hover:text-primary transition-colors">Parent Login</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
