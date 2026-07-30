import React, { useState, useEffect } from 'react';
import ParentLayout from '../../components/ParentLayout';
import { UserProfile } from '../../types';
import { Video, Calendar, Clock, Loader2, Users } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export default function LiveClassesParent({ profile }: { profile: UserProfile }) {
  const [loading, setLoading] = useState(true);
  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);

  useEffect(() => {
    if (!profile || !profile.schoolId) return;

    const fetchClasses = async () => {
      try {
        setLoading(true);

        const parentsQuery = query(
          collection(db, 'schools', profile.schoolId!, 'parents'), 
          where('uid', '==', profile.uid)
        );
        const parentsSnapshot = await getDocs(parentsQuery);
        
        let parentId = '';
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

        // Get children
        const childrenQuery = query(
          collection(db, 'schools', profile.schoolId!, 'students'), 
          where('parentId', '==', parentId)
        );
        const childrenSnap = await getDocs(childrenQuery);
        const childrenData = childrenSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setChildren(childrenData);

        if (childrenData.length === 0) {
          setLoading(false);
          return;
        }

        const classIds = childrenData.map(c => c.classId).filter(Boolean);

        if (classIds.length === 0) {
           setLoading(false);
           return;
        }

        // In firestore, 'in' queries support max 10 elements. Assuming typical parent has < 10 children.
        // We can do it more cleanly by doing individual queries or chunking. Let's chunk if > 10.
        const allLiveClasses: any[] = [];
        
        for (let i = 0; i < classIds.length; i += 10) {
           const chunk = classIds.slice(i, i + 10);
           const classesQ = query(
             collection(db, 'live_classes'),
             where('schoolId', '==', profile.schoolId),
             where('classId', 'in', chunk)
           );
           const classesSnap = await getDocs(classesQ);
           classesSnap.docs.forEach(d => {
             allLiveClasses.push({ id: d.id, ...d.data() });
           });
        }

        // Process status
        const now = new Date();
        const processedLiveClasses = allLiveClasses.map(lc => {
          const classStart = new Date(`${lc.date}T${lc.time}`);
          const classEnd = new Date(classStart.getTime() + lc.duration * 60000);
          
          let status = 'Upcoming';
          if (now > classEnd) status = 'Past';
          else if (now >= classStart && now <= classEnd) status = 'Ongoing';
          
          // Match to student
          const matchedStudents = childrenData.filter(c => c.classId === lc.classId).map(c => c.firstName).join(', ');

          return { ...lc, status, studentNames: matchedStudents, startDateTime: classStart };
        });

        // Sort by date (Upcoming first, then by date ascending)
        processedLiveClasses.sort((a, b) => {
           if (a.status === 'Ongoing' && b.status !== 'Ongoing') return -1;
           if (b.status === 'Ongoing' && a.status !== 'Ongoing') return 1;
           if (a.status === 'Upcoming' && b.status === 'Past') return -1;
           if (b.status === 'Upcoming' && a.status === 'Past') return 1;
           return a.startDateTime.getTime() - b.startDateTime.getTime();
        });

        setLiveClasses(processedLiveClasses);

      } catch (error) {
        console.error("Error fetching live classes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClasses();
    
    const intervalId = setInterval(() => {
        setLiveClasses(prevData => {
           const now = new Date();
           return prevData.map(lc => {
             const classEnd = new Date(lc.startDateTime.getTime() + lc.duration * 60000);
             let newStatus = 'Upcoming';
             if (now > classEnd) newStatus = 'Past';
             else if (now >= lc.startDateTime && now <= classEnd) newStatus = 'Ongoing';
             return { ...lc, status: newStatus };
           });
        });
    }, 60000);
    
    return () => clearInterval(intervalId);
  }, [profile]);

  if (loading) {
    return (
      <ParentLayout profile={profile}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-maroon" />
        </div>
      </ParentLayout>
    );
  }

  // Also include the Upcoming Live Classes notification widget at the top if there are ongoing/upcoming classes

  return (
    <ParentLayout profile={profile}>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">Live Classes</h1>
        <p className="text-gray-500 font-medium mt-2">Join scheduled virtual classes for your children.</p>
      </div>

      {liveClasses.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Video className="h-10 w-10 text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Live Classes</h3>
          <p className="text-gray-500 max-w-md mx-auto">There are currently no scheduled live classes for your children.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {liveClasses.map((lc) => (
             <div key={lc.id} className={`bg-white dark:bg-gray-900 rounded-3xl border ${lc.status === 'Ongoing' ? 'border-green-300 dark:border-green-800 shadow-green-100 dark:shadow-none shadow-lg' : 'border-gray-100 dark:border-gray-800 shadow-sm'} p-6 relative overflow-hidden flex flex-col transition-all hover:shadow-lg`}>
                {lc.status === 'Ongoing' && (
                  <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-bl-2xl animate-pulse">
                     Live Now
                  </div>
                )}
                
                <div className="flex items-center gap-2 mb-4">
                  <div className={`p-2 rounded-xl ${lc.status === 'Ongoing' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                    <Video className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-lg text-gray-900 dark:text-white leading-tight">{lc.topic}</h4>
                    <p className="text-sm font-bold text-gray-500">{lc.subject}</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl flex-1">
                  <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="font-bold">Student: <span className="text-maroon font-black">{lc.studentNames}</span> ({lc.className})</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{new Date(lc.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric'})}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="font-medium flex items-center gap-2">{lc.time} <span className="text-xs text-gray-400 font-bold">({lc.duration} mins)</span></span>
                    </div>
                  </div>
                </div>

                <div className="mt-auto">
                   {(lc.status === 'Upcoming' || lc.status === 'Ongoing') && (
                     <a
                       href={lc.joinUrl}
                       target="_blank"
                       rel="noopener noreferrer"
                       className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold transition-all ${lc.status === 'Ongoing' ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20'}`}
                     >
                        <Video className="h-5 w-5" />
                        Join Class
                     </a>
                   )}
                   {lc.status === 'Past' && (
                     <div className="w-full text-center py-3.5 text-sm font-bold text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                        Class Ended
                     </div>
                   )}
                </div>
             </div>
          ))}
        </div>
      )}
    </ParentLayout>
  );
}
