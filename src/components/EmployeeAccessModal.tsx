import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, X, Shield, Lock, Power, BookOpen } from 'lucide-react';
import { Class } from '../types';
import { useBranch } from '../context/BranchContext';

interface EmployeeAccessModalProps {
  employee: any;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EmployeeAccessModal({ employee, onClose, onUpdated }: EmployeeAccessModalProps) {
  const { currentBranch } = useBranch();
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState(employee.status);
  const [classTeacherAssignment, setClassTeacherAssignment] = useState(employee.classTeacherAssignment || '');
  const [classes, setClasses] = useState<Class[]>([]);

  useEffect(() => {
    let classesQuery = query(collection(db, 'schools', employee.schoolId, 'classes'));
    if (currentBranch) {
      classesQuery = query(classesQuery, where('branchId', '==', currentBranch.id));
    }
    const unsubClasses = onSnapshot(
      classesQuery,
      (snap) => {
        setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      }
    );

    return () => unsubClasses();
  }, [employee.schoolId, currentBranch]);

  const handleUpdateAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updates: any = { status, classTeacherAssignment };
      
      if (newPassword) {
        if (newPassword.length < 6) {
          toast.error('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        const bcrypt = await import('bcryptjs');
        updates.passwordHash = await bcrypt.hash(newPassword, 10);
      }

      await updateDoc(doc(db, 'employees', employee.id), updates);
      toast.success('Employee access updated successfully');
      onUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating access:', error);
      toast.error('Failed to update access');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-[calc(100%-2rem)] md:w-full max-w-md p-4 md:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Manage Access</h2>
          </div>
          <button onClick={onClose}><X className="w-6 h-6 text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-500">Managing access for:</p>
          <p className="font-bold text-gray-900">{employee.fullName}</p>
          <p className="text-xs text-gray-400">Username: {employee.username}</p>
          <p className="text-xs text-gray-400">Staff ID: {employee.staffNumber}</p>
        </div>

        <form onSubmit={handleUpdateAccess} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <Power className="w-3 h-3" /> App Access Status
            </label>
            <select 
              value={status} 
              onChange={(e) => setStatus(e.target.value)}
              className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white transition-colors outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="active">Active (Full Access)</option>
              <option value="inactive">Inactive (No Access)</option>
              <option value="suspended">Suspended (Temporary Block)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <BookOpen className="w-3 h-3" /> Class Teacher Assignment
            </label>
            <select 
              value={classTeacherAssignment} 
              onChange={(e) => setClassTeacherAssignment(e.target.value)}
              className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white transition-colors outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">None</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <Lock className="w-3 h-3" /> Reset Password
            </label>
            <input 
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (leave blank to keep current)"
              className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-[10px] text-gray-400 italic">Only fill this if you want to change the employee's password.</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
