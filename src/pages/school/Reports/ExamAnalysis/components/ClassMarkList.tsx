import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  Printer, 
  Search, 
  ArrowUpDown, 
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../../firebase';
import { School, ExamSession, ExamResult, Class, Stream, Subject, GradingSystem, AcademicSettings, Student } from '../../../../../types';
import { getGradeFromScore } from '../../../../../lib/academicUtils';
import { exportToPDF, exportToExcel } from '../../../../../lib/reportUtils';
import { toast } from 'sonner';

interface ClassMarkListProps {
  schoolId: string;
  school: School | null;
  session: ExamSession;
  gradingSystem: GradingSystem | null;
  academicSettings: AcademicSettings | null;
  restrictedClassId?: string;
}

export default function ClassMarkList({ schoolId, school, session, gradingSystem, academicSettings, restrictedClassId }: ClassMarkListProps) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStreamId, setSelectedStreamId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'admission' | 'total' | 'rank'>('name');
  
  const [loading, setLoading] = useState(true);
  const [fetchingData, setFetchingData] = useState(false);

  useEffect(() => {
    if (!schoolId || !session?.id) return;

    // Fetch Classes
    const unsubClasses = onSnapshot(query(collection(db, 'schools', schoolId, 'classes')), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Class));
      if (restrictedClassId) {
        setClasses(data.filter(c => c.id === restrictedClassId));
        setSelectedClassId(restrictedClassId);
      } else {
        setClasses(data);
        if (data.length > 0 && !selectedClassId) setSelectedClassId(data[0].id);
      }
    });

    // Fetch Streams
    const unsubStreams = onSnapshot(query(collection(db, 'schools', schoolId, 'streams')), (snap) => {
      setStreams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Stream)));
    });

    // Fetch Subjects (Only applicable ones for the session)
    const unsubSubjects = onSnapshot(query(collection(db, 'subjects'), where('schoolId', '==', schoolId)), (snap) => {
      const allSubjects = snap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));
      const applicable = allSubjects.filter(s => session.applicableSubjects.includes(s.id));
      setSubjects(applicable);
      setLoading(false);
    });

    return () => {
      unsubClasses();
      unsubStreams();
      unsubSubjects();
    };
  }, [schoolId, session.id]);

  useEffect(() => {
    if (!selectedClassId || !session?.id || !schoolId) return;

    const fetchData = async () => {
      setFetchingData(true);
      try {
        // Fetch Students in class/stream
        let studentsQ = query(
          collection(db, 'schools', schoolId, 'students'),
          where('classId', '==', selectedClassId),
          where('status', '==', 'active')
        );
        if (selectedStreamId !== 'all') {
            studentsQ = query(studentsQ, where('streamId', '==', selectedStreamId));
        }
        const studentsSnap = await getDocs(studentsQ);
        const studentsData = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        setStudents(studentsData);

        // Fetch Results for this session and this class
        const resultsQ = query(
          collection(db, 'exam_results'),
          where('examSessionId', '==', session.id),
          where('classId', '==', selectedClassId)
        );
        const resultsSnap = await getDocs(resultsQ);
        setResults(resultsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResult)));

      } catch (error) {
        console.error("Error fetching mark list data:", error);
      } finally {
        setFetchingData(false);
      }
    };

    fetchData();
  }, [selectedClassId, selectedStreamId, session.id, schoolId]);

  const getMarkList = () => {
    const list = students.map(student => {
      const studentResults = results.filter(r => r.studentId === student.id);
      const subjectMarks: Record<string, number | '-'> = {};
      
      let total = 0;
      let count = 0;

      subjects.forEach(subject => {
        const result = studentResults.find(r => r.subjectId === subject.id);
        if (result) {
          subjectMarks[subject.id] = result.scoreObtained;
          total += result.scoreObtained;
          count++;
        } else {
          subjectMarks[subject.id] = '-';
        }
      });

      const average = count > 0 ? total / count : 0;
      const { grade, remarks } = getGradeFromScore(average, gradingSystem);

      return {
        id: student.id,
        admissionNumber: student.admissionNumber,
        fullName: student.fullName,
        gender: student.gender,
        subjectMarks,
        total,
        average,
        grade,
        remarks
      };
    });

    // Apply Ranking if enabled
    if (academicSettings?.enableRanking) {
        const key = academicSettings.rankingBasis === 'total' ? 'total' : 'average';
        list.sort((a, b) => b[key] - a[key]);
        list.forEach((item, index) => {
            let rank = index + 1;
            if (index > 0 && item[key] === list[index - 1][key]) {
                (item as any).rank = (list[index - 1] as any).rank;
            } else {
                (item as any).rank = rank;
            }
        });
    }

    // Apply Filtering
    let filtered = list.filter(item => 
      item.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'name') return a.fullName.localeCompare(b.fullName);
      if (sortBy === 'admission') return a.admissionNumber.localeCompare(b.admissionNumber);
      if (sortBy === 'total') return b.total - a.total;
      if (sortBy === 'rank' && academicSettings?.enableRanking) return (a as any).rank - (b as any).rank;
      return 0;
    });

    return filtered;
  };

  const markList = getMarkList();

  const handleExportPDF = async () => {
    if (markList.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['#', 'Adm No', 'Name', 'Gen', ...subjects.map(s => s.name), 'Total', 'Avg', 'Grade'];
    if (academicSettings?.enableRanking) headers.push('Rank');

    const data = markList.map((item, i) => [
      (i + 1).toString(),
      item.admissionNumber,
      item.fullName,
      item.gender?.charAt(0).toUpperCase() || '-',
      ...subjects.map(s => item.subjectMarks[s.id]?.toString() || '-'),
      item.total.toString(),
      item.average.toFixed(1) + '%',
      item.grade,
      ...(academicSettings?.enableRanking ? [(item as any).rank.toString()] : [])
    ]);

    const title = `Class Mark List - ${classes.find(c => c.id === selectedClassId)?.name || ''} - ${session.examName}`;
    await exportToPDF(title, headers, data, school, 'mark_list');
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={!!restrictedClassId}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:border-primary outline-none disabled:opacity-50"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Stream</label>
            <select
              value={selectedStreamId}
              onChange={(e) => setSelectedStreamId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:border-primary outline-none"
            >
              <option value="all">All Streams</option>
              {streams.filter(s => s.classId === selectedClassId).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:border-primary outline-none"
            >
              <option value="name">Name (A-Z)</option>
              <option value="admission">Admission No</option>
              <option value="total">Total Marks</option>
              {academicSettings?.enableRanking && <option value="rank">Position/Rank</option>}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Name or Admission #..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:border-primary outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
            <button 
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-all"
            >
                <Download className="h-4 w-4" /> Export PDF
            </button>
            <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all"
            >
                <Printer className="h-4 w-4" /> Print
            </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
        {fetchingData ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Loader2 className="animate-spin h-8 w-8 mb-2" />
            <p className="text-sm">Fetching mark list data...</p>
          </div>
        ) : markList.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-200 mb-4" />
            <h4 className="text-lg font-bold text-gray-900">No Data to Display</h4>
            <p className="text-sm text-gray-500 max-w-xs mx-auto mt-2">
              We couldn't find any student results for the selected class and examination session.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="sticky left-0 bg-gray-50 px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest z-10">Adm No</th>
                  <th className="sticky left-[80px] bg-gray-50 px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest z-10 border-r border-gray-100">Name</th>
                  {subjects.map(s => (
                    <th key={s.id} className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center min-w-[80px]">
                      {s.name}
                    </th>
                  ))}
                  <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Total</th>
                  <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Avg</th>
                  <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Grade</th>
                  {academicSettings?.enableRanking && (
                    <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Pos</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {markList.map((item, i) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="sticky left-0 bg-white group-hover:bg-gray-50 transition-colors px-4 py-4 text-xs font-mono font-bold text-gray-500 z-10">{item.admissionNumber}</td>
                    <td className="sticky left-[80px] bg-white group-hover:bg-gray-50 transition-colors px-4 py-4 text-xs font-black text-gray-900 border-r border-gray-100 z-10">{item.fullName}</td>
                    {subjects.map(s => {
                      const mark = item.subjectMarks[s.id];
                      const isLow = mark !== '-' && mark < (academicSettings?.passMark || 50);
                      return (
                        <td key={s.id} className={`px-4 py-4 text-xs font-bold text-center ${isLow ? 'text-red-500' : 'text-gray-600'}`}>
                          {mark}
                        </td>
                      );
                    })}
                    <td className="px-4 py-4 text-xs font-black text-gray-900 text-center">{item.total}</td>
                    <td className="px-4 py-4 text-xs font-bold text-gray-600 text-center">{item.average.toFixed(1)}%</td>
                    <td className="px-4 py-4 text-xs font-black text-primary text-center">{item.grade}</td>
                    {academicSettings?.enableRanking && (
                        <td className="px-4 py-4 text-xs font-black text-orange-600 text-center">
                            {(item as any).rank}
                        </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr className="font-bold">
                  <td colSpan={2} className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase text-right border-r border-gray-100">Subject Means</td>
                  {subjects.map(s => {
                    const subjectResults = results.filter(r => r.subjectId === s.id);
                    const mean = subjectResults.length > 0 ? subjectResults.reduce((sum, r) => sum + r.scoreObtained, 0) / subjectResults.length : 0;
                    return (
                        <td key={s.id} className="px-4 py-4 text-xs text-center text-primary">{mean.toFixed(1)}</td>
                    );
                  })}
                  <td colSpan={ academicSettings?.enableRanking ? 4 : 3 }></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
