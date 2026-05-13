import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Target,
  Award,
  Loader2,
  ChevronRight,
  GitBranch,
  BarChart3,
  Download
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../../firebase';
import { School, ExamSession, ExamResult, GradingSystem, Class, Stream } from '../../../../../types';
import { calculateAcademicStats } from '../../../../../lib/academicUtils';
import { exportToPDF } from '../../../../../lib/reportUtils';
import { toast } from 'sonner';

interface WholeSchoolAnalysisProps {
  schoolId: string;
  school: School | null;
  session: ExamSession;
  gradingSystem: GradingSystem | null;
}

export default function WholeSchoolAnalysis({ schoolId, school, session, gradingSystem }: WholeSchoolAnalysisProps) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.id || !schoolId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const resultsQ = query(collection(db, 'exam_results'), where('examSessionId', '==', session.id));
        const classesQ = query(collection(db, 'schools', schoolId, 'classes'));
        const streamsQ = query(collection(db, 'schools', schoolId, 'streams'));

        const [resultsSnap, classesSnap, streamsSnap] = await Promise.all([
          getDocs(resultsQ),
          getDocs(classesQ),
          getDocs(streamsQ)
        ]);

        setResults(resultsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResult)));
        setClasses(classesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
        setStreams(streamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Stream)));
      } catch (error) {
        console.error("Error fetching school analysis data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session.id, schoolId]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  const classAnalysis = classes.filter(c => session.applicableClasses.includes(c.id)).map(cls => {
    const classResults = results.filter(r => r.classId === cls.id);
    const stats = calculateAcademicStats(classResults, gradingSystem);
    
    // Breakdown by streams
    const streamBreakdown = streams.filter(s => s.classId === cls.id).map(stream => {
        const streamResults = classResults.filter(r => {
            // Need to handle streaming logic if results have streamId
            return (r as any).streamId === stream.id;
        });
        const streamStats = calculateAcademicStats(streamResults, gradingSystem);
        return {
            name: stream.name,
            mean: streamStats.meanScore,
            candidates: streamStats.totalCandidates
        };
    }).filter(s => s.candidates > 0);

    return {
      ...cls,
      stats,
      streamBreakdown
    };
  }).sort((a, b) => b.stats.meanScore - a.stats.meanScore);

  const handleExportPDF = async () => {
    if (classAnalysis.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['#', 'Class', 'Candidates', 'Mean Score', 'Mean Grade', 'Pass Rate', 'Best Stream'];
    const data = classAnalysis.map((cls, i) => {
      const bestStream = [...cls.streamBreakdown].sort((a,b) => b.mean - a.mean)[0];
      return [
        (i + 1).toString(),
        cls.name,
        cls.stats.totalCandidates.toString(),
        cls.stats.meanScore.toFixed(2),
        cls.stats.meanGrade,
        cls.stats.passRate.toFixed(1) + '%',
        bestStream?.name || 'N/A'
      ];
    });

    try {
      await exportToPDF(session.examName + ' - Class Analysis', headers, data, school, 'class_analysis');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Error exporting to PDF');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Class Performance Comparison</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-all"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-printer h-4 w-4"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
              Print
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Class</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Candidates</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Mean Score</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Mean Grade</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Pass Rate</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Best Stream</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {classAnalysis.map((cls, i) => {
                const bestStream = [...cls.streamBreakdown].sort((a,b) => b.mean - a.mean)[0];
                return (
                  <tr key={cls.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          {i + 1}
                        </div>
                        <span className="text-sm font-black text-gray-900">{cls.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-center text-gray-500">{cls.stats.totalCandidates}</td>
                    <td className="px-6 py-4 text-sm font-bold text-center text-gray-700">{cls.stats.meanScore.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-black text-center text-primary">{cls.stats.meanGrade}</td>
                    <td className="px-6 py-4 text-center">
                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${cls.stats.passRate >= 50 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            {cls.stats.passRate.toFixed(1)}%
                        </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-center text-gray-600">{bestStream?.name || 'N/A'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">School Wide Mean</p>
                  <p className="text-xl font-black text-gray-900">
                      {(results.reduce((s, r) => s + r.scoreObtained, 0) / (results.length || 1)).toFixed(2)}
                  </p>
              </div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center">
                  <GitBranch className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Subjects</p>
                  <p className="text-xl font-black text-gray-900">{session.applicableSubjects.length}</p>
              </div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center">
                  <Award className="h-6 w-6 text-green-600" />
              </div>
              <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">School Pass Rate</p>
                  <p className="text-xl font-black text-gray-900">
                        {(calculateAcademicStats(results, gradingSystem).passRate).toFixed(1)}%
                  </p>
              </div>
          </div>
      </div>
    </div>
  );
}
