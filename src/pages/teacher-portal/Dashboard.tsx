import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, LogOut, School as SchoolIcon, Calendar, Edit3, FileText, LayoutDashboard, Users, BookOpen, Menu, X, Video } from 'lucide-react';
import MarksEntry from './MarksEntry';
import ExamRecordsBrowser from '@/components/ExamRecordsBrowser';
import ReportFormBrowser from '@/components/ReportFormBrowser';
import DigitalClock from '@/components/DigitalClock';
import ThemeToggle from '@/components/ThemeToggle';

import LearnerAttendanceTeacher from './LearnerAttendanceTeacher';
import TeacherClassMarkList from './TeacherClassMarkList';
import MyClasses from './MyClasses';
import StudentsTab from './StudentsTab';
import AssignmentsTab from './AssignmentsTab';
import LiveClassesTab from './LiveClassesTab';

type TabType = 'my_classes' | 'students' | 'assignments' | 'live_classes' | 'marks_entry' | 'opener' | 'midterm' | 'end_term' | 'report_form' | 'class_marklist' | 'learner_attendance';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [teacher, setTeacher] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>(
    (location.state as any)?.tab || 'my_classes'
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const authData = sessionStorage.getItem('teacherExamsAuth');
    if (!authData) {
      navigate('/teacher-portal/login');
      return;
    }
    setTeacher(JSON.parse(authData));
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('teacherExamsAuth');
    navigate('/teacher-portal/login');
  };

  if (!teacher) return null;

  const navLinks = [
    { id: 'my_classes', name: 'My Classes', icon: SchoolIcon },
    { id: 'students', name: 'Students', icon: Users },
    { id: 'assignments', name: 'Assignments', icon: BookOpen },
    { id: 'live_classes', name: 'Live Classes', icon: Video },
    { id: 'marks_entry', name: 'Marks Entry', icon: Edit3 },
    { id: 'class_marklist', name: 'Class Mark List', icon: FileText },
    { id: 'opener', name: 'Opener Exams', icon: LayoutDashboard },
    { id: 'midterm', name: 'Midterm Exams', icon: LayoutDashboard },
    { id: 'end_term', name: 'End Term Exams', icon: LayoutDashboard },
    { id: 'report_form', name: 'Term Report Form', icon: FileText },
    { id: 'learner_attendance', name: 'Learners Attendance', icon: Calendar },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      {!isSidebarOpen && window.innerWidth <= 768 ? null : (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`print:hidden fixed inset-y-0 left-0 z-50 md:relative bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ${isSidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-20'} flex flex-col shrink-0`}>
        <div className="p-4 md:p-6 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
          <div className="p-2 bg-maroon rounded-xl shrink-0">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold tracking-tight text-gray-900 dark:text-white truncate">EduManage<span className="text-maroon">Pro</span></span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Teacher Portal</span>
            </div>
          )}
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => {
                  setActiveTab(link.id);
                  if (window.innerWidth <= 768) setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-maroon text-white shadow-lg shadow-maroon/20' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-maroon'
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5 shrink-0" />
                </div>
                {isSidebarOpen && (
                  <div className="flex-1 text-left">
                    <span className="text-sm font-bold">{link.name}</span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 p-3 w-full rounded-xl text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {isSidebarOpen && <span className="text-sm font-bold">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden print:overflow-visible print:h-auto">
        <header className="print:hidden h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400">
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white hidden sm:block">
              {navLinks.find(link => link.id === activeTab)?.name}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
              <SchoolIcon className="h-4 w-4 text-gray-400" />
              <div className="text-left">
                <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">School</p>
                <p className="text-xs font-bold text-gray-900 dark:text-white">{teacher.schoolName}</p>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div className="text-left">
                <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">Term</p>
                <p className="text-xs font-bold text-gray-900 dark:text-white">{teacher.academicYear}</p>
              </div>
            </div>

            <div className="hidden xl:block">
              <DigitalClock />
            </div>
            
            <ThemeToggle />
            
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{teacher.fullName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">ID: {teacher.staffNumber}</p>
              </div>
              <div className="w-10 h-10 bg-maroon text-white rounded-full flex items-center justify-center font-bold shadow-sm">
                {teacher.fullName?.charAt(0) || 'T'}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50 dark:bg-gray-950 print:p-0 print:bg-white print:overflow-visible">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'my_classes' && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">My Classes</h2>
                  <p className="text-gray-500">View and manage the classes you have been assigned to.</p>
                </div>
                <MyClasses teacher={teacher} onViewStudents={() => setActiveTab('students')} />
              </>
            )}

            {activeTab === 'students' && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">My Students</h2>
                  <p className="text-gray-500">View and manage students in your assigned classes.</p>
                </div>
                <StudentsTab teacher={teacher} />
              </>
            )}

            {activeTab === 'assignments' && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">Assignments</h2>
                  <p className="text-gray-500">Create assignments, manage submissions, and provide feedback.</p>
                </div>
                <AssignmentsTab teacher={teacher} />
              </>
            )}

            {activeTab === 'live_classes' && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">Live Classes</h2>
                  <p className="text-gray-500">Schedule Zoom meetings and manage your virtual classrooms.</p>
                </div>
                <LiveClassesTab teacher={teacher} />
              </>
            )}

            {activeTab === 'marks_entry' && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">Marks Entry</h2>
                  <p className="text-gray-500">Select a class and exam to begin entering marks for your students.</p>
                </div>
                <MarksEntry teacher={teacher} />
              </>
            )}

            {activeTab === 'opener' && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">Opener Exams Records</h2>
                  <p className="text-gray-500">View, download, and print stored results for Opener Exams.</p>
                </div>
                <ExamRecordsBrowser schoolId={teacher.schoolId} examsCategory="Opener Exams" />
              </>
            )}

            {activeTab === 'midterm' && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">Midterm Exams Records</h2>
                  <p className="text-gray-500">View, download, and print stored results for Midterm Exams.</p>
                </div>
                <ExamRecordsBrowser schoolId={teacher.schoolId} examsCategory="Midterm Exams" />
              </>
            )}

            {activeTab === 'end_term' && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">End Term Exams Records</h2>
                  <p className="text-gray-500">View, download, and print stored results for End Term Exams.</p>
                </div>
                <ExamRecordsBrowser schoolId={teacher.schoolId} examsCategory="End Term Exams" />
              </>
            )}

            {activeTab === 'report_form' && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">Term Report Form</h2>
                  <p className="text-gray-500">Generate, view, download, and print full end-of-term report forms.</p>
                </div>
                <ReportFormBrowser schoolId={teacher.schoolId} />
              </>
            )}

            {activeTab === 'class_marklist' && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">Class Mark List</h2>
                  <p className="text-gray-500">View and download the mark list for your assigned class.</p>
                </div>
                <TeacherClassMarkList teacher={teacher} />
              </>
            )}

            {activeTab === 'learner_attendance' && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">Learners' Attendance</h2>
                  <p className="text-gray-500">Mark morning and afternoon attendance for students.</p>
                </div>
                <LearnerAttendanceTeacher teacher={teacher} />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
