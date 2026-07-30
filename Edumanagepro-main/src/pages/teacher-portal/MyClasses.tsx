import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Class } from '../../types';
import { Users, GraduationCap, Calendar, ChevronRight } from 'lucide-react';

interface MyClassesProps {
  teacher: any;
  onViewStudents?: () => void;
}

interface ClassWithCounts extends Class {
  studentCount?: number;
}

export default function MyClasses({ teacher, onViewStudents }: MyClassesProps) {
  const [classes, setClasses] = useState<ClassWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClasses();
  }, [teacher]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      
      const teacherClassesMap = new Map<string, ClassWithCounts>();

      // 1. Query classes where this teacher is the class teacher
      const classTeacherQuery = query(
        collection(db, 'schools', teacher.schoolId, 'classes'),
        where('classTeacherId', '==', teacher.id)
      );
      
      const classTeacherSnapshot = await getDocs(classTeacherQuery);
      
      classTeacherSnapshot.docs.forEach(doc => {
        teacherClassesMap.set(doc.id, { id: doc.id, ...doc.data() } as ClassWithCounts);
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
            teacherClassesMap.set(classId, { id: classId, ...classDocSnap.data() } as ClassWithCounts);
          }
        }
      }

      const classesData = Array.from(teacherClassesMap.values());
      
      if (classesData.length === 0) {
        setClasses([]);
        setLoading(false);
        return;
      }
      
      // For each class, fetch the number of students
      for (const cls of classesData) {
        try {
          // If students are assigned to classId
          const studentsQuery = query(
            collection(db, 'schools', teacher.schoolId, 'students'),
            where('classId', '==', cls.id),
            where('status', '==', 'active')
          );
          const stuSnap = await getDocs(studentsQuery);
          cls.studentCount = stuSnap.size;
        } catch (e) {
          console.error("Error fetching students count", e);
          cls.studentCount = 0;
        }
      }
      
      setClasses(classesData);
    } catch (error) {
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-maroon"></div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-8 sm:p-12 text-center shadow-sm">
        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <GraduationCap className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">No Assigned Classes</h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          You have not been assigned to any class yet. Please contact your school administrator to configure your class assignment.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {classes.map((cls) => (
        <div 
          key={cls.id}
          onClick={() => {
            if (onViewStudents) {
              onViewStudents();
            }
          }}
          className="group bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-maroon/5 hover:border-maroon/20 transition-all cursor-pointer flex flex-col"
        >
          <div className="p-6 pb-5 flex-1 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-maroon/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
            
            <div className="flex items-start justify-between relative z-10 mb-6">
              <div className="bg-maroon/10 p-3 rounded-2xl">
                <GraduationCap className="h-6 w-6 text-maroon" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-maroon bg-maroon/5 px-3 py-1 rounded-full">
                Active
              </span>
            </div>
            
            <div className="relative z-10">
              <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight mb-2">
                {cls.name}
              </h3>
              
              <div className="space-y-3 mt-6">
                <div className="flex items-center gap-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                  <Users className="h-4 w-4" />
                  <span>{cls.studentCount || 0} Students</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                  <Calendar className="h-4 w-4" />
                  <span>{teacher.academicYear || 'Current Year'}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-800/80 p-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between group-hover:bg-maroon/5 transition-colors">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300 group-hover:text-maroon transition-colors uppercase tracking-widest">
              View Students
            </span>
            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-maroon group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      ))}
    </div>
  );
}
