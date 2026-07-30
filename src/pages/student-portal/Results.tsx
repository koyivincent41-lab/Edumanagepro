import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { ExamSession, ExamResult, Student } from '@/types';
import { Award, Eye, Download, Search, AlertCircle, FileText, ChevronRight } from 'lucide-react';
import ResultsSlip from '@/components/ResultsSlip';

interface ResultsProps {
  session: any;
}

type ExamCategory = 'Opener' | 'Midterm' | 'End Term';

const CATEGORIES: ExamCategory[] = ['Opener', 'Midterm', 'End Term'];
const CATEGORY_MAP: Record<ExamCategory, string> = {
  'Opener': 'Openar Exams',
  'Midterm': 'Midterm Exams',
  'End Term': 'End Term Exams'
};

export default function Results({ session }: ResultsProps) {
  const [activeTab, setActiveTab] = useState<ExamCategory>('Opener');
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [hasResultsBySession, setHasResultsBySession] = useState<Record<string, boolean>>({});
  const [viewingResult, setViewingResult] = useState<{ sessionId: string, action: 'view' | 'download' } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch all exam sessions for the school
        const sessionsQuery = query(
          collection(db, 'exam_sessions'),
          where('schoolId', '==', session.schoolId)
        );
        const sessionsSnap = await getDocs(sessionsQuery);
        const sessionsData = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamSession));
        setSessions(sessionsData);

        // 2. Fetch all results for THIS student to see which sessions they have marks in
        const resultsQuery = query(
          collection(db, 'exam_results'),
          where('studentId', '==', session.id)
        );
        const resultsSnap = await getDocs(resultsQuery);
        const resultHashes: Record<string, boolean> = {};
        resultsSnap.docs.forEach(d => {
          const res = d.data() as ExamResult;
          resultHashes[res.examSessionId] = true;
        });
        setHasResultsBySession(resultHashes);

      } catch (error) {
        console.error("Error fetching results:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  const getSessionsForActiveTab = () => {
    const categoryValue = CATEGORY_MAP[activeTab];
    return sessions.filter(s => {
      // Prioritize sessions that have results for this student in the target category
      // Or sessions that match the category by name/type
      const hasResultsInThisSession = hasResultsBySession[s.id];
      if (!hasResultsInThisSession) return false;

      const matchesType = s.examType === activeTab || 
                         (activeTab === 'Opener' && s.examType === 'Openar') ||
                         (activeTab === 'End Term' && s.examType === 'End Term') ||
                         (activeTab === 'Midterm' && s.examType === 'Midterm');

      const matchesName = s.examName.toLowerCase().includes(activeTab.toLowerCase().replace(' ', ''));
      
      return matchesType || matchesName;
    });
  };

  const activeSessions = getSessionsForActiveTab();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Examination Results</h2>
          <p className="text-gray-500 font-medium">View and download your official terminal assessment results</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1.5 bg-gray-100 rounded-2xl w-full max-w-md mx-auto sm:mx-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all duration-300 ${
              activeTab === cat 
                ? 'bg-white text-primary shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-gray-500 font-bold animate-pulse">Checking for available results...</p>
        </div>
      ) : activeSessions.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-gray-100 shadow-sm">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
            <Award className="h-10 w-10" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Results not yet available</h3>
          <p className="text-gray-500 max-w-sm mx-auto">Results for {activeTab} exams haven't been published or entered for your account yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {activeSessions.map((s) => (
            <div 
              key={s.id}
              className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 group"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-300">
                    <FileText className="h-8 w-8" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">{s.examName}</h4>
                    <p className="text-gray-500 font-medium">
                      {s.term} • {s.academicYear}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                       <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                       <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Verified Results</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setViewingResult({ sessionId: s.id, action: 'view' })}
                    className="flex-1 md:flex-none px-6 py-3 bg-primary/5 text-primary font-black rounded-xl hover:bg-primary hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View Slip
                  </button>
                  <button 
                    onClick={() => setViewingResult({ sessionId: s.id, action: 'download' })}
                    className="flex-1 md:flex-none px-6 py-3 bg-gray-900 text-white font-black rounded-xl hover:bg-black transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4">
            <AlertCircle className="h-6 w-6 text-amber-600 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-amber-900 underline decoration-amber-200 decoration-2 underline-offset-4">Privacy Note</p>
              <p className="text-sm text-amber-700 font-medium leading-relaxed">
                These results are strictly confidential. You can only see your own marks. If you notice any discrepancy, please contact your class teacher or the exams office immediately.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results Slip Modal */}
      {viewingResult && (
        <ResultsSlip 
          student={session as any} 
          examSessionId={viewingResult.sessionId} 
          schoolId={session.schoolId}
          initialAction={viewingResult.action}
          onClose={() => setViewingResult(null)} 
        />
      )}
    </div>
  );
}
