import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Users, 
  Target,
  Award,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../../firebase';
import { School, ExamSession, ExamResult, GradingSystem, Subject, Class } from '../../../../../types';
import { calculateAcademicStats, getGradeFromScore } from '../../../../../lib/academicUtils';

interface SubjectAnalysisProps {
  schoolId: string;
  school: School | null;
  session: ExamSession;
  gradingSystem: GradingSystem | null;
}

export default function SubjectAnalysis({ schoolId, school, session, gradingSystem }: SubjectAnalysisProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.id || !schoolId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const resultsQ = query(collection(db, 'exam_results'), where('examSessionId', '==', session.id));
        const subjectsQ = query(collection(db, 'subjects'), where('schoolId', '==', schoolId));
        const classesQ = query(collection(db, 'schools', schoolId, 'classes'));

        const [resultsSnap, subjectsSnap, classesSnap] = await Promise.all([
          getDocs(resultsQ),
          getDocs(subjectsQ),
          getDocs(classesQ)
        ]);

        const allResults = resultsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResult));
        const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));
        const allClasses = classesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class));

        setResults(allResults);
        setSubjects(allSubjects.filter(s => session.applicableSubjects.includes(s.id)));
        setClasses(allClasses);
      } catch (error) {
        console.error("Error fetching subject analysis data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session.id, schoolId]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  const subjectStats = subjects.map(subject => {
    const subjectResults = results.filter(r => r.subjectId === subject.id);
    const stats = calculateAcademicStats(subjectResults, gradingSystem);
    
    // Performance across classes
    const classBreakdown = classes.filter(c => session.applicableClasses.includes(c.id)).map(cls => {
        const clsResults = subjectResults.filter(r => r.classId === cls.id);
        const clsStats = calculateAcademicStats(clsResults, gradingSystem);
        return {
            className: cls.name,
            mean: clsStats.meanScore,
            candidates: clsStats.totalCandidates
        };
    }).filter(c => c.candidates > 0);

    return {
      ...subject,
      stats,
      classBreakdown
    };
  }).sort((a, b) => b.stats.meanScore - a.stats.meanScore);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6">Subject Performance Ranking</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Mean Score</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Mean Grade</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Pass Rate</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Candidates</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Top Class</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subjectStats.map((item, i) => {
                const topClass = [...item.classBreakdown].sort((a,b) => b.mean - a.mean)[0];
                return (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          {i + 1}
                        </div>
                        <span className="text-sm font-black text-gray-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-center text-gray-700">{item.stats.meanScore.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-black text-center text-primary">{item.stats.meanGrade}</td>
                    <td className="px-6 py-4 text-center">
                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${item.stats.passRate >= 50 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            {item.stats.passRate.toFixed(1)}%
                        </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-center text-gray-500">{item.stats.totalCandidates}</td>
                    <td className="px-6 py-4 text-sm font-medium text-center text-gray-600">{topClass?.className || 'N/A'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {subjectStats.slice(0, 4).map((sub, i) => (
          <div key={sub.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">{sub.name} Breakdown</h4>
              <Award className={`h-5 w-5 ${i === 0 ? 'text-yellow-500' : 'text-gray-300'}`} />
            </div>
            <div className="space-y-4">
               {sub.classBreakdown.map(cls => (
                 <div key={cls.className} className="space-y-1">
                   <div className="flex justify-between text-xs font-bold">
                     <span className="text-gray-500">{cls.className}</span>
                     <span className="text-gray-900">{cls.mean.toFixed(2)} Mean</span>
                   </div>
                   <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                     <div 
                       className="h-full bg-school-gradient rounded-full" 
                       style={{ width: `${(cls.mean / (session.maximumScore || 100)) * 100}%` }}
                     />
                   </div>
                 </div>
               ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
