import React, { useState, useEffect } from 'react';
import { collection, query, where, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { School, ExamSession, GradingSystem, AcademicSettings } from '../../types';
import { Loader2, AlertCircle, Calendar } from 'lucide-react';
import ClassMarkList from '../school/Reports/ExamAnalysis/components/ClassMarkList';
import SessionSelector from '../school/Reports/ExamAnalysis/components/SessionSelector';

interface TeacherClassMarkListProps {
  teacher: any;
}

export default function TeacherClassMarkList({ teacher }: TeacherClassMarkListProps) {
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  
  const [school, setSchool] = useState<School | null>(null);
  const [gradingSystem, setGradingSystem] = useState<GradingSystem | null>(null);
  const [academicSettings, setAcademicSettings] = useState<AcademicSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teacher?.schoolId) return;

    let unsubSessions: () => void = () => {};
    let unsubGrading: () => void = () => {};
    let unsubSettings: () => void = () => {};

    const initialize = async () => {
        try {
            // Need the school basic info first to know academic year
            const schoolDoc = await getDoc(doc(db, 'schools', teacher.schoolId));
            let schoolData: School | null = null;
            if (schoolDoc.exists()) {
                schoolData = { id: schoolDoc.id, ...schoolDoc.data() } as School;
                setSchool(schoolData);
                setAcademicSettings(schoolData.academicSettings || {
                    enableRanking: true,
                    rankingBasis: 'average',
                    passMark: 40,
                    updatedAt: new Date().toISOString()
                });
            }

            const qSessions = query(
                collection(db, 'exam_sessions'),
                where('schoolId', '==', teacher.schoolId),
                where('academicYear', '==', schoolData?.academicYear || '')
            );
            
            const sessionsSnap = await getDocs(qSessions);
            const data = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamSession));
            setSessions(data);
            if (data.length > 0 && !selectedSessionId) {
                const published = data.find(s => s.status === 'Published');
                setSelectedSessionId(published ? published.id : data[0].id);
            }

            const docId = teacher.branchId ? `${teacher.schoolId}_${teacher.branchId}` : teacher.schoolId;
            const gradingSnap = await getDoc(doc(db, 'grading_systems', docId));
            if (gradingSnap.exists()) {
                setGradingSystem({ id: gradingSnap.id, ...gradingSnap.data() } as GradingSystem);
            }
            setLoading(false);

        } catch (error) {
            console.error("Error fetching data:", error);
            setLoading(false);
        }
    };

    initialize();

    return () => {};
  }, [teacher]); // removed selectedSessionId from dep array to avoid rehydrating unnecessarily

  useEffect(() => {
    if (selectedSessionId) {
        setSelectedSession(sessions.find(s => s.id === selectedSessionId) || null);
    }
  }, [selectedSessionId, sessions]);

  if (!teacher.classTeacherAssignment) {
    return (
      <div className="bg-red-50 border border-red-100 text-red-600 p-8 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-center">
        <div className="h-16 w-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center">
          <AlertCircle className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-xl font-black">Access Denied</h3>
          <p className="mt-2 text-sm font-medium opacity-80 max-w-md mx-auto">
            You are not authorized to view the mark list for this class. You can only access the mark list for your assigned class.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 md:p-6 rounded-[2.5rem] shadow-sm space-y-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-primary/10 rounded-xl">
                <Calendar className="h-5 w-5 text-primary" />
             </div>
             <div>
               <p className="text-sm font-bold text-gray-900">Select Exam Session</p>
               <p className="text-xs text-gray-500">Choose the session to view your class mark list</p>
             </div>
          </div>
          <SessionSelector 
            sessions={sessions} 
            selectedId={selectedSessionId} 
            onSelect={setSelectedSessionId} 
          />
        </div>

        {selectedSession ? (
          <ClassMarkList 
            schoolId={teacher.schoolId}
            school={school}
            session={selectedSession}
            gradingSystem={gradingSystem}
            academicSettings={academicSettings}
            restrictedClassId={teacher.classTeacherAssignment}
          />
        ) : (
          <div className="bg-gray-50/50 p-12 rounded-[2.5rem] border border-dashed border-gray-200 text-center">
            <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900">No Exam Sessions</h3>
            <p className="text-gray-500 mt-2 text-sm max-w-md mx-auto">There are no exam sessions available for this academic year.</p>
          </div>
        )}
      </div>
    </div>
  );
}
