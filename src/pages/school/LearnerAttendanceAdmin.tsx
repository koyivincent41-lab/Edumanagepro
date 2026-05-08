import React, { useState, useEffect } from 'react';
import { School, Student, Class } from '../../types';
import { db } from '../../firebase';
import { collection, query, getDocs, onSnapshot, where } from 'firebase/firestore';
import { Search, Loader2, Calendar, Download } from 'lucide-react';
import { useBranch } from '../../context/BranchContext';
import { toast } from 'sonner';

export default function LearnerAttendanceAdmin({ school }: { school: School | null }) {
  const { currentBranch } = useBranch();
  const getLocalToday = (timezone?: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: timezone || undefined
      };
      const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(new Date());
      const y = parts.find(p => p.type === 'year')?.value;
      const m = parts.find(p => p.type === 'month')?.value;
      const d = parts.find(p => p.type === 'day')?.value;
      return `${y}-${m}-${d}`;
    } catch (e) {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  };

  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(getLocalToday(currentBranch?.timezone));
  const [selectedTerm, setSelectedTerm] = useState(school?.currentTerm || 'Term 1');
  const [selectedYear, setSelectedYear] = useState(school?.academicYear || new Date().getFullYear().toString());
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (!school?.id || !selectedClass) return;
    setLoading(true);

    const [yyyy, mm, dd] = selectedDate.split('-').map(Number);
    const date = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
    const day = date.getDay() || 7; // 1-7 (Mon-Sun)
    
    const mon = new Date(date);
    mon.setDate(date.getDate() - (day - 1));
    
    const datesOfWeek: string[] = [];
    for(let i=0; i<5; i++) {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayOfMonth = String(d.getDate()).padStart(2, '0');
        datesOfWeek.push(`${y}-${m}-${dayOfMonth}`);
    }

    const q = query(
        collection(db, 'schools', school.id, 'learner_attendance'),
        where('classId', '==', selectedClass)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const allRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        const filtered = allRecords.filter(r => 
          datesOfWeek.includes(r.date) && 
          r.term === selectedTerm && 
          String(r.academicYear) === String(selectedYear)
        );
        setAttendanceRecords(filtered);
        setLoading(false);
    }, (error) => {
        console.error('Error syncing attendance:', error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [school?.id, selectedClass, selectedDate, selectedTerm, selectedYear]);

  const exportClassCSV = () => {
    if (!selectedClass || attendanceRecords.length === 0) {
      toast.error("No attendance records to export for this class.");
      return;
    }
    
    const className = classes.find(c => c.id === selectedClass)?.name || 'Class';
    
    let csvContent = "Student Name,Date,Session,Status\n";
    attendanceRecords.forEach(record => {
      const student = students.find(s => s.id === record.studentId);
      if (student) {
        csvContent += `"${student.fullName}","${record.date}","${record.session}","${record.status}"\n`;
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `Attendance_${className}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportSchoolCSV = async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'schools', school.id, 'learner_attendance'),
        where('term', '==', selectedTerm),
        where('academicYear', '==', selectedYear)
      );
      const snap = await getDocs(q);
      const allRecords = snap.docs.map(doc => doc.data() as any);
      
      const filtered = allRecords.filter(r => r.date === selectedDate);
      
      if (filtered.length === 0) {
        toast.error("No attendance records to export for this date.");
        setLoading(false);
        return;
      }

      let csvContent = "Class,Student Name,Date,Session,Status\n";
      filtered.forEach(record => {
        const student = students.find(s => s.id === record.studentId);
        const cls = classes.find(c => c.id === record.classId);
        if (student && cls) {
          csvContent += `"${cls.name}","${student.fullName}","${record.date}","${record.session}","${record.status}"\n`;
        }
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute('download', `School_Attendance_${selectedDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      toast.error("Failed to export school attendance.");
    }
    setLoading(false);
  };

  const getRecordSymbols = (studentId: string, date: string) => {
    const morning = attendanceRecords.find(r => r.studentId === studentId && r.date === date && r.session === 'Morning');
    const afternoon = attendanceRecords.find(r => r.studentId === studentId && r.date === date && r.session === 'Afternoon');
    
    // If neither session is marked, return an empty string to show nothing.
    if (!morning && !afternoon) return '';

    let mSymbol = morning ? (morning.status === 'Present' ? '✔' : '○') : '-';
    let aSymbol = afternoon ? (afternoon.status === 'Present' ? '✔' : '○') : '-';
    return `${mSymbol}${aSymbol}`;
  };

  const classStudents = students.filter(s => s.classId === selectedClass);
  
  const getDatesOfWeek = () => {
      const [yyyy, mm, dd] = selectedDate.split('-').map(Number);
      const date = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
      const day = date.getDay() || 7; // 1-7 (Mon-Sun)
      
      const mon = new Date(date);
      mon.setDate(date.getDate() - (day - 1));
      
      const dates: {dayInfo: string, dateString: string}[] = [];
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      for(let i=0; i<5; i++) {
          const d = new Date(mon);
          d.setDate(mon.getDate() + i);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dayOfMonth = String(d.getDate()).padStart(2, '0');
          dates.push({
            dayInfo: dayNames[i],
            dateString: `${y}-${m}-${dayOfMonth}`
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
        <div className="flex items-center gap-3">
          <button 
            onClick={exportSchoolCSV}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-bold rounded-xl shadow-lg hover:bg-gray-800 transition-all disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download School CSV
          </button>
          <button 
            onClick={exportClassCSV}
            disabled={!selectedClass || attendanceRecords.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:shadow-none"
          >
            <Download className="h-4 w-4" />
            Download Class CSV
          </button>
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
          <div className="p-4 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex flex-wrap gap-4 justify-center">
            <div className="flex items-center gap-1"><span>✔✔</span> = Present All Day</div>
            <div className="flex items-center gap-1"><span>○○</span> = Absent All Day</div>
            <div className="flex items-center gap-1"><span>✔○</span> = Present Morning Only</div>
            <div className="flex items-center gap-1"><span>○✔</span> = Present Afternoon Only</div>
            <div className="flex items-center gap-1"><span className="text-gray-300">Blank</span> = Not Marked</div>
          </div>
        </div>
      )}
    </div>
  );
}
