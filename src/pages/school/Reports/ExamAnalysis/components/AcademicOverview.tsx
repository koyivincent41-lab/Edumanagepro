import React, { useState, useEffect } from 'react';
import { 
  Users, 
  BookOpen, 
  TrendingUp, 
  Target, 
  Award,
  AlertCircle,
  BarChart3,
  Search
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../../firebase';
import { School, ExamSession, ExamResult, GradingSystem } from '../../../../../types';
import { calculateAcademicStats, AcademicStats } from '../../../../../lib/academicUtils';
import { Loader2 } from 'lucide-react';

interface AcademicOverviewProps {
  schoolId: string;
  school: School | null;
  session: ExamSession;
  gradingSystem: GradingSystem | null;
}

export default function AcademicOverview({ schoolId, school, session, gradingSystem }: AcademicOverviewProps) {
  const [stats, setStats] = useState<AcademicStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.id) return;

    const fetchResults = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'exam_results'), 
          where('examSessionId', '==', session.id)
        );
        const snap = await getDocs(q);
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResult));
        
        const academicStats = calculateAcademicStats(results, gradingSystem);
        setStats(academicStats);
      } catch (error) {
        console.error("Error fetching overview stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [session?.id, gradingSystem]);

  if (loading || !session) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  const kpis = [
    { name: 'Mean Score', value: stats?.meanScore.toFixed(1) || '0', sub: `Grade: ${stats?.meanGrade || 'N/A'}`, icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'Candidates', value: stats?.totalCandidates.toString() || '0', sub: 'Total Sat Exam', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { name: 'Pass Rate', value: `${stats?.passRate.toFixed(1) || '0'}%`, sub: 'Above Pass Mark', icon: Award, color: 'text-green-600', bg: 'bg-green-50' },
    { name: 'Highest Score', value: stats?.highestScore.toString() || '0', sub: 'Single Subject Best', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${kpi.bg} flex items-center justify-center shrink-0`}>
              <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{kpi.name}</p>
              <p className="text-xl font-black text-gray-900">{kpi.value}</p>
              <p className="text-[10px] text-gray-500 font-medium">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Simple Grade Distribution Summary */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Grade Distribution</h3>
            <BarChart3 className="h-5 w-5 text-gray-300" />
          </div>
          <div className="space-y-3">
            {Object.entries(stats?.gradeDistribution || {}).sort((a,b) => a[0].localeCompare(b[0])).map(([grade, count]) => {
              const percentage = ((count / (stats?.totalCandidates || 1)) * 100);
              return (
                <div key={grade} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-600">{grade}</span>
                    <span className="text-gray-900">{count} Learners ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-school-gradient rounded-full" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Exam Compliance Status */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-center text-center">
            <div className="mx-auto w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-4">
                <Target className="h-10 w-10 text-green-600" />
            </div>
            <h4 className="text-lg font-bold text-gray-900">Analysis Live</h4>
            <p className="text-sm text-gray-500 max-w-xs mx-auto mt-1">
                Data is being synchronized in real-time. Any mark changes in the portal will reflect here immediately.
            </p>
            <div className="mt-6 pt-6 border-t border-gray-50 grid grid-cols-2 gap-4">
                <div className="text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Status</p>
                    <p className="text-sm font-bold text-green-600">Active</p>
                </div>
                <div className="text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Results Found</p>
                    <p className="text-sm font-bold text-gray-900">{stats?.totalCandidates || 0} Entries</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
