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
import { Class, Student, ExamSession, Subject, ExamResult } from '../../types';
import ResultsSlip from '../../components/ResultsSlip';

export default function MarksEntry({ teacher }: { teacher: any }) {
  // Selection States
  const [classes, setClasses] = useState<Class[]>([]);
  const [examSessions, setExamSessions] = useState<ExamSession[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedExamSessionId, setSelectedExamSessionId] = useState('');
  const [selectedExamsCategory, setSelectedExamsCategory] = useState<'Openar Exams' | 'Midterm Exams' | 'End Term Exams' | ''>('');
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

    const classesQ = query(collection(db, 'schools', teacher.schoolId, 'classes'));
    const sessionsQ = query(collection(db, 'exam_sessions'), where('schoolId', '==', teacher.schoolId));

    const unsubClasses = onSnapshot(classesQ, (snap) => setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class))));
    const unsubSessions = onSnapshot(sessionsQ, (snap) => setExamSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamSession))));

    return () => {
      unsubClasses();
      unsubSessions();
    };
  }, [teacher?.schoolId]);

  // Load Mark Entry
  const handleLoadEntry = () => {
    if (!selectedClassId || !selectedExamSessionId || !selectedExamsCategory || !selectedTerm || !selectedAcademicYear) {
      toast.error('Please select all fields');
      return;
    }
    setLoadingStudents(true);
    setIsEntryLoaded(true);
    
    const q = query(
      collection(db, 'schools', teacher.schoolId, 'students'), 
      where('classId', '==', selectedClassId),
      where('status', '==', 'active')
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      const studentData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      }) as Student).sort((a, b) => a.fullName.localeCompare(b.fullName));
      setStudents(studentData);
      setLoadingStudents(false);
    });
    
    return () => unsub();
  };

  const filteredStudents = students.filter(s => 
    s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Selection Panel */}
      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8 sticky top-24 z-20">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6 items-end">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Select Class</label>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700 cursor-pointer">
              <option value="">-- Choose Class --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Exam Type</label>
            <select value={selectedExamSessionId} onChange={(e) => setSelectedExamSessionId(e.target.value)} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700 cursor-pointer">
              <option value="">-- Choose Exam --</option>
              {examSessions.map(s => <option key={s.id} value={s.id}>{s.examName}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Exams Category</label>
            <select value={selectedExamsCategory} onChange={(e) => setSelectedExamsCategory(e.target.value as any)} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700 cursor-pointer">
              <option value="">-- Choose Category --</option>
              <option value="Openar Exams">Openar Exams</option>
              <option value="Midterm Exams">Midterm Exams</option>
              <option value="End Term Exams">End Term Exams</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Term</label>
            <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700 cursor-pointer">
              <option value="">-- Choose Term --</option>
              <option value="Term 1">Term 1</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 3">Term 3</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Academic Year</label>
            <select value={selectedAcademicYear} onChange={(e) => setSelectedAcademicYear(e.target.value)} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700 cursor-pointer">
              {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 1 + i).toString()).map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <button onClick={handleLoadEntry} className="w-full py-3.5 bg-maroon text-white font-black rounded-2xl shadow-xl shadow-maroon/20 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-wider text-sm">
            Load Mark Entry
          </button>
        </div>
      </div>

      {isEntryLoaded && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-gray-900">Learners in {classes.find(c => c.id === selectedClassId)?.name}</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input type="text" placeholder="Search learner..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-maroon/20" />
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">#</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Admission</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Name</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingStudents ? (
                  <tr><td colSpan={4} className="p-8 text-center text-gray-500"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></td></tr>
                ) : filteredStudents.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-gray-500">No learners found</td></tr>
                ) : (
                  filteredStudents.map((student, idx) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-bold text-gray-900">{idx + 1}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{student.admissionNumber}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{student.fullName}</td>
                      <td className="px-6 py-4 flex items-center gap-2">
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
  const [marks, setMarks] = useState<Record<string, number | ''>>({});
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSubjectsAndMarks = async () => {
      setLoadingSubjects(true);
      // 1. Get ClassSubjects for this class
      const csQ = query(collection(db, 'class_subjects'), where('classId', '==', student.classId));
      const csSnap = await getDocs(csQ);
      const subjectIds = csSnap.docs.map(d => d.data().subjectId);
      
      // 2. Get actual Subjects
      if (subjectIds.length > 0) {
        const allSubjectsSnap = await getDocs(query(collection(db, 'subjects'), where('schoolId', '==', teacher.schoolId)));
        const filteredSubjects = allSubjectsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Subject))
          .filter(s => subjectIds.includes(s.id));
        setSubjects(filteredSubjects);

        // 3. Fetch existing marks
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
      setLoadingSubjects(false);
    };
    fetchSubjectsAndMarks();
  }, [student.classId, student.id, selectedExamSessionId, teacher.schoolId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert marks
      for (const [subjectId, score] of Object.entries(marks)) {
        if (score === '') continue;
        const markData = {
          schoolId: teacher.schoolId,
          studentId: student.id,
          classId: student.classId,
          subjectId,
          examSessionId: selectedExamSessionId,
          examsCategory: selectedExamsCategory,
          scoreObtained: Number(score),
          maximumScore: 100, // Should be fetched from session
          academicYear: selectedAcademicYear,
          term: selectedTerm,
          updatedAt: new Date().toISOString()
        };
        
        // Use a composite key or query to check for existing record
        const q = query(collection(db, 'exam_results'), 
          where('studentId', '==', student.id),
          where('subjectId', '==', subjectId),
          where('examSessionId', '==', selectedExamSessionId)
        );
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          await setDoc(doc(db, 'exam_results', snap.docs[0].id), markData, { merge: true });
        } else {
          await setDoc(doc(collection(db, 'exam_results')), { ...markData, createdAt: new Date().toISOString() });
        }
      }
      toast.success('Marks saved successfully');
      onClose();
    } catch (e) {
      toast.error('Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black">Enter Marks for {student.fullName}</h2>
          <button onClick={onClose}><X className="h-6 w-6" /></button>
        </div>
        
        {loadingSubjects ? <Loader2 className="animate-spin mx-auto" /> : (
          <div className="space-y-4">
            {subjects.map(s => (
              <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="font-bold">{s.name}</span>
                <input 
                  type="number" 
                  className="w-24 p-2 border rounded-lg"
                  placeholder="0"
                  value={marks[s.id] || ''}
                  onChange={(e) => setMarks(prev => ({ ...prev, [s.id]: Number(e.target.value) }))}
                />
              </div>
            ))}
            <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-maroon text-white font-black rounded-xl">
              {saving ? 'Saving...' : 'Save Marks'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
