import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Class, Student } from '../../types';
import { Users, Search, Download, User as UserIcon, X, Calendar, Phone } from 'lucide-react';

interface StudentsTabProps {
  teacher: any;
}

export default function StudentsTab({ teacher }: StudentsTabProps) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    fetchClasses();
  }, [teacher]);

  useEffect(() => {
    if (selectedClassId) {
      fetchStudents(selectedClassId);
    }
  }, [selectedClassId]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const teacherClassesMap = new Map<string, Class>();

      // 1. Query classes where this teacher is the class teacher
      const classTeacherQuery = query(
        collection(db, 'schools', teacher.schoolId, 'classes'),
        where('classTeacherId', '==', teacher.id)
      );
      const classTeacherSnapshot = await getDocs(classTeacherQuery);
      
      classTeacherSnapshot.docs.forEach(doc => {
        teacherClassesMap.set(doc.id, { id: doc.id, ...doc.data() } as Class);
      });

      // 2. Query class_subjects where this teacher teaches a subject
      const subjectTeacherQuery = query(
        collection(db, 'class_subjects'),
        where('schoolId', '==', teacher.schoolId),
        where('teacherId', '==', teacher.id)
      );
      const subjectTeacherSnapshot = await getDocs(subjectTeacherQuery);
      
      // Fetch the class details for those class_subjects if not already in the map
      for (const csDoc of subjectTeacherSnapshot.docs) {
        const classId = csDoc.data().classId;
        if (classId && !teacherClassesMap.has(classId)) {
          const classDocRef = doc(db, 'schools', teacher.schoolId, 'classes', classId);
          const classDocSnap = await getDoc(classDocRef);
          if (classDocSnap.exists()) {
            teacherClassesMap.set(classId, { id: classId, ...classDocSnap.data() } as Class);
          }
        }
      }

      const classesData = Array.from(teacherClassesMap.values());
      
      setClasses(classesData);
      if (classesData.length > 0) {
        setSelectedClassId(classesData[0].id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
      setLoading(false);
    }
  };

  const fetchStudents = async (classId: string) => {
    try {
      setLoading(true);
      const studentsQuery = query(
        collection(db, 'schools', teacher.schoolId, 'students'),
        where('classId', '==', classId),
        where('status', '==', 'active')
      );
      
      const snapshot = await getDocs(studentsQuery);
      const studentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];
      
      setStudents(studentsData);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportStudentsCSV = () => {
    const activeClass = classes.find(c => c.id === selectedClassId);
    if (!activeClass || students.length === 0) return;

    const data = students.map((s, index) => ({
      'S/N': index + 1,
      'Full Name': s.fullName || '',
      'Admission Number': s.admissionNumber || '',
      'Gender': s.gender || '',
      'Date of Birth': s.dateOfBirth || '',
      'Guardian Name': s.parentName || '',
      'Guardian Phone': s.parentPhone || ''
    }));

    const csvContent = "data:text/csv;charset=utf-8," 
      + Object.keys(data[0]).join(",") + "\n"
      + data.map(e => Object.values(e).map(val => `"${val}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Students_Class_${activeClass.name}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredStudents = students.filter(student => {
    const searchString = searchTerm.toLowerCase();
    return (
      (student.fullName && student.fullName.toLowerCase().includes(searchString)) ||
      (student.admissionNumber && student.admissionNumber.toLowerCase().includes(searchString))
    );
  });

  if (loading && classes.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-maroon"></div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 sm:p-12 text-center shadow-sm">
        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">No Assigned Classes</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          You have not been assigned to any classes. Therefore, you cannot view any students here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center justify-between">
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          {classes.length > 1 && (
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon font-medium"
            >
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or adm number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon transition-shadow"
            />
          </div>
        </div>

        <div className="w-full md:w-auto flex justify-end">
          <button
            onClick={exportStudentsCSV}
            disabled={students.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Grid view of students */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-maroon"></div>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-700">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Students Found</h3>
          <p className="text-gray-500">
            {searchTerm ? "No students matched your search." : "There are no students enrolled in this class."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStudents.map((student) => (
            <div 
              key={student.id} 
              onClick={() => setSelectedStudent(student)}
              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 flex flex-col items-center text-center cursor-pointer hover:shadow-lg transition-all hover:border-maroon/20 group relative overflow-hidden"
            >
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-maroon to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              {student.photoUrl ? (
                <img 
                  src={student.photoUrl} 
                  alt={student.fullName} 
                  className="w-20 h-20 rounded-full object-cover mb-4 ring-4 ring-gray-50 dark:ring-gray-900 group-hover:ring-maroon/10 transition-all"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4 ring-4 ring-gray-50 dark:ring-gray-900 group-hover:ring-maroon/10 transition-all">
                  <UserIcon className="h-10 w-10 text-blue-300 dark:text-blue-500" />
                </div>
              )}
              
              <h4 className="font-bold text-gray-900 dark:text-white mb-1 line-clamp-1">{student.fullName}</h4>
              <p className="text-xs font-medium text-maroon bg-maroon/5 px-3 py-1 rounded-full mb-3">
                Adm: {student.admissionNumber || 'N/A'}
              </p>
              
              <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium w-full mt-auto pt-4 border-t border-gray-50 dark:border-gray-700/50">
                <div className="flex-1 flex flex-col pt-1">
                  <span className="uppercase text-[10px] text-gray-400">Gender</span>
                  <span>{student.gender || 'Not Set'}</span>
                </div>
                <div className="w-[1px] bg-gray-100 dark:bg-gray-700/50"></div>
                <div className="flex-1 flex flex-col pt-1">
                  <span className="uppercase text-[10px] text-gray-400">Age</span>
                  <span>
                    {student.dateOfBirth 
                      ? `${Math.floor((new Date().getTime() - new Date(student.dateOfBirth).getTime()) / 31557600000)} yrs` 
                      : 'N/A'
                    }
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Student Details Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-gradient-to-br from-maroon to-rose-900 flex justify-between items-start text-white relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
              <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-black/10 rounded-full blur-xl"></div>
              
              <div className="flex items-center gap-6 relative z-10">
                {selectedStudent.photoUrl ? (
                  <img 
                    src={selectedStudent.photoUrl} 
                    alt={selectedStudent.fullName} 
                    className="w-24 h-24 rounded-full object-cover ring-4 ring-white/20 shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center ring-4 ring-white/20 shadow-lg">
                    <UserIcon className="h-12 w-12 text-white/50" />
                  </div>
                )}
                <div>
                  <h3 className="text-2xl font-black tracking-tight">{selectedStudent.fullName}</h3>
                  <div className="flex items-center gap-3 mt-2 text-white/80 font-medium text-sm">
                    <span className="bg-black/20 px-3 py-1 rounded-full border border-white/10 shadow-inner">
                      Adm: {selectedStudent.admissionNumber || 'N/A'}
                    </span>
                    <span className="bg-black/20 px-3 py-1 rounded-full border border-white/10 shadow-inner">
                      {classes.find(c => c.id === selectedClassId)?.name || 'Class'}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStudent(null)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors relative z-10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50 dark:bg-gray-900/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Personal Information */}
                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
                  <h4 className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-4">
                    <UserIcon className="h-4 w-4 text-maroon" />
                    Personal Info
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <span className="block text-xs font-bold text-gray-400 uppercase">Gender</span>
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{selectedStudent.gender || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-gray-400 uppercase">Date of Birth</span>
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{selectedStudent.dateOfBirth || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-gray-400 uppercase">Blood Group</span>
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{selectedStudent.bloodGroup || 'Not provided'}</span>
                    </div>
                  </div>
                </div>

                {/* Parent/Guardian Info */}
                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
                  <h4 className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-4">
                    <Phone className="h-4 w-4 text-maroon" />
                    Parent / Guardian
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <span className="block text-xs font-bold text-gray-400 uppercase">Guardian Name</span>
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{selectedStudent.parentName || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-gray-400 uppercase">Contact Number</span>
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{selectedStudent.parentPhone || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-gray-400 uppercase">Email Address</span>
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{selectedStudent.parentEmail || 'Not provided'}</span>
                    </div>
                  </div>
                </div>
                
                {/* Academic Summary (Placeholder) */}
                <div className="md:col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-100 dark:border-blue-800/30 rounded-2xl p-5 text-center">
                  <Calendar className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-1">Attendance Summary</h4>
                  <p className="text-xs text-blue-600/80 dark:text-blue-400/80 max-w-sm mx-auto">
                    Detailed attendance tracking for individual students is available in the Learners Attendance module.
                  </p>
                </div>

              </div>
            </div>
            
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 text-right">
              <button 
                onClick={() => setSelectedStudent(null)}
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
