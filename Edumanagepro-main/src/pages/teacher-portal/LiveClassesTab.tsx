import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Class } from '../../types';
import { Video, Calendar, Clock, Plus, Trash2, ExternalLink, Users, AlertCircle, X, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface LiveClass {
  id?: string;
  teacherId: string;
  schoolId: string;
  subject: string;
  classId: string;
  className: string;
  topic: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  duration: number; // minutes
  joinUrl: string;
  startUrl: string;
  status: 'Upcoming' | 'Ongoing' | 'Past';
  createdAt: string;
}

interface LiveClassesTabProps {
  teacher: any;
}

export default function LiveClassesTab({ teacher }: LiveClassesTabProps) {
  const [activeTab, setActiveTab] = useState<'Upcoming' | 'Ongoing' | 'Past'>('Upcoming');
  const [classes, setClasses] = useState<Class[]>([]);
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    topic: '',
    subject: '',
    classId: '',
    date: '',
    time: '',
    duration: 45,
  });

  useEffect(() => {
    fetchClasses();
    fetchLiveClasses();
  }, [teacher]);

  // Recalculate status of live classes based on current time
  useEffect(() => {
    const updateStatuses = () => {
      const now = new Date();
      setLiveClasses(prevData => prevData.map(lc => {
        const classStart = new Date(`${lc.date}T${lc.time}`);
        const classEnd = new Date(classStart.getTime() + lc.duration * 60000);
        
        let newStatus: 'Upcoming' | 'Ongoing' | 'Past' = 'Upcoming';
        if (now > classEnd) {
          newStatus = 'Past';
        } else if (now >= classStart && now <= classEnd) {
          newStatus = 'Ongoing';
        }
        
        if (newStatus !== lc.status) {
          return { ...lc, status: newStatus };
        }
        return lc;
      }));
    };

    updateStatuses();
    const interval = setInterval(updateStatuses, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const fetchClasses = async () => {
    try {
      const teacherClassesMap = new Map<string, Class>();

      // 1. Query classes where this teacher is the class teacher
      const classTeacherQuery = query(
        collection(db, 'schools', teacher.schoolId, 'classes'),
        where('classTeacherId', '==', teacher.id)
      );
      const classTeacherSnapshot = await getDocs(classTeacherQuery);
      
      classTeacherSnapshot.docs.forEach(doc => {
        teacherClassesMap.set(doc.id, { id: doc.id, ...doc.data() } as Class);
      });

      // 2. Query class_subjects where this teacher teaches a subject
      const subjectTeacherQuery = query(
        collection(db, 'class_subjects'),
        where('schoolId', '==', teacher.schoolId),
        where('teacherId', '==', teacher.id)
      );
      const subjectTeacherSnapshot = await getDocs(subjectTeacherQuery);
      
      for (const csDoc of subjectTeacherSnapshot.docs) {
        const classId = csDoc.data().classId;
        if (classId && !teacherClassesMap.has(classId)) {
          const classDocRef = doc(db, 'schools', teacher.schoolId, 'classes', classId);
          const classDocSnap = await getDoc(classDocRef);
          if (classDocSnap.exists()) {
            teacherClassesMap.set(classId, { id: classId, ...classDocSnap.data() } as Class);
          }
        }
      }

      setClasses(Array.from(teacherClassesMap.values()));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLiveClasses = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'live_classes'),
        where('schoolId', '==', teacher.schoolId),
        where('teacherId', '==', teacher.id)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveClass));
      
      // Initial status calculation
      const now = new Date();
      const updatedData = data.map(lc => {
        const classStart = new Date(`${lc.date}T${lc.time}`);
        const classEnd = new Date(classStart.getTime() + lc.duration * 60000);
        let newStatus: 'Upcoming' | 'Ongoing' | 'Past' = 'Upcoming';
        if (now > classEnd) newStatus = 'Past';
        else if (now >= classStart && now <= classEnd) newStatus = 'Ongoing';
        return { ...lc, status: newStatus };
      });

      // Sort by date and time (most recent upcoming first)
      updatedData.sort((a, b) => {
        const timeA = new Date(`${a.date}T${a.time}`).getTime();
        const timeB = new Date(`${b.date}T${b.time}`).getTime();
        return timeA - timeB;
      });

      setLiveClasses(updatedData);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load live classes');
    } finally {
      setLoading(false);
    }
  };

  const generateZoomMeeting = async (topic: string, date: string, time: string, duration: number) => {
    try {
      const response = await fetch('/api/zoom/meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, date, time, duration })
      });
      if (!response.ok) {
        let errorMsg = 'Failed to create Zoom meeting';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch(e) {
          errorMsg = await response.text();
        }
        throw new Error(errorMsg);
      }
      return await response.json();
    } catch (error: any) {
      console.error(error);
      throw error;
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cls = classes.find(c => c.id === formData.classId);
      if (!cls) {
        toast.error('Please select a valid class');
        return;
      }

      toast.loading('Generating Zoom meeting link...', { id: 'zoom' });
      
      const zoomData: any = await generateZoomMeeting(formData.topic, formData.date, formData.time, formData.duration);

      const newLiveClass: LiveClass = {
        teacherId: teacher.id,
        schoolId: teacher.schoolId,
        subject: formData.subject,
        classId: cls.id,
        className: cls.name,
        topic: formData.topic,
        date: formData.date,
        time: formData.time,
        duration: Number(formData.duration),
        joinUrl: zoomData.joinUrl,
        startUrl: zoomData.startUrl,
        status: 'Upcoming',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'live_classes'), newLiveClass);
      
      toast.success('Live class scheduled successfully', { id: 'zoom' });
      setShowCreateModal(false);
      setFormData({ topic: '', subject: '', classId: '', date: '', time: '', duration: 45 });
      fetchLiveClasses();
    } catch (error: any) {
      console.error(error);
      const msg = error.message || 'Failed to schedule class';
      toast.error(msg, { id: 'zoom', duration: 8000 });
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (window.confirm('Are you sure you want to cancel and delete this live class?')) {
      try {
        await deleteDoc(doc(db, 'live_classes', id));
        toast.success('Live class cancelled');
        fetchLiveClasses();
      } catch (error) {
        console.error(error);
        toast.error('Failed to cancel class');
      }
    }
  };

  const filteredClasses = liveClasses.filter(lc => lc.status === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('Upcoming')}
          className={`pb-4 px-6 text-sm font-bold transition-all ${
            activeTab === 'Upcoming' 
              ? 'border-b-2 border-maroon text-maroon' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Upcoming
          <span className="ml-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
            {liveClasses.filter(c => c.status === 'Upcoming').length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('Ongoing')}
          className={`pb-4 px-6 text-sm font-bold transition-all ${
            activeTab === 'Ongoing' 
              ? 'border-b-2 border-green-600 text-green-600' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Ongoing
          {liveClasses.filter(c => c.status === 'Ongoing').length > 0 && (
             <span className="ml-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 py-0.5 px-2 rounded-full text-xs animate-pulse">
               {liveClasses.filter(c => c.status === 'Ongoing').length}
             </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('Past')}
          className={`pb-4 px-6 text-sm font-bold transition-all ${
            activeTab === 'Past' 
              ? 'border-b-2 border-gray-600 text-gray-600 dark:text-gray-300' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Past
        </button>
      </div>

      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
           <Video className="h-5 w-5" />
           <span className="font-medium text-sm">Schedule Zoom meetings and manage your virtual classrooms.</span>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Schedule Live Class
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Video className="h-8 w-8 text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No {activeTab} Classes</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">You don't have any {activeTab.toLowerCase()} live classes at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredClasses.map(lc => (
             <div key={lc.id} className={`bg-white dark:bg-gray-800 rounded-2xl border ${lc.status === 'Ongoing' ? 'border-green-300 dark:border-green-800 shadow-green-100 dark:shadow-none shadow-lg' : 'border-gray-100 dark:border-gray-700 shadow-sm'} p-5 relative overflow-hidden group transition-all`}>
                {lc.status === 'Ongoing' && (
                  <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl animate-pulse">
                     Live Now
                  </div>
                )}
                
                <h4 className="font-black text-lg text-gray-900 dark:text-white mb-1 pr-16">{lc.topic}</h4>
                <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 mb-4">
                  <span className="bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-md">{lc.className}</span>
                  <span className="bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-md">{lc.subject}</span>
                </div>
                
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{new Date(lc.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'})}</span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg">
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{lc.time}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-400">{lc.duration} mins</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-auto">
                   {(lc.status === 'Upcoming' || lc.status === 'Ongoing') && (
                     <a
                       href={lc.startUrl}
                       target="_blank"
                       rel="noopener noreferrer"
                       className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-colors ${lc.status === 'Ongoing' ? 'bg-green-600 hover:bg-green-700 text-white shadow-md' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                     >
                        <Video className="h-4 w-4" />
                        Start Meeting
                     </a>
                   )}
                   {lc.status === 'Past' && (
                     <div className="flex-1 text-center py-2.5 text-sm font-bold text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-xl">
                        Ended
                     </div>
                   )}
                   {lc.status === 'Upcoming' && (
                     <button
                       onClick={() => handleDeleteClass(lc.id!)}
                       className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors border border-gray-200 dark:border-gray-700 hover:border-red-200"
                       title="Cancel Meeting"
                     >
                       <Trash2 className="h-5 w-5" />
                     </button>
                   )}
                </div>
             </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl p-6 relative">
             <button onClick={() => setShowCreateModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10">
               <X className="h-6 w-6" />
             </button>
             
             <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Video className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                  Schedule Live Class
                </h2>
             </div>

             <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                   <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Topic</label>
                   <input
                     type="text"
                     required
                     value={formData.topic}
                     onChange={e => setFormData({...formData, topic: e.target.value})}
                     className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
                     placeholder="e.g. Introduction to Algebra"
                   />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                    <input
                      type="text"
                      required
                      value={formData.subject}
                      onChange={e => setFormData({...formData, subject: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
                      placeholder="e.g. Mathematics"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Class</label>
                    <select
                      required
                      value={formData.classId}
                      onChange={e => setFormData({...formData, classId: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="">Select Class</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Date</label>
                     <input
                       type="date"
                       required
                       min={new Date().toISOString().split('T')[0]}
                       value={formData.date}
                       onChange={e => setFormData({...formData, date: e.target.value})}
                       className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Time</label>
                     <input
                       type="time"
                       required
                       value={formData.time}
                       onChange={e => setFormData({...formData, time: e.target.value})}
                       className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
                     />
                   </div>
                </div>

                <div>
                   <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Duration (Minutes)</label>
                   <select
                     required
                     value={formData.duration}
                     onChange={e => setFormData({...formData, duration: Number(e.target.value)})}
                     className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
                   >
                     <option value={30}>30 Minutes</option>
                     <option value={45}>45 Minutes (Standard)</option>
                     <option value={60}>1 Hour</option>
                     <option value={90}>1.5 Hours</option>
                     <option value={120}>2 Hours</option>
                   </select>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex items-start gap-3 mt-4">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    A Zoom meeting link will be automatically generated and shared with the students of the selected class.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-6">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 py-2.5 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                  <button type="submit" className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                    Generate Zoom Link
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}

    </div>
  );
}
