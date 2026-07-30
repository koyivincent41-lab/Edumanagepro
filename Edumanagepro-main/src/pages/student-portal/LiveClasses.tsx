import React, { useState, useEffect } from 'react';
import { 
  Video, 
  Calendar,
  Clock,
  Play,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'sonner';

export default function StudentLiveClasses({ session }: { session: any }) {
  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLiveClasses = async () => {
      try {
        const classesQ = query(
          collection(db, 'live_classes'),
          where('schoolId', '==', session.schoolId),
          where('classId', '==', session.classId)
        );
        const classesSnap = await getDocs(classesQ);
        const data: any[] = classesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const now = new Date();
        const processed = data.map((lc: any) => {
          const classStart = new Date(`${lc.date}T${lc.time}`);
          const classEnd = new Date(classStart.getTime() + (lc.duration || 60) * 60000);
          
          let status = 'Upcoming';
          if (now > classEnd) status = 'Past';
          else if (now >= classStart && now <= classEnd) status = 'Ongoing';
          
          return { ...lc, status, startDateTime: classStart };
        });

        // Sort by date (Ongoing/Upcoming first, then by date ascending)
        processed.sort((a, b) => {
           if (a.status === 'Ongoing' && b.status !== 'Ongoing') return -1;
           if (b.status === 'Ongoing' && a.status !== 'Ongoing') return 1;
           if (a.status === 'Upcoming' && b.status === 'Past') return -1;
           if (b.status === 'Upcoming' && a.status === 'Past') return 1;
           if (a.status === 'Past' && b.status === 'Past') {
               return b.startDateTime.getTime() - a.startDateTime.getTime(); // Newest past first
           }
           return a.startDateTime.getTime() - b.startDateTime.getTime(); // Earliest upcoming first
        });

        setLiveClasses(processed);
      } catch (error) {
         console.error("Error fetching live classes:", error);
         toast.error("Failed to load live classes");
      } finally {
        setLoading(false);
      }
    };

    fetchLiveClasses();

    // Set interval to update statuses every minute
    const interval = setInterval(() => {
       setLiveClasses(prev => prev.map(lc => {
          if (lc.status === 'Past') return lc;
          const now = new Date();
          const classStart = lc.startDateTime;
          const classEnd = new Date(classStart.getTime() + (lc.duration || 60) * 60000);
          let status = 'Upcoming';
          if (now > classEnd) status = 'Past';
          else if (now >= classStart && now <= classEnd) status = 'Ongoing';
          return { ...lc, status };
       }));
    }, 60000);

    return () => clearInterval(interval);
  }, [session.schoolId, session.classId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-6 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Live Classes</h1>
          <p className="mt-2 text-brand-100 font-medium">Join upcoming live sessions</p>
        </div>
        <div className="bg-white/10 p-3 rounded-2xl border border-white/20 flex items-center gap-3">
           <Video className="h-6 w-6 text-white" />
           <div>
             <p className="text-sm font-bold">{liveClasses.filter(c => c.status !== 'Past').length} Upcoming/Ongoing</p>
           </div>
        </div>
      </div>

      {liveClasses.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 text-center shadow-sm">
          <div className="w-16 h-16 bg-gray-50 flex items-center justify-center rounded-2xl mx-auto mb-4 text-gray-400">
             <Video className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No Live Classes</h3>
          <p className="text-gray-500 mt-2">There are currently no live classes scheduled.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {liveClasses.map((lc) => (
             <div key={lc.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col hover:shadow-md transition-shadow">
               <div className="flex justify-between items-start mb-4">
                 <div>
                   <h3 className="font-bold text-lg text-gray-900">{lc.topic}</h3>
                   <span className="text-sm text-gray-500 font-medium">{lc.subjectName || 'General'}</span>
                 </div>
                 {lc.status === 'Ongoing' && (
                   <span className="px-3 py-1 bg-red-100 text-red-700 font-bold text-[10px] uppercase tracking-wider rounded-xl animate-pulse whitespace-nowrap">
                     LIVE NOW
                   </span>
                 )}
                 {lc.status === 'Upcoming' && (
                   <span className="px-3 py-1 bg-blue-100 text-blue-700 font-bold text-[10px] uppercase tracking-wider rounded-xl whitespace-nowrap">
                     UPCOMING
                   </span>
                 )}
                 {lc.status === 'Past' && (
                   <span className="px-3 py-1 bg-gray-100 text-gray-700 font-bold text-[10px] uppercase tracking-wider rounded-xl whitespace-nowrap flex items-center gap-1">
                     <CheckCircle2 className="h-3 w-3" />
                     COMPLETED
                   </span>
                 )}
               </div>

               <div className="flex flex-wrap gap-4 mb-6">
                  <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-xl">
                    <Calendar className="h-4 w-4 text-primary" />
                    {lc.date}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-xl">
                    <Clock className="h-4 w-4 text-primary" />
                    {lc.time} ({lc.duration} min)
                  </div>
               </div>

               <div className="mt-auto pt-4 border-t border-gray-50">
                 {lc.status === 'Upcoming' && (
                   <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-xl text-sm font-bold">
                     <AlertCircle className="h-5 w-5" />
                     Link will be active when class starts.
                   </div>
                 )}
                 {lc.status === 'Ongoing' && lc.joinUrl && (
                   <a
                     href={lc.joinUrl}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-500/30 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all"
                   >
                     <Play className="h-4 w-4 mr-2" />
                     Join Class Now
                   </a>
                 )}
                 {lc.status === 'Ongoing' && !lc.joinUrl && (
                    <div className="text-center p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold">
                       Zoom link not generated. Please inform the teacher.
                    </div>
                 )}
                 {lc.status === 'Past' && (
                    <p className="text-center text-sm text-gray-500 font-medium pb-2 pt-2">This class has ended.</p>
                 )}
               </div>
             </div>
          ))}
        </div>
      )}
    </div>
  );
}
