import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { School } from '../../types';
import { Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useBranch } from '../../context/BranchContext';

export default function Attendance({ school }: { school: School | null }) {
  const { currentBranch } = useBranch();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!school) return;
    let q = query(collection(db, 'attendance'), where('schoolId', '==', school.id));
    if (currentBranch) {
      q = query(q, where('branchId', '==', currentBranch.id));
    }
    q = query(q, orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, [school, currentBranch]);

  return (
    <div className="space-y-4 lg:space-y-6">
      <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Attendance Records</h1>
      
      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="text-gray-400 text-[10px] lg:text-xs uppercase">
                  <th className="p-3 lg:p-4">Employee</th>
                  <th className="p-3 lg:p-4">Action</th>
                  <th className="p-3 lg:p-4">Time</th>
                  <th className="p-3 lg:p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map(rec => (
                  <tr key={rec.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="p-3 lg:p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 text-sm">{rec.employeeName || 'Unknown'}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{rec.employeeId}</span>
                      </div>
                    </td>
                    <td className="p-3 lg:p-4">
                      <span className={`px-2 py-1 rounded-full text-[9px] lg:text-[10px] font-bold uppercase ${
                        rec.actionType === 'clock-in' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                      }`}>
                        {rec.actionType}
                      </span>
                    </td>
                    <td className="p-3 lg:p-4 text-xs lg:text-sm text-gray-600">{format(new Date(rec.timestamp), 'MMM d, HH:mm:ss')}</td>
                    <td className="p-3 lg:p-4">
                      <span className={`px-2 py-1 rounded-full text-[9px] lg:text-[10px] font-bold uppercase ${
                        rec.attendanceStatus === 'on-time' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {rec.attendanceStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
