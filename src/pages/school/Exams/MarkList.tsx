import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  ChevronLeft, 
  Loader2, 
  Calendar,
  AlertCircle 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { School, ExamSession, GradingSystem, AcademicSettings } from '../../../types';
import { collection, query, where, doc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import ClassMarkList from '../Reports/ExamAnalysis/components/ClassMarkList';
import SessionSelector from '../Reports/ExamAnalysis/components/SessionSelector';

export default function MarkList({ schoolId, school }: { schoolId: string, school: School | null }) {
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [gradingSystem, setGradingSystem] = useState<GradingSystem | null>(null);
  const [academicSettings, setAcademicSettings] = useState<AcademicSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;

    const fetchData = async () => {
      try {
        const q = query(
            collection(db, 'exam_sessions'),
            where('schoolId', '==', schoolId),
            where('academicYear', '==', school?.academicYear || '')
        );

        const [sessionsSnap, gradingSnap, schoolSnap] = await Promise.all([
          getDocs(q),
          getDoc(doc(db, 'grading_systems', schoolId)),
          getDoc(doc(db, 'schools', schoolId))
        ]);

        const data = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamSession));
        setSessions(data);
        if (data.length > 0 && !selectedSessionId) {
            setSelectedSessionId(data[0].id);
        }

        if (gradingSnap.exists()) {
          setGradingSystem({ id: gradingSnap.id, ...gradingSnap.data() } as GradingSystem);
        }

        if (schoolSnap.exists()) {
          setAcademicSettings(schoolSnap.data()?.academicSettings || null);
        }
      } catch (err) {
        console.error("Error fetching MarkList data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [schoolId, school?.academicYear]);

  useEffect(() => {
    if (selectedSessionId) {
        setSelectedSession(sessions.find(s => s.id === selectedSessionId) || null);
    }
  }, [selectedSessionId, sessions]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-white" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard/exams" className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Class Mark List</h1>
            <p className="text-sm text-blue-100">View and print consolidated mark lists for any class.</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-50 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
             </div>
             <p className="text-sm font-bold text-gray-700">Select Session to Analyze</p>
          </div>
          <SessionSelector 
            sessions={sessions} 
            selectedId={selectedSessionId} 
            onSelect={setSelectedSessionId} 
          />
        </div>

        {selectedSession ? (
          <ClassMarkList 
            schoolId={schoolId} 
            school={school} 
            session={selectedSession} 
            gradingSystem={gradingSystem}
            academicSettings={academicSettings}
          />
        ) : (
          <div className="py-20 text-center text-gray-400">
             <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-200" />
             <p>No active examination session found for this academic year.</p>
          </div>
        )}
      </div>
    </div>
  );
}
