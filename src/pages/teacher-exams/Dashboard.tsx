import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, LogOut, School as SchoolIcon, Calendar, Edit3, FileText, LayoutDashboard } from 'lucide-react';
import MarksEntry from './MarksEntry';
import ExamRecordsBrowser from '../../components/ExamRecordsBrowser';
import ReportFormBrowser from '../../components/ReportFormBrowser';
import DigitalClock from '../../components/DigitalClock';
import ThemeToggle from '../../components/ThemeToggle';

import LearnerAttendanceTeacher from './LearnerAttendanceTeacher';
import TeacherClassMarkList from './TeacherClassMarkList';

type TabType = 'marks_entry' | 'opener' | 'midterm' | 'end_term' | 'report_form' | 'class_marklist' | 'learner_attendance';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [teacher, setTeacher] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>(
    (location.state as any)?.tab || 'marks_entry'
  );

  useEffect(() => {
    const authData = sessionStorage.getItem('teacherExamsAuth');
    if (!authData) {
      navigate('/teacher-exams/login');
      return;
    }
    setTeacher(JSON.parse(authData));
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('teacherExamsAuth');
    navigate('/teacher-exams/login');
  };

  if (!teacher) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <div className="bg-maroon/10 p-2 rounded-xl">
                <GraduationCap className="h-8 w-8 text-maroon" />
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-900 leading-none">Exams <span className="text-maroon">Portal</span></h1>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Teacher Dashboard</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-4 md:gap-8">
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
                <SchoolIcon className="h-4 w-4 text-gray-400" />
                <div className="text-left">
                  <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">School</p>
                  <p className="text-sm font-bold text-gray-900">{teacher.schoolName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div className="text-left">
                  <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">Academic Year</p>
                  <p className="text-sm font-bold text-gray-900">{teacher.academicYear}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden lg:block">
                <DigitalClock />
              </div>
              <ThemeToggle />
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-900">{teacher.fullName}</p>
                <p className="text-xs text-gray-400 font-medium">ID: {teacher.staffNumber}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2.5 text-gray-400 hover:text-maroon hover:bg-maroon/5 rounded-xl transition-all group"
                title="Logout"
              >
                <LogOut className="h-6 w-6 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-4 md:px-6 lg:px-4 md:px-8 py-4 md:py-8">
        
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-xl md:text-2xl font-bold text-white">Exams Portal</h1>
      </div>

      {/* Tabs */}
      <div className="flex flex-row overflow-x-auto sm:flex-wrap gap-2 md:gap-3 mb-6 md:mb-8 pb-2 no-scrollbar">
        <button 
          onClick={() => setActiveTab('marks_entry')}
          className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'marks_entry' ? 'bg-maroon text-white shadow-lg shadow-maroon/20' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
        >
          <Edit3 className="h-4 w-4 md:h-5 md:w-5" />
          Marks Entry
        </button>
        <button 
          onClick={() => setActiveTab('opener')}
          className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'opener' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
        >
          <LayoutDashboard className="h-4 w-4 md:h-5 md:w-5" />
          Opener Exams
        </button>
        <button 
          onClick={() => setActiveTab('midterm')}
          className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'midterm' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
        >
          <LayoutDashboard className="h-4 w-4 md:h-5 md:w-5" />
          Midterm Exams
        </button>
        <button 
          onClick={() => setActiveTab('end_term')}
          className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'end_term' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
        >
          <LayoutDashboard className="h-4 w-4 md:h-5 md:w-5" />
          End Term Exams
        </button>
        <button 
          onClick={() => setActiveTab('report_form')}
          className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'report_form' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
        >
          <FileText className="h-4 w-4 md:h-5 md:w-5" />
          Term Report Form
        </button>
        <button 
          onClick={() => setActiveTab('class_marklist')}
          className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'class_marklist' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
        >
          <FileText className="h-4 w-4 md:h-5 md:w-5" />
          Class Mark List
        </button>
        <button 
          onClick={() => setActiveTab('learner_attendance')}
          className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'learner_attendance' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
        >
          <Calendar className="h-4 w-4 md:h-5 md:w-5" />
          Learners Attendance
        </button>
      </div>

      {activeTab === 'marks_entry' && (
        <>
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-black text-white">Marks Entry</h2>
            <p className="text-gray-300">Select a class and exam to begin entering marks for your students.</p>
          </div>
          <MarksEntry teacher={teacher} />
        </>
      )}

      {activeTab === 'opener' && (
        <>
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-black text-white">Opener Exams Records</h2>
            <p className="text-gray-300">View, download, and print stored results for Opener Exams.</p>
          </div>
          <ExamRecordsBrowser schoolId={teacher.schoolId} examsCategory="Opener Exams" />
        </>
      )}

      {activeTab === 'midterm' && (
        <>
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-black text-white">Midterm Exams Records</h2>
            <p className="text-gray-300">View, download, and print stored results for Midterm Exams.</p>
          </div>
          <ExamRecordsBrowser schoolId={teacher.schoolId} examsCategory="Midterm Exams" />
        </>
      )}

      {activeTab === 'end_term' && (
        <>
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-black text-white">End Term Exams Records</h2>
            <p className="text-gray-300">View, download, and print stored results for End Term Exams.</p>
          </div>
          <ExamRecordsBrowser schoolId={teacher.schoolId} examsCategory="End Term Exams" />
        </>
      )}

      {activeTab === 'report_form' && (
        <>
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-black text-white">Term Report Form</h2>
            <p className="text-gray-300">Generate, view, download, and print full end-of-term report forms.</p>
          </div>
          <ReportFormBrowser schoolId={teacher.schoolId} />
        </>
      )}

      {activeTab === 'class_marklist' && (
        <>
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-black text-white">Class Mark List</h2>
            <p className="text-gray-300">View and download the mark list for your assigned class.</p>
          </div>
          <TeacherClassMarkList teacher={teacher} />
        </>
      )}

      {activeTab === 'learner_attendance' && (
        <>
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-black text-white">Learners' Attendance</h2>
            <p className="text-gray-300">Mark morning and afternoon attendance for students.</p>
          </div>
          <LearnerAttendanceTeacher teacher={teacher} />
        </>
      )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-400 font-medium">
            &copy; {new Date().getFullYear()} Teacher Exams Portal. Securely connected to {teacher.schoolName}.
          </p>
        </div>
      </footer>
    </div>
  );
}
