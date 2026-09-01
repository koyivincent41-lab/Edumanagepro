import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Class, Student, ExamSession, Stream, ExamResult } from '../types';
import { Loader2, Search, Eye, Download, Printer, Lock } from 'lucide-react';
import ResultsSlip from './ResultsSlip';
import { useExamAccess } from '../hooks/useExamAccess';

interface ParentExamRecordsBrowserProps {
  schoolId: string;
  parentId: string;
  examsCategory: 'Opener Exams' | 'Openar Exams' | 'Midterm Exams' | 'End Term Exams';
}

interface GroupedRecord {
  student: Student;
  term: string;
  academicYear: string;
  examSessionId: string;
  examName: string;
}

export default function ParentExamRecordsBrowser({ schoolId, parentId, examsCategory }: ParentExamRecordsBrowserProps) {
  const [records, setRecords] = useState<GroupedRecord[]>([]);
  const [classes, setClasses] = useState<Record<string, Class>>({});
  const [streams, setStreams] = useState<Record<string, Stream>>({});
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [viewingStudent, setViewingStudent] = useState<{ student: Student, action: 'view' | 'download' | 'print', sessionId: string } | null>(null);

  const { loadingAccess, checkAccess } = useExamAccess(schoolId, parentId);

  useEffect(() => {
    if (!schoolId || !parentId) return;

    const loadRecords = async () => {
      setLoading(true);
      try {
        // 0. Fetch parent's children
        const myKidsQ = query(collection(db, 'schools', schoolId, 'students'), where('parentId', '==', parentId));
        const myKidsSnap = await getDocs(myKidsQ);
        if (myKidsSnap.empty) {
          setRecords([]);
          setLoading(false);
          return;
        }
        
        const myKidsMap = new Map(myKidsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as Student]));
        const myKidsIds = Array.from(myKidsMap.keys());

        // 1. Fetch exam sessions for this category
        const sessionsSnap = await getDocs(query(collection(db, 'exam_sessions'), where('schoolId', '==', schoolId)));
        const sessionsData = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamSession));
        
        const relevantSessions = sessionsData.filter(session => {
          if ((examsCategory === 'Openar Exams' || examsCategory === 'Opener Exams') && (session.examType === 'Openar' || session.examType === 'Opener')) return true;
          if (examsCategory === 'Midterm Exams' && session.examType === 'Midterm') return true;
          if (examsCategory === 'End Term Exams' && session.examType === 'End Term') return true;
          return false;
        });

        if (relevantSessions.length === 0) {
          setRecords([]);
          setLoading(false);
          return;
        }

        const validSessionIds = relevantSessions.map(s => s.id);
        const sessionsMap = new Map(relevantSessions.map(s => [s.id, s]));

        // 2. Fetch results for my kids
        const resultsQ = query(collection(db, 'exam_results'), where('schoolId', '==', schoolId));
        const resultsSnap = await getDocs(resultsQ);
        
        const categoryResults = resultsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as ExamResult))
          .filter(r => {
            return myKidsIds.includes(r.studentId) && validSessionIds.includes(r.examSessionId);
          });

        if (categoryResults.length === 0) {
          setRecords([]);
          setLoading(false);
          return;
        }

        // 3. Group by studentId + examSessionId
        const groupedMap = new Map<string, { studentId: string, term: string, academicYear: string, examSessionId: string }>();
        
        categoryResults.forEach(r => {
          const key = `${r.studentId}_${r.examSessionId}`;
          if (!groupedMap.has(key)) {
            const session = sessionsMap.get(r.examSessionId);
            groupedMap.set(key, {
              studentId: r.studentId,
              term: session?.term || r.term as string,
              academicYear: session?.academicYear || r.academicYear,
              examSessionId: r.examSessionId
            });
          }
        });

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
          const student = myKidsMap.get(g.studentId);
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
  }, [schoolId, parentId, examsCategory]);

  const filteredRecords = records.filter(r => 
    r.student.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.student.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.examName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayCategory = (examsCategory === 'Openar Exams' || examsCategory === 'Opener Exams') ? 'Opener Exams' : examsCategory;

  return (
    <div className="space-y-6">
      {(loading || loadingAccess) ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : records.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
            <h3 className="text-lg font-black text-gray-900">Stored {displayCategory}</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Search learner or exam..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg outline-none text-sm w-full sm:w-64" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[700px] w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Admission</th>
                    <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Name</th>
                    <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Class</th>
                    <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Term</th>
                    <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Year</th>
                    <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Exam Type</th>
                    <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecords.map((record) => {
                    const studentClass = classes[record.student.classId];
                    const hasAccess = checkAccess(record.student.id, examsCategory);

                    return (
                      <tr key={`${record.student.id}_${record.examSessionId}`} className="hover:bg-gray-50">
                        <td className="px-4 md:px-6 py-4 font-bold text-gray-900">{record.student.admissionNumber}</td>
                        <td className="px-4 md:px-6 py-4 font-bold text-gray-900">{record.student.fullName}</td>
                        <td className="px-4 md:px-6 py-4 text-gray-600">{studentClass?.name || '-'}</td>
                        <td className="px-4 md:px-6 py-4 text-gray-600">{record.term}</td>
                        <td className="px-4 md:px-6 py-4 text-gray-600">{record.academicYear}</td>
                        <td className="px-4 md:px-6 py-4 text-gray-600">{record.examName}</td>
                        <td className="px-4 md:px-6 py-4 flex items-center gap-2">
                          {hasAccess ? (
                            <>
                              <button onClick={() => setViewingStudent({ student: record.student, action: 'view', sessionId: record.examSessionId })} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Slip">
                                <Eye className="h-5 w-5" />
                              </button>
                              <button onClick={() => setViewingStudent({ student: record.student, action: 'download', sessionId: record.examSessionId })} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Download Slip">
                                <Download className="h-5 w-5" />
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100" title="Examination results are currently unavailable. Please contact the school office for assistance.">
                              <Lock className="h-3.5 w-3.5" />
                              <span>Restricted</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500 font-medium">No records found for {displayCategory}.</p>
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
