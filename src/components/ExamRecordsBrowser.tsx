import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Class, Student, ExamSession, Stream, ExamResult } from '../types';
import { Loader2, Search, Eye, Download, Printer } from 'lucide-react';
import ResultsSlip from './ResultsSlip';

interface ExamRecordsBrowserProps {
  schoolId: string;
  examsCategory: 'Openar Exams' | 'Midterm Exams' | 'End Term Exams';
}

interface GroupedRecord {
  student: Student;
  term: string;
  academicYear: string;
  examSessionId: string;
  examName: string;
}

export default function ExamRecordsBrowser({ schoolId, examsCategory }: ExamRecordsBrowserProps) {
  const [records, setRecords] = useState<GroupedRecord[]>([]);
  const [classes, setClasses] = useState<Record<string, Class>>({});
  const [streams, setStreams] = useState<Record<string, Stream>>({});
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [viewingStudent, setViewingStudent] = useState<{ student: Student, action: 'view' | 'download' | 'print', sessionId: string } | null>(null);

  useEffect(() => {
    if (!schoolId) return;

    const loadRecords = async () => {
      setLoading(true);
      try {
        // 1. Fetch all results for this category
        // Fallback to examType for backward compatibility
        const resultsQ = query(collection(db, 'exam_results'), where('schoolId', '==', schoolId));
        const resultsSnap = await getDocs(resultsQ);
        
        const categoryResults = resultsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as ExamResult))
          .filter(r => {
            if (r.examsCategory === examsCategory) return true;
            if (examsCategory === 'Openar Exams' && (r.examType === 'Openar' || r.examType === 'Opener')) return true;
            if (examsCategory === 'Midterm Exams' && r.examType === 'Midterm') return true;
            if (examsCategory === 'End Term Exams' && r.examType === 'End Term') return true;
            return false;
          });

        if (categoryResults.length === 0) {
          setRecords([]);
          setLoading(false);
          return;
        }

        // 2. Group by studentId + examSessionId
        const groupedMap = new Map<string, { studentId: string, term: string, academicYear: string, examSessionId: string }>();
        
        categoryResults.forEach(r => {
          const key = `${r.studentId}_${r.examSessionId}`;
          if (!groupedMap.has(key)) {
            groupedMap.set(key, {
              studentId: r.studentId,
              term: r.term as string,
              academicYear: r.academicYear,
              examSessionId: r.examSessionId
            });
          }
        });

        // 3. Fetch related data
        const studentIds = Array.from(new Set(Array.from(groupedMap.values()).map(g => g.studentId)));
        const sessionIds = Array.from(new Set(Array.from(groupedMap.values()).map(g => g.examSessionId)));
        
        // Fetch students (chunked if necessary, but we'll fetch all for school for simplicity)
        const studentsSnap = await getDocs(query(collection(db, 'schools', schoolId, 'students')));
        const studentsMap = new Map(studentsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as Student]));

        // Fetch sessions
        const sessionsSnap = await getDocs(query(collection(db, 'exam_sessions'), where('schoolId', '==', schoolId)));
        const sessionsMap = new Map(sessionsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as ExamSession]));

        // Fetch classes & streams for display
        const classesSnap = await getDocs(query(collection(db, 'schools', schoolId, 'classes')));
        const classesData: Record<string, Class> = {};
        classesSnap.docs.forEach(d => classesData[d.id] = { id: d.id, ...d.data() } as Class);
        setClasses(classesData);

        const streamsSnap = await getDocs(query(collection(db, 'schools', schoolId, 'streams')));
        const streamsData: Record<string, Stream> = {};
        streamsSnap.docs.forEach(d => streamsData[d.id] = { id: d.id, ...d.data() } as Stream);
        setStreams(streamsData);

        // 4. Build final records
        const finalRecords: GroupedRecord[] = [];
        groupedMap.forEach(g => {
          const student = studentsMap.get(g.studentId);
          const session = sessionsMap.get(g.examSessionId);
          if (student && session) {
            finalRecords.push({
              student,
              term: g.term,
              academicYear: g.academicYear,
              examSessionId: g.examSessionId,
              examName: session.examName
            });
          }
        });

        // Sort by academic year desc, term desc, student name
        finalRecords.sort((a, b) => {
          if (a.academicYear !== b.academicYear) return b.academicYear.localeCompare(a.academicYear);
          if (a.term !== b.term) return b.term.localeCompare(a.term);
          return a.student.fullName.localeCompare(b.student.fullName);
        });

        setRecords(finalRecords);
      } catch (error) {
        console.error("Error loading records:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, [schoolId, examsCategory]);

  const filteredRecords = records.filter(r => 
    r.student.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.student.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.examName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : records.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-gray-900">Stored {examsCategory} Records</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Search learner or exam..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg outline-none text-sm w-64" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Admission</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Name</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Class</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Stream</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Term</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Year</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Exam Type</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRecords.map((record) => {
                  const studentClass = classes[record.student.classId];
                  const studentStream = streams[record.student.streamId || ''];

                  return (
                    <tr key={`${record.student.id}_${record.examSessionId}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-bold text-gray-900">{record.student.admissionNumber}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{record.student.fullName}</td>
                      <td className="px-6 py-4 text-gray-600">{studentClass?.name || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{studentStream?.name || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{record.term}</td>
                      <td className="px-6 py-4 text-gray-600">{record.academicYear}</td>
                      <td className="px-6 py-4 text-gray-600">{record.examName}</td>
                      <td className="px-6 py-4 flex items-center gap-2">
                        <button onClick={() => setViewingStudent({ student: record.student, action: 'view', sessionId: record.examSessionId })} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Slip">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => setViewingStudent({ student: record.student, action: 'download', sessionId: record.examSessionId })} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Download Slip">
                          <Download className="h-4 w-4" />
                        </button>
                        <button onClick={() => setViewingStudent({ student: record.student, action: 'print', sessionId: record.examSessionId })} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Print Slip">
                          <Printer className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500 font-medium">No records found for {examsCategory}.</p>
        </div>
      )}

      {viewingStudent && (
        <ResultsSlip 
          student={viewingStudent.student} 
          examSessionId={viewingStudent.sessionId} 
          schoolId={schoolId}
          initialAction={viewingStudent.action}
          onClose={() => setViewingStudent(null)} 
        />
      )}
    </div>
  );
}
