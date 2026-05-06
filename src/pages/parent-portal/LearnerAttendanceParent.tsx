import React, { useState, useEffect } from 'react';
import ParentLayout from '../../components/ParentLayout';
import { UserProfile } from '../../types';
import { db } from '../../firebase';
import { collection, query, getDocs, where, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Loader2, Calendar, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function LearnerAttendanceParent({ profile }: { profile: UserProfile }) {
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  
  // Stats
  const [weeklyPercent, setWeeklyPercent] = useState(0);
  const [monthlyPercent, setMonthlyPercent] = useState(0);
  const [termPercent, setTermPercent] = useState(0);

  useEffect(() => {
    if (!profile.schoolId) return;
    const fetchChildren = async () => {
      try {
        let parentId = '';
        const parentsQuery = query(
          collection(db, 'schools', profile.schoolId!, 'parents'), 
          where('uid', '==', profile.uid)
        );
        const parentsSnapshot = await getDocs(parentsQuery);
        
        if (!parentsSnapshot.empty) {
          parentId = parentsSnapshot.docs[0].id;
        } else {
          const parentDoc = await getDoc(doc(db, 'schools', profile.schoolId!, 'parents', profile.uid));
          if (parentDoc.exists()) {
            parentId = parentDoc.id;
          }
        }

        if (!parentId) {
            setLoading(false);
            return;
        }

        const childrenQuery = query(
          collection(db, 'schools', profile.schoolId!, 'students'), 
          where('parentId', '==', parentId)
        );
        const childrenSnap = await getDocs(childrenQuery);
        const childrenData = childrenSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setChildren(childrenData);
        if (childrenData.length > 0) {
            setSelectedChild(childrenData[0].id);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchChildren();
  }, [profile]);

  useEffect(() => {
     if (!selectedChild || !profile.schoolId) return;

      const parseDateSafe = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d, 12, 0, 0, 0);
      };

      const fetchAttendance = () => {
          setLoading(true);
          const q = query(
              collection(db, 'schools', profile.schoolId!, 'learner_attendance'),
              where('studentId', '==', selectedChild)
          );
          const unsubscribe = onSnapshot(q, async (snap) => {
              const records = snap.docs.map(d => d.data());
              setAttendanceRecords(records);

              // Calculate stats
              const now = new Date();
              
              // Week (last 7 days logic)
              const weekAgo = new Date(now);
              weekAgo.setDate(now.getDate() - 7);
              
              // Month (last 30 days logic)
              const monthAgo = new Date(now);
              monthAgo.setMonth(now.getMonth() - 1);

              try {
                  const schoolDoc = await getDoc(doc(db, 'schools', profile.schoolId!));
                  const currentTerm = schoolDoc.data()?.currentTerm || 'Term 1';

                  let wPresent = 0, wTotal = 0;
                  let mPresent = 0, mTotal = 0;
                  let tPresent = 0, tTotal = 0;

                  records.forEach(r => {
                      const dDate = parseDateSafe(r.date);
                      
                      // Week
                      if (dDate >= weekAgo) {
                          wTotal++;
                          if (r.status === 'Present') wPresent++;
                      }

                      // Month
                      if (dDate >= monthAgo) {
                          mTotal++;
                          if (r.status === 'Present') mPresent++;
                      }

                      // Term
                      if (r.term === currentTerm) {
                          tTotal++;
                          if (r.status === 'Present') tPresent++;
                      }
                  });

                 setWeeklyPercent(wTotal > 0 ? (wPresent / wTotal) * 100 : 0);
                 setMonthlyPercent(mTotal > 0 ? (mPresent / mTotal) * 100 : 0);
                 setTermPercent(tTotal > 0 ? (tPresent / tTotal) * 100 : 0);
             } catch(e) {
                 console.error(e);
             }
             setLoading(false);
         }, (error) => {
             console.error('Error fetching parent attendance records:', error);
             setLoading(false);
         });
         return unsubscribe;
     };
     const unsub = fetchAttendance();
     return () => unsub && unsub();
  }, [selectedChild, profile.schoolId]);

  return (
    <ParentLayout profile={profile}>
      <div className="mb-8 p-6 rounded-[2.5rem] shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <h1 className="text-2xl font-black">Attendance Overview</h1>
        <p className="text-sm text-white/80 font-medium tracking-wide mt-1">Monitor your child's attendance analytics.</p>
      </div>

      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm mb-8">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Select Child</h2>
        <div className="flex flex-wrap gap-4">
            {children.map(child => (
                <button
                    key={child.id}
                    onClick={() => setSelectedChild(child.id)}
                    className={`px-6 py-3 rounded-2xl font-bold transition-all ${
                        selectedChild === child.id 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                >
                    {child.fullName}
                </button>
            ))}
            {children.length === 0 && !loading && (
                <p className="text-gray-500">No children found.</p>
            )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : (
          selectedChild && (
            <div className="space-y-8 animate-in fade-in duration-500">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Weekly */}
                 <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                        <Calendar className="h-8 w-8 text-blue-600" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-2">Weekly Attendance</h3>
                    <div className="text-4xl font-black text-gray-900 dark:text-white mb-2">{weeklyPercent.toFixed(1)}%</div>
                    <p className="text-xs text-gray-500 font-bold">Based on last 7 days</p>
                 </div>

                 {/* Monthly */}
                 <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                        <FileText className="h-8 w-8 text-indigo-600" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-2">Monthly Attendance</h3>
                    <div className="text-4xl font-black text-gray-900 dark:text-white mb-2">{monthlyPercent.toFixed(1)}%</div>
                    <p className="text-xs text-gray-500 font-bold">Based on last 30 days</p>
                 </div>

                 {/* Term */}
                 <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-2">Term Attendance</h3>
                    <div className="text-4xl font-black text-gray-900 dark:text-white mb-2">{termPercent.toFixed(1)}%</div>
                    <p className="text-xs text-gray-500 font-bold">Current active term</p>
                 </div>
               </div>

               <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                   <h2 className="text-lg font-black text-gray-900 dark:text-white mb-6">Recent Records</h2>
                   {attendanceRecords.length === 0 ? (
                       <div className="flex flex-col items-center justify-center py-12 text-center">
                           <AlertCircle className="h-12 w-12 text-gray-300 mb-4" />
                           <p className="text-gray-500 font-bold">No attendance records found yet</p>
                       </div>
                   ) : (
                        <div className="space-y-4">
                           {attendanceRecords.sort((a,b) => {
                               const da = a.date.split('-').map(Number);
                               const db = b.date.split('-').map(Number);
                               return new Date(db[0], db[1]-1, db[2]).getTime() - new Date(da[0], da[1]-1, da[2]).getTime();
                           }).slice(0, 10).map((r, i) => {
                               const [y,m,d] = r.date.split('-').map(Number);
                               const displayDate = new Date(y, m-1, d).toLocaleDateString();
                               return (
                               <div key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-2xl">
                                   <div>
                                       <div className="font-bold text-gray-900 dark:text-white">{r.dayOfWeek}, {displayDate}</div>
                                       <div className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-black">{r.session} Session</div>
                                   </div>
                                   <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${
                                       r.status === 'Present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                   }`}>
                                       {r.status}
                                   </div>
                               </div>
                           );})}
                       </div>
                   )}
               </div>
            </div>
          )
      )}

    </ParentLayout>
  );
}
