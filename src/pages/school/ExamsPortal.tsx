import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { School } from '../../types';
import ExamsDashboard from './Exams/ExamsDashboard';
import ExamSessions from './Exams/ExamSessions';
import ExamResults from './Exams/ExamResults';
import Subjects from './Exams/Subjects';
import ExamAccessControl from './Exams/ExamAccessControl';
import MarkList from './Exams/MarkList';

export default function ExamsPortal({ schoolId, school }: { schoolId: string, school: School | null }) {
  return (
    <Routes>
      <Route path="/" element={<ExamsDashboard schoolId={schoolId} school={school} />} />
      <Route path="/sessions" element={<ExamSessions schoolId={schoolId} school={school} />} />
      <Route path="/results" element={<ExamResults schoolId={schoolId} school={school} />} />
      <Route path="/subjects" element={<Subjects schoolId={schoolId} school={school} />} />
      <Route path="/marklist" element={<MarkList schoolId={schoolId} school={school} />} />
      <Route path="/access-control" element={<ExamAccessControl schoolId={schoolId} />} />
      <Route path="*" element={<Navigate to="/dashboard/exams" replace />} />
    </Routes>
  );
}
