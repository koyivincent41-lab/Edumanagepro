import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  Loader2, 
  Save, 
  Search, 
  ChevronDown,
  Users,
  BookOpen,
  Edit2,
  X,
  CheckCircle,
  AlertCircle,
  Eye,
  Download,
  Printer
} from 'lucide-react';
import { collection, query, where, onSnapshot, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Class, Student, ExamSession, Subject, ExamResult, GradingSystem } from '../../types';
import ResultsSlip from '../../components/ResultsSlip';

export default function MarksEntry({ teacher }: { teacher: any }) {
  // Selection States
  const [classes, setClasses] = useState<Class[]>([]);
  const [examSessions, setExamSessions] = useState<ExamSession[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedExamSessionId, setSelectedExamSessionId] = useState('');
  const [selectedExamsCategory, setSelectedExamsCategory] = useState<'Opener Exams' | 'Openar Exams' | 'Midterm Exams' | 'End Term Exams' | ''>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(teacher.academicYear || '2026');
  
  // Loading States
  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isEntryLoaded, setIsEntryLoaded] = useState(false);
  
  // Data States
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<{ student: Student, action: 'view' | 'download' | 'print' } | null>(null);

  // Fetch initial data
  useEffect(() => {
    if (!teacher?.schoolId) return;

    const fetchData = async () => {
      try {
        const classesQ = query(collection(db, 'schools', teacher.schoolId, 'classes'));
        const sessionsQ = query(collection(db, 'exam_sessions'), where('schoolId', '==', teacher.schoolId));

        const [classesSnap, sessionsSnap] = await Promise.all([
          getDocs(classesQ),
          getDocs(sessionsQ)
        ]);

        setClasses(classesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
        setExamSessions(sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamSession)));
      } catch (err) {
        console.error("Error fetching initial mark entry config:", err);
      }
    };

    fetchData();
  }, [teacher?.schoolId]);

  // Load Mark Entry
  const handleLoadEntry = async () => {
    if (!selectedClassId || !selectedExamSessionId || !selectedExamsCategory || !selectedTerm || !selectedAcademicYear) {
      toast.error('Please select all fields');
      return;
    }
    setLoadingStudents(true);
    setIsEntryLoaded(true);
    
    try {
      const q = query(
        collection(db, 'schools', teacher.schoolId, 'students'), 
        where('classId', '==', selectedClassId),
        where('status', '==', 'active')
      );
      
      const snapshot = await getDocs(q);
      const studentData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      }) as Student).sort((a, b) => a.fullName.localeCompare(b.fullName));
      setStudents(studentData);
    } catch (err) {
      console.error("Error loading students for marks entry:", err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Selection Panel */}
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-4 md:p-8 md:sticky md:top-24 z-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4 md:gap-6 items-end">
          <div className="space-y-1.5 md:space-y-2 col-span-2 lg:col-span-1">
            <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Select Class</label>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="w-full p-2.5 md:p-3.5 bg-gray-50 border border-gray-200 rounded-xl md:rounded-2xl text-xs md:text-sm focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700 cursor-pointer">
              <option value="">-- Choose Class --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 md:space-y-2 col-span-2 lg:col-span-1">
            <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Exam Type</label>
            <select value={selectedExamSessionId} onChange={(e) => setSelectedExamSessionId(e.target.value)} className="w-full p-2.5 md:p-3.5 bg-gray-50 border border-gray-200 rounded-xl md:rounded-2xl text-xs md:text-sm focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700 cursor-pointer">
              <option value="">-- Choose Exam --</option>
              {examSessions.map(s => <option key={s.id} value={s.id}>{s.examName}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 md:space-y-2 col-span-2 lg:col-span-1">
            <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Exams Category</label>
            <select value={selectedExamsCategory} onChange={(e) => setSelectedExamsCategory(e.target.value as any)} className="w-full p-2.5 md:p-3.5 bg-gray-50 border border-gray-200 rounded-xl md:rounded-2xl text-xs md:text-sm focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700 cursor-pointer">
              <option value="">-- Choose Category --</option>
              <option value="Opener Exams">Opener Exams</option>
              <option value="Midterm Exams">Midterm Exams</option>
              <option value="End Term Exams">End Term Exams</option>
            </select>
          </div>
          <div className="space-y-1.5 md:space-y-2">
            <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Term</label>
            <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="w-full p-2.5 md:p-3.5 bg-gray-50 border border-gray-200 rounded-xl md:rounded-2xl text-xs md:text-sm focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700 cursor-pointer">
              <option value="">-- Choose Term --</option>
              <option value="Term 1">Term 1</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 3">Term 3</option>
            </select>
          </div>
          <div className="space-y-1.5 md:space-y-2">
            <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Acad. Year</label>
            <select value={selectedAcademicYear} onChange={(e) => setSelectedAcademicYear(e.target.value)} className="w-full p-2.5 md:p-3.5 bg-gray-50 border border-gray-200 rounded-xl md:rounded-2xl text-xs md:text-sm focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700 cursor-pointer">
              {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 1 + i).toString()).map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <button onClick={handleLoadEntry} className="col-span-2 lg:col-span-1 w-full py-2.5 md:py-3.5 bg-maroon text-white font-black rounded-xl md:rounded-2xl shadow-xl shadow-maroon/20 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-wider text-[10px] md:text-sm">
            Load Marks
          </button>
        </div>
      </div>

      {isEntryLoaded && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
            <h3 className="text-xl font-black text-gray-900">Learners in {classes.find(c => c.id === selectedClassId)?.name}</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input type="text" placeholder="Search learner..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-maroon/20" />
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">#</th>
                  <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Admission</th>
                  <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Name</th>
                  <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingStudents ? (
                  <tr><td colSpan={4} className="p-4 md:p-8 text-center text-gray-500"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></td></tr>
                ) : filteredStudents.length === 0 ? (
                  <tr><td colSpan={4} className="p-4 md:p-8 text-center text-gray-500">No learners found</td></tr>
                ) : (
                  filteredStudents.map((student, idx) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-900">{idx + 1}</td>
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-900">{student.admissionNumber}</td>
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-900">{student.fullName}</td>
                      <td className="px-4 md:px-6 py-4 flex items-center gap-2">
                        <button onClick={() => setEditingStudent(student)} className="p-2 text-maroon hover:bg-maroon/10 rounded-lg transition-colors" title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setViewingStudent({ student, action: 'view' })} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => setViewingStudent({ student, action: 'download' })} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Download">
                          <Download className="h-4 w-4" />
                        </button>
                        <button onClick={() => setViewingStudent({ student, action: 'print' })} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Print">
                          <Printer className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {editingStudent && (
        <EditLearnerModal 
          student={editingStudent} 
          onClose={() => setEditingStudent(null)} 
          teacher={teacher}
          selectedExamSessionId={selectedExamSessionId}
          selectedExamsCategory={selectedExamsCategory}
          selectedAcademicYear={selectedAcademicYear}
          selectedTerm={selectedTerm}
        />
      )}
      {/* Results Slip Modal */}
      {viewingStudent && (
        <ResultsSlip 
          student={viewingStudent.student} 
          examSessionId={selectedExamSessionId} 
          schoolId={teacher.schoolId}
          initialAction={viewingStudent.action}
          onClose={() => setViewingStudent(null)} 
        />
      )}
    </div>
  );
}

// Edit Modal Component
const EditLearnerModal = ({ student, onClose, teacher, selectedExamSessionId, selectedExamsCategory, selectedAcademicYear, selectedTerm }: { student: Student, onClose: () => void, teacher: any, selectedExamSessionId: string, selectedExamsCategory: string, selectedAcademicYear: string, selectedTerm: string }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [gradingSystem, setGradingSystem] = useState<GradingSystem | null>(null);
  const [marks, setMarks] = useState<Record<string, number | ''>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        // 1. Fetch Grading System
        const gradingQ = query(collection(db, 'grading_systems'), where('schoolId', '==', teacher.schoolId));
        const gradingSnap = await getDocs(gradingQ);
        if (!gradingSnap.empty) {
          setGradingSystem({ id: gradingSnap.docs[0].id, ...gradingSnap.docs[0].data() } as GradingSystem);
        }

        // 2. Get ClassSubjects for this class
        const csQ = query(collection(db, 'class_subjects'), where('classId', '==', student.classId));
        const csSnap = await getDocs(csQ);
        const subjectIds = csSnap.docs.map(d => d.data().subjectId);
        
        if (subjectIds.length > 0) {
          // 3. Get actual Subjects
          const allSubjectsSnap = await getDocs(query(collection(db, 'subjects'), where('schoolId', '==', teacher.schoolId)));
          const filteredSubjects = allSubjectsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Subject))
            .filter(s => subjectIds.includes(s.id))
            .sort((a, b) => a.name.localeCompare(b.name));
          setSubjects(filteredSubjects);

          // 4. Fetch existing marks for this session
          const marksQ = query(collection(db, 'exam_results'),
            where('studentId', '==', student.id),
            where('examSessionId', '==', selectedExamSessionId)
          );
          const marksSnap = await getDocs(marksQ);
          const existingMarks: Record<string, number | ''> = {};
          marksSnap.docs.forEach(d => {
            const data = d.data();
            existingMarks[data.subjectId] = data.scoreObtained;
          });
          setMarks(existingMarks);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load subjects or marks');
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [student.classId, student.id, selectedExamSessionId, teacher.schoolId]);

  const getGrade = (score: number | '') => {
    if (score === '' || isNaN(Number(score))) return '-';
    if (!gradingSystem || !gradingSystem.bands) return '-';
    const s = Math.round(Number(score));
    const band = gradingSystem.bands.find(b => s >= b.minScore && s <= b.maxScore);
    return band ? band.gradeName : '-';
  };

  const handleMarkChange = (subjectId: string, value: string) => {
    const num = value === '' ? '' : Number(value);
    if (num !== '' && (num < 0 || num > 100)) {
      toast.error('Marks must be between 0 and 100');
      return;
    }
    setMarks(prev => ({ ...prev, [subjectId]: num }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert marks
      for (const subject of subjects) {
        const score = marks[subject.id];
        if (score === '' || score === undefined) continue;

        const grade = getGrade(score);
        
        const markData = {
          schoolId: teacher.schoolId,
          branchId: teacher.branchId || null,
          studentId: student.id,
          classId: student.classId,
          subjectId: subject.id,
          examSessionId: selectedExamSessionId,
          examsCategory: selectedExamsCategory,
          scoreObtained: Number(score),
          maximumScore: 100,
          gradeGenerated: grade,
          academicYear: selectedAcademicYear,
          term: selectedTerm,
          updatedAt: new Date().toISOString()
        };
        
        const q = query(collection(db, 'exam_results'), 
          where('studentId', '==', student.id),
          where('subjectId', '==', subject.id),
          where('examSessionId', '==', selectedExamSessionId)
        );
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          await setDoc(doc(db, 'exam_results', snap.docs[0].id), markData, { merge: true });
        } else {
          await setDoc(doc(collection(db, 'exam_results')), { 
            ...markData, 
            createdAt: new Date().toISOString() 
          });
        }
      }
      toast.success('Marks saved successfully');
      onClose();
    } catch (e) {
      console.error('Error saving marks:', e);
      toast.error('Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl md:rounded-[2.5rem] shadow-2xl w-[calc(100%-2rem)] md:w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
        <div className="p-4 md:p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-lg md:text-xl md:text-2xl font-black text-gray-900 leading-none">Enter Marks</h2>
            <p className="text-xs md:text-sm text-gray-500 mt-1 md:mt-2 font-medium">Student: <span className="text-maroon font-black uppercase tracking-tight">{student.fullName}</span></p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 md:p-3 hover:bg-white rounded-xl md:rounded-2xl text-gray-400 hover:text-gray-900 transition-all shadow-sm border border-transparent hover:border-gray-200"
          >
            <X className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 md:p-4 md:p-8">
          {loadingData ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-12 w-12 text-maroon animate-spin" />
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Subjects & Marks...</p>
            </div>
          ) : subjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="bg-gray-50 p-4 md:p-6 rounded-3xl mb-4">
                <AlertCircle className="h-12 w-12 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">No Subjects Found</h3>
              <p className="text-gray-500 max-w-xs mt-2">There are no subjects linked to this class. Please assign subjects first.</p>
            </div>
          ) : (
            <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm overflow-x-auto">
              <table className="w-full min-w-[500px] text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 md:px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject</th>
                    <th className="px-4 md:px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Max Mark</th>
                    <th className="px-4 md:px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Marks Obtained</th>
                    <th className="px-4 md:px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {subjects.map(subject => {
                    const currentMarks = marks[subject.id];
                    const grade = getGrade(currentMarks);

                    return (
                      <tr key={subject.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-4 md:px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-maroon/5 rounded-lg flex items-center justify-center text-maroon font-bold text-xs">
                              {subject.code || subject.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-bold text-gray-900">{subject.name}</span>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-4 text-center">
                          <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-500 text-xs font-black rounded-lg">
                            100
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          <div className="relative max-w-[120px]">
                            <input 
                              type="number" 
                              min="0"
                              max="100"
                              className="w-full pl-4 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-maroon/5 focus:border-maroon transition-all font-black text-black dark:text-black"
                              placeholder="0"
                              value={currentMarks ?? ''}
                              onChange={(e) => handleMarkChange(subject.id, e.target.value)}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300">/ 100</span>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-4 text-center">
                          <div className={`inline-flex items-center px-4 py-2 rounded-xl font-black text-sm shadow-sm transition-all ${
                            grade === '-' ? 'bg-gray-100 text-gray-400' : 
                            ['A','B'].some(g => grade.startsWith(g)) ? 'bg-green-50 text-green-600' :
                            ['C'].some(g => grade.startsWith(g)) ? 'bg-blue-50 text-blue-600' :
                            ['D'].some(g => grade.startsWith(g)) ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {grade}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-4 md:p-8 bg-gray-50 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-auto flex items-center gap-2 md:gap-3 text-amber-600 bg-amber-50 px-3 md:px-4 py-2 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-amber-100 justify-center">
            <AlertCircle className="h-3 w-3 md:h-4 md:w-4" />
            Validate marks before saving
          </div>
          <div className="w-full md:w-auto flex items-center gap-2 md:gap-4 justify-between">
            <button 
              onClick={onClose}
              className="px-4 md:px-4 md:px-6 py-2.5 md:py-3 text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              disabled={saving || subjects.length === 0} 
              className="flex items-center justify-center gap-2 px-4 md:px-6 md:px-10 py-3 md:py-4 bg-maroon text-white font-black rounded-xl md:rounded-2xl shadow-xl shadow-maroon/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 transition-all uppercase tracking-widest text-[10px] md:text-xs flex-1 md:flex-none"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save All Marks
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
