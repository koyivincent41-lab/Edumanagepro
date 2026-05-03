import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import { GraduationCap, LogOut, Moon, Sun, Key } from 'lucide-react';
import { toast } from 'sonner';
import ThemeToggle from '../../components/ThemeToggle';
import { UserProfile } from '../../types';

export default function ParentLogin({ profile }: { profile: UserProfile | null }) {
  const [parentId, setParentId] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (profile && profile.role === 'parent') {
      navigate('/parent-portal/dashboard');
    }
  }, [profile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentId.trim()) {
      toast.error('Please enter your Parent ID');
      return;
    }
    
    setLoading(true);
    try {
      const q = query(collection(db, 'parents'), where('parentId', '==', parentId.trim()));
      // Since parents are under 'schools/{schoolId}/parents', we actually need a collectionGroup query or to search differently.
      // Wait, let's use collectionGroup('parents') since we don't know the schoolId.
      const parentsRef = collectionGroup(db, 'parents');
      const pq = query(parentsRef, where('parentId', '==', parentId.trim()));
      const querySnapshot = await getDocs(pq);
      
      if (querySnapshot.empty) {
        toast.error('Invalid Parent ID');
        return;
      }
      
      const parentDoc = querySnapshot.docs[0];
      const parentData = parentDoc.data();

      // Save the parent collection doc ID so it can be picked up by the portal
      localStorage.setItem('parentDocId', parentDoc.id);
      localStorage.setItem('parentId', parentData.parentId || '');
      localStorage.setItem('parentSchoolId', parentData.schoolId || '');
      localStorage.setItem('parentName', parentData.fullName || 'Parent');

      navigate('/parent-portal/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 dark:bg-primary/20 blur-[150px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gray-400/10 dark:bg-gray-800/20 blur-[150px] animate-pulse delay-700" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_0%,transparent_100%)] dark:bg-[radial-gradient(circle_at_center,rgba(17,24,39,0.8)_0%,transparent_100%)]" />
      </div>

      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-white/70 dark:bg-gray-900/70 backdrop-blur-3xl p-10 rounded-[3rem] shadow-[0_32px_64px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] border border-white/50 dark:border-gray-800 relative z-10">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-primary/10 border border-white/50 dark:border-gray-800">
            <GraduationCap className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h2 className="text-4xl font-black text-center text-gray-900 dark:text-white mb-3 tracking-tight">Parent Portal</h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-10 font-medium">Log in with your Parent ID.</p>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Parent Unique ID</label>
            <div className="relative group/input">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within/input:text-primary transition-colors" />
              <input
                type="text"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full pl-12 pr-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-950 focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
                placeholder="e.g. 4589"
                required
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-2xl shadow-gray-900/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
          </button>
        </form>
        <div className="mt-6">
          <Link
            to="/"
            className="flex items-center justify-center gap-2 w-full py-4 text-xs font-black uppercase tracking-[0.2em] text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all"
          >
            <LogOut className="h-4 w-4" />
            EXIT TO PUBLIC SITE
          </Link>
        </div>
      </div>
    </div>
  );
}
