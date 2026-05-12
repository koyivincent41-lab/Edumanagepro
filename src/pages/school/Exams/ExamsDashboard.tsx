import React, { useState, useEffect } from 'react';
import { School } from '../../../types';
import { Calendar, Award, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';

export default function ExamsDashboard({ schoolId, school }: { schoolId: string, school: School | null }) {
  const [examSessionsCount, setExamSessionsCount] = useState(0);
  const [reportCardsCount, setReportCardsCount] = useState(0);

  useEffect(() => {
    if (!schoolId || !school?.currentTerm || !school?.academicYear) {
      setExamSessionsCount(0);
      setReportCardsCount(0);
      return;
    }

    // Fetch Exam Sessions for current term and academic year
    const sessionsQ = query(
      collection(db, 'exam_sessions'),
      where('schoolId', '==', schoolId),
      where('term', '==', school.currentTerm),
      where('academicYear', '==', school.academicYear)
    );

    const unsubSessions = onSnapshot(sessionsQ, (snap) => {
      setExamSessionsCount(snap.size);
    });

    // Fetch Exam Results to count unique learners with generated report cards
    const resultsQ = query(
      collection(db, 'exam_results'),
      where('schoolId', '==', schoolId),
      where('term', '==', school.currentTerm),
      where('academicYear', '==', school.academicYear)
    );

    const unsubResults = onSnapshot(resultsQ, (snap) => {
      const uniqueStudents = new Set<string>();
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.studentId) {
          uniqueStudents.add(data.studentId);
        }
      });
      setReportCardsCount(uniqueStudents.size);
    });

    return () => {
      unsubSessions();
      unsubResults();
    };
  }, [schoolId, school?.currentTerm, school?.academicYear]);

  const stats = [
    { name: 'Exam Sessions', value: examSessionsCount.toString(), icon: Calendar, color: 'text-white', bg: 'bg-white/20', cardBg: 'bg-blue-600', link: '/dashboard/exams/sessions' },
    { name: 'Report Cards', value: reportCardsCount.toString(), icon: Award, color: 'text-white', bg: 'bg-white/20', cardBg: 'bg-orange-600', link: '/dashboard/exams/results' },
    { name: 'Access Control', value: 'Manage', icon: Lock, color: 'text-white', bg: 'bg-white/20', cardBg: 'bg-purple-600', link: '/dashboard/exams/access-control' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold text-white">Exams Portal</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Link key={stat.name} to={stat.link} className={`${stat.cardBg} p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{stat.name}</p>
                <p className="text-xl md:text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Exam Sessions</h2>
        <div className="text-center py-4 md:py-8 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No exam sessions found.</p>
          <Link to="/dashboard/exams/sessions" className="text-blue-600 hover:underline mt-2 inline-block">Create a new session</Link>
        </div>
      </div>
    </div>
  );
}
