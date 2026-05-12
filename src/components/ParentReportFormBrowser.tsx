import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Class, Student, Stream } from '../types';
import { Loader2, Search, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import TermReportForm from './TermReportForm';

interface ParentReportFormBrowserProps {
  schoolId: string;
  parentId: string;
}

export default function ParentReportFormBrowser({ schoolId, parentId }: ParentReportFormBrowserProps) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(new Date().getFullYear().toString());
  
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [viewingStudent, setViewingStudent] = useState<{ student: Student, action: 'view' | 'download' } | null>(null);

  useEffect(() => {
    if (!schoolId) return;

    const classesQ = query(collection(db, 'schools', schoolId, 'classes'));
    const streamsQ = query(collection(db, 'schools', schoolId, 'streams'));

    const unsubClasses = onSnapshot(classesQ, (snap) => setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class))));
    const unsubStreams = onSnapshot(streamsQ, (snap) => setStreams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Stream))));

    return () => {
      unsubClasses();
      unsubStreams();
    };
  }, [schoolId]);

  const handleLoadRecords = async () => {
    if (!selectedTerm || !selectedAcademicYear) {
      toast.error('Please select academic year and term before viewing results.');
      return;
    }
    setLoading(true);

    try {
      // Fetch students for this parent
      const studentsQ = query(
        collection(db, 'schools', schoolId, 'students'),
        where('parentId', '==', parentId),
        where('status', '==', 'active')
      );
      const studentsSnap = await getDocs(studentsQ);
      const studentData = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      
      // Sort by name
      setStudents(studentData.sort((a, b) => a.fullName.localeCompare(b.fullName)));
    } catch (error) {
      console.error("Error loading students:", error);
      toast.error("Failed to load learners.");
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-end">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Term</label>
            <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold text-gray-700">
              <option value="">-- Choose Term --</option>
              <option value="Term 1">Term 1</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 3">Term 3</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Academic Year</label>
            <select value={selectedAcademicYear} onChange={(e) => setSelectedAcademicYear(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold text-gray-700">
              {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 1 + i).toString()).map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <button onClick={handleLoadRecords} className="w-full py-3 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors uppercase tracking-wider text-sm">
            View Results
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : students.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h3 className="text-lg font-black text-gray-900">Termly Reports</h3>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Search child..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg outline-none text-sm" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden text-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[500px] w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Admission</th>
                    <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Name</th>
                    <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Class</th>
                    <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStudents.map((student) => {
                    const studentClass = classes.find(c => c.id === student.classId);

                    return (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-4 md:px-6 py-4 font-bold text-gray-900">{student.admissionNumber}</td>
                        <td className="px-4 md:px-6 py-4 font-bold text-gray-900">{student.fullName}</td>
                        <td className="px-4 md:px-6 py-4 text-gray-600">{studentClass?.name || '-'}</td>
                        <td className="px-4 md:px-6 py-4 flex items-center gap-2">
                          <button onClick={() => setViewingStudent({ student, action: 'view' })} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Report Form">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={() => setViewingStudent({ student, action: 'download' })} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Download Report Form">
                            <Download className="h-4 w-4" />
                          </button>
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
          <p className="text-gray-500 font-medium">Select term and academic year, then click View Results to load report forms.</p>
        </div>
      )}

      {viewingStudent && (
        <TermReportForm 
          student={viewingStudent.student} 
          term={selectedTerm}
          academicYear={selectedAcademicYear}
          schoolId={schoolId}
          initialAction={viewingStudent.action}
          onClose={() => setViewingStudent(null)} 
        />
      )}
    </div>
  );
}
