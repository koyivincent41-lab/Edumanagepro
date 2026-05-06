import React, { useState, useEffect } from 'react';
import { School, Student, Class } from '../../types';
import { db } from '../../firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { Search, Loader2, Calendar } from 'lucide-react';
import { useBranch } from '../../context/BranchContext';

export default function LearnerAttendanceAdmin({ school }: { school: School | null }) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTerm, setSelectedTerm] = useState(school?.currentTerm || 'Term 1');
  const [selectedYear, setSelectedYear] = useState(school?.academicYear || new Date().getFullYear().toString());
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentBranch } = useBranch();

  useEffect(() => {
    if (!school?.id) return;
    const fetchData = async () => {
      try {
        const classesSnap = await getDocs(collection(db, 'schools', school.id, 'classes'));
        let classesData = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
        if (currentBranch) {
          classesData = classesData.filter(c => c.branchId === currentBranch.id);
        }
        setClasses(classesData);

        const studentsSnap = await getDocs(collection(db, 'schools', school.id, 'students'));
        setStudents(studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      } catch (error) {
        console.error('Error fetching classes/students', error);
      }
    };
    fetchData();
  }, [school?.id, currentBranch]);

  const loadAttendance = async () => {
    if (!school?.id || !selectedClass) return;
    setLoading(true);
    
    // Calculate the start (Monday) and end (Friday) of the week containing selectedDate
    const date = new Date(selectedDate);
    const day = date.getDay() || 7; // Get current day number, converting Sun(0) to 7
    if (day !== 1) date.setHours(-24 * (day - 1)); // Adjust to monday
    
    const datesOfWeek: string[] = [];
    for(let i=0; i<5; i++) {
        const d = new Date(date);
        d.setDate(date.getDate() + i);
        datesOfWeek.push(d.toISOString().split('T')[0]);
    }
    
    try {
      const recordsSnap = await getDocs(collection(db, 'schools', school.id, 'learner_attendance'));
      const allRecords = recordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      const filtered = allRecords.filter(r => 
        r.classId === selectedClass && 
        datesOfWeek.includes(r.date) &&
        r.term === selectedTerm &&
        r.academicYear === selectedYear
      );
      setAttendanceRecords(filtered);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const getRecordSymbols = (studentId: string, date: string) => {
    const morning = attendanceRecords.find(r => r.studentId === studentId && r.date === date && r.session === 'Morning');
    const afternoon = attendanceRecords.find(r => r.studentId === studentId && r.date === date && r.session === 'Afternoon');
    
    let mSymbol = morning ? (morning.status === 'Present' ? '✔' : '○') : '-';
    let aSymbol = afternoon ? (afternoon.status === 'Present' ? '✔' : '○') : '-';
    return `${mSymbol}${aSymbol}`;
  };

  const classStudents = students.filter(s => s.classId === selectedClass);
  
  const getDatesOfWeek = () => {
      const date = new Date(selectedDate);
      const day = date.getDay() || 7;
      if (day !== 1) date.setHours(-24 * (day - 1));
      
      const dates: {dayInfo: string, dateString: string}[] = [];
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      for(let i=0; i<5; i++) {
          const d = new Date(date);
          d.setDate(date.getDate() + i);
          dates.push({
            dayInfo: dayNames[i],
            dateString: d.toISOString().split('T')[0]
          });
      }
      return dates;
  };

  const weekDates = getDatesOfWeek();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Learners' Attendance</h1>
          <p className="text-gray-500">Monitor student attendance records (Read-Only)</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary">
            <option value="">Select Class...</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary" />
          <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value as any)} className="p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary">
            <option value="Term 1">Term 1</option>
            <option value="Term 2">Term 2</option>
            <option value="Term 3">Term 3</option>
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary">
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
        </div>
        <div className="flex justify-end">
             <button onClick={loadAttendance} disabled={!selectedClass} className="px-6 py-3 bg-primary text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-2 hover:bg-primary/90 transition-colors">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                View Attendance
             </button>
        </div>
      </div>

      {classStudents.length > 0 && selectedClass && !loading && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-sm">
                  <th className="p-4 font-bold text-gray-900 border-r border-gray-200">Student Name</th>
                  {weekDates.map(d => (
                    <th key={d.dateString} className="p-4 font-bold text-gray-900 text-center border-r border-gray-200">
                      {d.dayInfo}
                      <div className="text-xs text-gray-500 font-normal">{d.dateString}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {classStudents.map(student => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="p-4 text-sm font-medium border-r border-gray-200">{student.fullName}</td>
                    {weekDates.map(d => (
                      <td key={d.dateString} className="p-4 text-center font-mono font-bold text-lg border-r border-gray-200 tracking-widest">
                        {getRecordSymbols(student.id, d.dateString)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex gap-4 justify-center">
            <div className="flex items-center gap-1"><span>✔✔</span> = Present All Day</div>
            <div className="flex items-center gap-1"><span>○○</span> = Absent All Day</div>
            <div className="flex items-center gap-1"><span>✔○</span> = Present Morning Only</div>
            <div className="flex items-center gap-1"><span>○✔</span> = Present Afternoon Only</div>
            <div className="flex items-center gap-1"><span>-</span> = Not Marked</div>
          </div>
        </div>
      )}
    </div>
  );
}
