import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../../firebase';
import { School, ExamSession, ExamResult, GradingSystem } from '../../../../../types';
import { calculateAcademicStats } from '../../../../../lib/academicUtils';
import { Loader2 } from 'lucide-react';

interface GradeDistributionProps {
  schoolId: string;
  school: School | null;
  session: ExamSession;
  gradingSystem: GradingSystem | null;
}

const COLORS = ['#800000', '#F27D26', '#FF4444', '#44BBFF', '#BB44FF', '#22CC88'];

export default function GradeDistribution({ schoolId, school, session, gradingSystem }: GradeDistributionProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.id) return;

    const fetchResults = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'exam_results'), where('examSessionId', '==', session.id));
        const snap = await getDocs(q);
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResult));
        
        const stats = calculateAcademicStats(results, gradingSystem);
        const dist = Object.entries(stats.gradeDistribution).map(([name, value]) => ({ name, value }));
        setData(dist.sort((a,b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error("Error fetching grade distribution:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [session.id, gradingSystem]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm h-[400px]">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6">Grade Share</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm h-[400px]">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6">Frequency Analysis</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#800000" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
