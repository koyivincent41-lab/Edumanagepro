import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, getDocs, setDoc, doc } from 'firebase/firestore';
import { Loader2, Save, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function LearnerAttendanceTeacher({ teacher }: { teacher: any }) {
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

  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(getLocalToday(teacher?.timezone));
  const [selectedTerm, setSelectedTerm] = useState(teacher.currentTerm || 'Term 1');
  const [selectedYear, setSelectedYear] = useState(teacher.academicYear || new Date().getFullYear().toString());
  const [selectedSession, setSelectedSession] = useState<'Morning'|'Afternoon'>('Morning');
  
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [draftRecords, setDraftRecords] = useState<Record<string, Record<string, string>>>({}); // { studentId: { date: 'Present' | 'Absent' } }
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (!teacher?.schoolId) return;
    const fetchClasses = async () => {
      try {
        const classesSnap = await getDocs(collection(db, 'schools', teacher.schoolId, 'classes'));
        let classesData = classesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        if (teacher.branchId) {
            classesData = classesData.filter(c => c.branchId === teacher.branchId);
        }
        setClasses(classesData);
        
        const studentsSnap = await getDocs(collection(db, 'schools', teacher.schoolId, 'students'));
        setStudents(studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      } catch (error) {
        console.error('Error fetching data', error);
      }
    };
    fetchClasses();
  }, [teacher]);

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

  const exportToCalendar = () => {
    if (!selectedClass || attendanceRecords.length === 0) return;
    
    const className = classes.find(c => c.id === selectedClass)?.name || 'Class';
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//School Management System//Attendance//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    attendanceRecords.forEach(record => {
      const student = students.find(s => s.id === record.studentId);
      if (!student) return;

      const [y, m, d] = record.date.split('-').map(Number);
      const dateStr = `${y}${String(m).padStart(2,'0')}${String(d).padStart(2,'0')}`;
      
      const summary = `Attendance: ${student.fullName} (${record.status})`;
      const description = `Session: ${record.session}\\nClass: ${className}\\nStatus: ${record.status}`;

      icsContent.push('BEGIN:VEVENT');
      icsContent.push(`DTSTART;VALUE=DATE:${dateStr}`);
      icsContent.push(`DTEND;VALUE=DATE:${dateStr}`);
      icsContent.push(`SUMMARY:${summary}`);
      icsContent.push(`DESCRIPTION:${description}`);
      icsContent.push('STATUS:CONFIRMED');
      icsContent.push('TRANSP:TRANSPARENT');
      icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');
    
    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `Attendance_${className}_${selectedDate}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Calendar file generated! Import this into Google Calendar to sync.");
  };

  const loadRegister = async () => {
    if (!teacher?.schoolId || !selectedClass) return;
    setLoading(true);
    setHasLoaded(false);
    try {
      const recordsSnap = await getDocs(collection(db, 'schools', teacher.schoolId, 'learner_attendance'));
      const allRecords = recordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      const datesStringArray = weekDates.map(d => d.dateString);
      
      const filtered = allRecords.filter(r => 
        r.classId === selectedClass && 
        datesStringArray.includes(r.date) &&
        r.session === selectedSession &&
        r.term === selectedTerm &&
        r.academicYear === selectedYear
      );
      setAttendanceRecords(filtered);
      
      // initialize drafting state
      const drafts: Record<string, Record<string, string>> = {};
      classStudents.forEach(student => {
          drafts[student.id] = {};
          datesStringArray.forEach(d => {
             const existing = filtered.find(r => r.studentId === student.id && r.date === d);
             if (existing) {
                 drafts[student.id][d] = existing.status;
             }
          });
      });
      setDraftRecords(drafts);
      setHasLoaded(true);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load register');
    }
    setLoading(false);
  };

  const handleMark = (studentId: string, date: string, status: 'Present' | 'Absent') => {
      setDraftRecords(prev => ({
          ...prev,
          [studentId]: {
              ...prev[studentId],
              [date]: status
          }
      }));
  };

  const handleSaveClick = async () => {
      if (!teacher?.schoolId || !selectedClass) return;
      
      // Validation: At least one entry must be filled
      let hasAnyEntry = false;
      Object.keys(draftRecords).forEach(sid => {
          if (Object.keys(draftRecords[sid]).length > 0) hasAnyEntry = true;
      });
      
      if (!hasAnyEntry) {
          toast.error("Please mark at least one student before saving.");
          return;
      }
      
      setShowConfirmModal(true);
  };

  const confirmAndSaveAttendance = async () => {
      if (!teacher?.schoolId || !selectedClass) return;
      
      setShowConfirmModal(false);
      setSaving(true);
      
      const datesStringArray = weekDates.map(d => d.dateString);
      try {
          for (const student of classStudents) {
              const studentDrafts = draftRecords[student.id] || {};
              for (const date of datesStringArray) {
                  const status = studentDrafts[date];
                  if (status) { // Only save if selected
                      const docId = `${student.id}_${date}_${selectedSession}`;
                      await setDoc(doc(db, 'schools', teacher.schoolId, 'learner_attendance', docId), {
                          studentId: student.id,
                          classId: selectedClass,
                          date: date,
                          dayOfWeek: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
                          session: selectedSession,
                          status: status,
                          markedBy: teacher.uid || teacher.id,
                          term: selectedTerm,
                          academicYear: selectedYear,
                          timestamp: new Date().toISOString()
                      }, { merge: true });
                  }
              }
          }
          toast.success("Attendance saved successfully!");
          await loadRegister();
      } catch(e) {
          console.error(e);
          toast.error("Error saving attendance");
      }
      setSaving(false);
  };

  const classStudents = students.filter(s => s.classId === selectedClass);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setHasLoaded(false); }} className="p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-maroon">
            <option value="">Select Class...</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setHasLoaded(false); }} className="p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-maroon" />
          <select value={selectedTerm} onChange={e => { setSelectedTerm(e.target.value); setHasLoaded(false); }} className="p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-maroon">
            <option value="Term 1">Term 1</option>
            <option value="Term 2">Term 2</option>
            <option value="Term 3">Term 3</option>
          </select>
          <select value={selectedYear} onChange={e => { setSelectedYear(e.target.value); setHasLoaded(false); }} className="p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-maroon">
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
          <select value={selectedSession} onChange={e => { setSelectedSession(e.target.value as 'Morning'|'Afternoon'); setHasLoaded(false); }} className="p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-maroon font-bold text-maroon">
            <option value="Morning">Morning</option>
            <option value="Afternoon">Afternoon</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 flex-wrap">
             <button 
               onClick={exportToCalendar}
               disabled={!selectedClass || attendanceRecords.length === 0}
               className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
             >
               <Download className="h-4 w-4" />
               Sync to Google Calendar
             </button>
             <button onClick={loadRegister} disabled={!selectedClass} className="px-6 py-3 bg-maroon text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-2 hover:bg-maroon/90 transition-colors shadow-lg shadow-maroon/20">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Load Attendance Register
             </button>
        </div>
      </div>

      {hasLoaded && classStudents.length > 0 && selectedClass && !loading && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-maroon/5 border-b border-gray-200 flex justify-between items-center">
             <h2 className="font-bold text-maroon">Marking for: {selectedSession} Session</h2>
             <button onClick={handleSaveClick} disabled={saving} className="px-5 py-2 bg-maroon text-white font-bold text-sm rounded-xl disabled:opacity-50 flex items-center gap-2 hover:bg-maroon/90 transition-colors shadow-lg shadow-maroon/20">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Register
             </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-sm">
                  <th className="p-4 font-bold text-gray-900 border-r border-gray-200 min-w-[200px]">Student Name</th>
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
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-sm font-medium border-r border-gray-200">{student.fullName}</td>
                    {weekDates.map(d => {
                        const status = draftRecords[student.id]?.[d.dateString];
                        return (
                          <td key={d.dateString} className="p-4 text-center border-r border-gray-200 align-middle">
                            <div className="flex flex-col gap-2 items-center justify-center">
                                <button
                                    onClick={() => handleMark(student.id, d.dateString, 'Present')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 w-[fit-content] border ${
                                        status === 'Present' 
                                        ? 'bg-green-100 text-green-700 border-green-200 shadow-inner' 
                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] ${status === 'Present' ? 'bg-green-500 text-white' : 'border border-gray-300'}`}>
                                        {status === 'Present' && '✔'}
                                    </div>
                                    Present
                                </button>

                                <button
                                    onClick={() => handleMark(student.id, d.dateString, 'Absent')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 w-[fit-content] border ${
                                        status === 'Absent' 
                                        ? 'bg-red-50 text-red-600 border-red-200 shadow-inner' 
                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className={`w-3 h-3 rounded-full flex items-center justify-center ${status === 'Absent' ? 'bg-red-500' : 'border border-gray-300'}`}>
                                    </div>
                                    Absent
                                </button>
                            </div>
                          </td>
                        )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">Confirm Save</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Are you sure you want to save the {selectedSession} attendance for the selected week?
              </p>
              <p className="text-sm font-bold text-red-600">
                Warning: Existing records for this session will be overwritten!
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={confirmAndSaveAttendance}
                disabled={saving}
                className="px-6 py-2 bg-maroon text-white font-bold rounded-xl hover:bg-maroon/90 transition-all flex items-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
