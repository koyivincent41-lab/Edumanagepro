import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { School, Class, Student, Subject } from '../../types';
import { Loader2, AlertCircle, Download, FileText } from 'lucide-react';
import { exportToPDF } from '../../lib/reportUtils';
import { toast } from 'sonner';

interface TeacherClassMarkListProps {
  teacher: any;
}

export default function TeacherClassMarkList({ teacher }: TeacherClassMarkListProps) {
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<School | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [fetchingData, setFetchingData] = useState(false);

  useEffect(() => {
    if (!teacher?.schoolId) return;

    const fetchInitialData = async () => {
      try {
        const schoolDoc = await getDoc(doc(db, 'schools', teacher.schoolId));
        if (schoolDoc.exists()) {
          setSchool({ id: schoolDoc.id, ...schoolDoc.data() } as School);
        }

        const q = query(collection(db, 'schools', teacher.schoolId, 'classes'));
        const snap = await getDocs(q);
        const fetchedClasses = snap.docs.map(d => ({ id: d.id, ...d.data() } as Class));
        setClasses(fetchedClasses);
        
        if (fetchedClasses.length > 0) {
            // Default to their assigned class if it exists in the list, else the first class
            const assignedClass = fetchedClasses.find(c => c.id === teacher.classTeacherAssignment);
            setSelectedClassId(assignedClass ? assignedClass.id : fetchedClasses[0].id);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [teacher]);

  useEffect(() => {
    if (!selectedClassId || !teacher.schoolId) return;
    
    // Only fetch students if they are authorized
    if (selectedClassId !== teacher.classTeacherAssignment) {
      setStudents([]);
      setSubjects([]);
      return;
    }

    const fetchData = async () => {
      setFetchingData(true);
      try {
        const stuSnap = await getDocs(query(collection(db, 'schools', teacher.schoolId, 'students')));
        setStudents(stuSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student)).filter(s => s.classId === selectedClassId && s.status === 'active'));

        const subSnap = await getDocs(query(collection(db, 'schools', teacher.schoolId, 'subjects')));
        setSubjects(subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)).filter(s => s.status === 'active'));
      } catch (error) {
         console.error("Error fetching students:", error);
      } finally {
         setFetchingData(false);
      }
    };
    fetchData();
  }, [selectedClassId, teacher]);

  const handleExportPDF = async () => {
    if (students.length === 0) {
      toast.error('No learners found to export');
      return;
    }

    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass) return;

    const headers = ['#', 'Adm No', 'Name', 'Gender', ...subjects.map(s => s.code || s.name.substring(0,3).toUpperCase()), 'Total', 'Rank'];
    
    const data = students.sort((a,b) => a.fullName.localeCompare(b.fullName)).map((student, i) => [
      (i + 1).toString(),
      student.admissionNumber,
      student.fullName,
      student.gender?.charAt(0).toUpperCase() || '-',
      ...subjects.map(() => ''), // empty columns for marks
      '', // Total
      ''  // Rank
    ]);

    try {
      await exportToPDF(`${selectedClass.name} - Class Marklist Template`, headers, data, school, 'class_marklist_blank');
      toast.success('Mark list exported successfully');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export mark list');
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  const isAuthorized = selectedClassId === teacher.classTeacherAssignment;

  return (
    <div className="space-y-6">
       <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Select Class</h2>
          <p className="text-sm text-gray-500 font-medium">Choose a class to view and download the mark list.</p>
        </div>
        <div className="w-full md:w-64">
           <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
        </div>
      </div>

      {!isAuthorized ? (
        <div className="bg-red-50/50 border border-red-100 text-red-600 p-8 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-center">
          <div className="h-16 w-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-xl font-black">Access Denied</h3>
            <p className="mt-2 text-sm font-medium opacity-80 max-w-md mx-auto">
              You are not authorized to view the mark list for this class. You can only access the mark list for your assigned class.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
           <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Class Learners ({students.length})</h3>
              <button
                onClick={handleExportPDF}
                disabled={students.length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors text-sm font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export Marklist (PDF)
              </button>
            </div>

            {fetchingData ? (
                 <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
            ) : students.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                  <div className="h-16 w-16 bg-white text-gray-300 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <FileText className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">No Learners Found</h3>
                  <p className="text-gray-500 mt-1 font-medium">There are no continuous learners recorded in this class.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="min-w-full text-left border-collapse">
                    <thead className="bg-gray-50">
                    <tr>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">#</th>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Adm No</th>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</th>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Gen</th>
                        {subjects.map(s => (
                            <th key={s.id} className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center border-l border-gray-200">
                                {s.code || s.name.substring(0,3).toUpperCase()}
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody className="text-sm bg-white">
                    {students.sort((a,b) => a.fullName.localeCompare(b.fullName)).map((student, idx) => (
                        <tr key={student.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 text-gray-400 font-medium">{idx + 1}</td>
                        <td className="p-4 font-mono text-xs text-gray-500">{student.admissionNumber}</td>
                        <td className="p-4 font-bold text-gray-900">{student.fullName}</td>
                        <td className="p-4 text-gray-500 text-center font-medium">{student.gender?.charAt(0).toUpperCase() || '-'}</td>
                         {subjects.map(s => (
                            <td key={s.id} className="p-4 border-l border-gray-100"></td>
                        ))}
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            )}
        </div>
      )}
    </div>
  );
}
