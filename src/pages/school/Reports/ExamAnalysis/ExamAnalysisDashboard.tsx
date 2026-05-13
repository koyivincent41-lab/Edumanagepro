import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  BookOpen, 
  GraduationCap, 
  Filter, 
  Download, 
  Printer, 
  Settings, 
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  PieChart as PieChartIcon,
  Search,
  LayoutDashboard,
  FileText
} from 'lucide-react';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { School, ExamSession, ExamResult, Class, Stream, Subject, GradingSystem, AcademicSettings } from '../../../../types';
import { useBranch } from '../../../../context/BranchContext';
import { handleFirestoreError, OperationType } from '../../../../lib/firestoreErrorHandler';
import { toast } from 'sonner';

// Components (We'll create these next)
import SessionSelector from './components/SessionSelector';
import AcademicOverview from './components/AcademicOverview';
import ClassMarkList from './components/ClassMarkList';
import SubjectAnalysis from './components/SubjectAnalysis';
import WholeSchoolAnalysis from './components/WholeSchoolAnalysis';
import GradeDistribution from './components/GradeDistribution';
import AcademicSettingsPanel from './components/AcademicSettingsPanel';

export type AnalysisTab = 'overview' | 'marklist' | 'subjects' | 'school' | 'grades' | 'settings';

export default function ExamAnalysisDashboard({ schoolId, school }: { schoolId: string; school: School | null }) {
  const { currentBranch } = useBranch();
  const [activeTab, setActiveTab] = useState<AnalysisTab>('overview');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [gradingSystem, setGradingSystem] = useState<GradingSystem | null>(null);
  const [academicSettings, setAcademicSettings] = useState<AcademicSettings | null>(null);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;

    // Fetch Sessions
    let q = query(collection(db, 'exam_sessions'), where('schoolId', '==', schoolId));
    if (currentBranch) q = query(q, where('branchId', '==', currentBranch.id));

    const unsubSessions = onSnapshot(q, (snap) => {
      const sessionsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamSession));
      setSessions(sessionsData);
      
      // Select latest session by default if none selected
      if (!selectedSessionId && sessionsData.length > 0) {
        // Sort by update date or created date if possible
        const latest = [...sessionsData].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        setSelectedSessionId(latest.id);
      }
      setLoading(false);
    });

    // Fetch Grading System
    const docId = currentBranch ? `${schoolId}_${currentBranch.id}` : schoolId;
    const unsubGrading = onSnapshot(doc(db, 'grading_systems', docId), (snap) => {
      if (snap.exists()) {
        setGradingSystem({ id: snap.id, ...snap.data() } as GradingSystem);
      }
    });

    // Academic Settings (for ranking etc)
    const unsubSettings = onSnapshot(doc(db, 'schools', schoolId), (snap) => {
      if (snap.exists()) {
        setAcademicSettings(snap.data().academicSettings || {
          enableRanking: true,
          rankingBasis: 'total',
          passMark: 50,
          updatedAt: new Date().toISOString()
        });
      }
    });

    return () => {
      unsubSessions();
      unsubGrading();
      unsubSettings();
    };
  }, [schoolId, currentBranch]);

  useEffect(() => {
    if (selectedSessionId) {
      const session = sessions.find(s => s.id === selectedSessionId);
      setSelectedSession(session || null);
    } else {
      setSelectedSession(null);
    }
  }, [selectedSessionId, sessions]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'marklist', name: 'Class Mark List', icon: FileText },
    { id: 'subjects', name: 'Subject Analysis', icon: BookOpen },
    { id: 'school', name: 'School-Wide Analysis', icon: TrendingUp },
    { id: 'grades', name: 'Grade Distribution', icon: PieChartIcon },
    { id: 'settings', name: 'Academic Settings', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Session Selector */}
      <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Academic Analysis Center</h2>
            <p className="text-sm text-gray-500">Analyze performance, generate mark lists, and track school academic trends.</p>
          </div>
          <SessionSelector 
            sessions={sessions} 
            selectedId={selectedSessionId} 
            onSelect={setSelectedSessionId} 
          />
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-50">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AnalysisTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.id 
                ? 'bg-school-gradient text-white shadow-md' 
                : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {(!selectedSessionId || (activeTab !== 'settings' && !selectedSession)) ? (
        <div className="bg-white p-12 rounded-[2rem] border border-gray-100 text-center">
          <BookOpen className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900">No Examination Session Selected</h3>
          <p className="text-gray-500 max-w-sm mx-auto mt-2">Please select an academic session from the dropdown above to view analysis reports.</p>
        </div>
      ) : (
        <div className="transition-all duration-300">
          {activeTab === 'overview' && selectedSession && (
            <AcademicOverview 
              schoolId={schoolId} 
              school={school} 
              session={selectedSession} 
              gradingSystem={gradingSystem}
            />
          )}
          {activeTab === 'marklist' && selectedSession && (
            <ClassMarkList 
              schoolId={schoolId} 
              school={school} 
              session={selectedSession} 
              gradingSystem={gradingSystem}
              academicSettings={academicSettings}
            />
          )}
          {activeTab === 'subjects' && selectedSession && (
            <SubjectAnalysis 
              schoolId={schoolId} 
              school={school} 
              session={selectedSession} 
              gradingSystem={gradingSystem}
            />
          )}
          {activeTab === 'school' && selectedSession && (
            <WholeSchoolAnalysis 
              schoolId={schoolId} 
              school={school} 
              session={selectedSession} 
              gradingSystem={gradingSystem}
            />
          )}
          {activeTab === 'grades' && selectedSession && (
            <GradeDistribution 
              schoolId={schoolId} 
              school={school} 
              session={selectedSession} 
              gradingSystem={gradingSystem}
            />
          )}
          {activeTab === 'settings' && (
            <AcademicSettingsPanel 
              schoolId={schoolId} 
              settings={academicSettings}
              onUpdate={setAcademicSettings}
            />
          )}
        </div>
      )}
    </div>
  );
}
