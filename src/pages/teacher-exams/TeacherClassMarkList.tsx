import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { School, ExamSession, GradingSystem, AcademicSettings } from '../../types';
import { Loader2, AlertCircle } from 'lucide-react';
import SessionSelector from '../school/Reports/ExamAnalysis/components/SessionSelector';
import ClassMarkList from '../school/Reports/ExamAnalysis/components/ClassMarkList';

interface TeacherClassMarkListProps {
  teacher: any;
}

export default function TeacherClassMarkList({ teacher }: TeacherClassMarkListProps) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  
  const [school, setSchool] = useState<School | null>(null);
  const [gradingSystem, setGradingSystem] = useState<GradingSystem | null>(null);
  const [academicSettings, setAcademicSettings] = useState<AcademicSettings | null>(null);

  useEffect(() => {
    if (!teacher?.schoolId) return;

    const fetchInitialData = async () => {
      try {
        // Fetch School
        const schoolDoc = await getDoc(doc(db, 'schools', teacher.schoolId));
        // Fetch Academic Settings from schoolDoc
        if (schoolDoc.exists()) {
          const schoolData = schoolDoc.data() as School;
          setSchool({ id: schoolDoc.id, ...schoolData });
          setAcademicSettings(schoolData.academicSettings || {
            enableRanking: true,
            rankingBasis: 'average',
            passMark: 40,
            updatedAt: new Date().toISOString()
          });
        }

        // Fetch Grading System
        // Handle currentBranch if passed via teacher or just default to schoolId
        const docId = teacher.branchId ? `${teacher.schoolId}_${teacher.branchId}` : teacher.schoolId;
        const gradingDoc = await getDoc(doc(db, 'grading_systems', docId));
        if (gradingDoc.exists()) {
          setGradingSystem({ id: gradingDoc.id, ...gradingDoc.data() } as GradingSystem);
        }

        // Fetch Exam Sessions
        const q = query(
          collection(db, 'exam_sessions'),
          where('schoolId', '==', teacher.schoolId),
          where('status', '==', 'published') // or active? teacher should see active/published
        );
        const snap = await getDocs(q);
        const fetchedSessions = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamSession));
        setSessions(fetchedSessions);
        
        if (fetchedSessions.length > 0) {
            setSelectedSessionId(fetchedSessions[0].id);
        }

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [teacher]);

  // Fetch Grading System when settings are loaded is removed

  if (!teacher.classTeacherAssignment) {
    return (
      <div className="bg-red-50 text-red-600 p-6 rounded-2xl flex items-start gap-4">
        <AlertCircle className="h-6 w-6 mt-0.5" />
        <div>
          <h3 className="text-lg font-bold">Access Denied</h3>
          <p className="mt-1 opacity-90">You are not authorized to view mark lists. You have not been assigned to a class. Please contact the administrator.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  const selectedSession = sessions.find(s => s.id === selectedSessionId) || null;

  return (
    <div className="space-y-6">
       <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Select Exam Session</h2>
          <p className="text-sm text-gray-500 font-medium">Choose an exam session to view the mark list for your class.</p>
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
          <div className="bg-white p-12 rounded-[2rem] border border-gray-100 text-center">
            <h3 className="text-lg font-bold text-gray-900">No Session Selected</h3>
            <p className="text-gray-500 mt-2">Please select an exam session above to view the mark list.</p>
          </div>
      )}
    </div>
  );
}
