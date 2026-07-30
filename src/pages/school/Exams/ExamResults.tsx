import React, { useState } from 'react';
import { School } from '../../../types';
import { LayoutDashboard, FileText } from 'lucide-react';
import ExamRecordsBrowser from '../../../components/ExamRecordsBrowser';
import ReportFormBrowser from '../../../components/ReportFormBrowser';

type TabType = 'opener' | 'midterm' | 'end_term' | 'report_form';

export default function ExamResults({ schoolId, school }: { schoolId: string, school: School | null }) {
  const [activeTab, setActiveTab] = useState<TabType>('opener');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-xl md:text-2xl font-bold text-white">Exam Records & Reports</h1>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button 
          onClick={() => setActiveTab('opener')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all ${activeTab === 'opener' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
        >
          <LayoutDashboard className="h-5 w-5" />
          Openar Exams
        </button>
        <button 
          onClick={() => setActiveTab('midterm')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all ${activeTab === 'midterm' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
        >
          <LayoutDashboard className="h-5 w-5" />
          Midterm Exams
        </button>
        <button 
          onClick={() => setActiveTab('end_term')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all ${activeTab === 'end_term' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
        >
          <LayoutDashboard className="h-5 w-5" />
          End Term Exams
        </button>
        <button 
          onClick={() => setActiveTab('report_form')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all ${activeTab === 'report_form' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
        >
          <FileText className="h-5 w-5" />
          Term Report Form
        </button>
      </div>

      {activeTab === 'opener' && (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-black text-white">Openar Exams Records</h2>
            <p className="text-gray-300">View, download, and print stored results for Openar Exams.</p>
          </div>
          <ExamRecordsBrowser schoolId={schoolId} examsCategory="Openar Exams" />
        </>
      )}

      {activeTab === 'midterm' && (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-black text-white">Midterm Exams Records</h2>
            <p className="text-gray-300">View, download, and print stored results for Midterm Exams.</p>
          </div>
          <ExamRecordsBrowser schoolId={schoolId} examsCategory="Midterm Exams" />
        </>
      )}

      {activeTab === 'end_term' && (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-black text-white">End Term Exams Records</h2>
            <p className="text-gray-300">View, download, and print stored results for End Term Exams.</p>
          </div>
          <ExamRecordsBrowser schoolId={schoolId} examsCategory="End Term Exams" />
        </>
      )}

      {activeTab === 'report_form' && (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-black text-white">Term Report Form</h2>
            <p className="text-gray-300">Generate, view, download, and print full end-of-term report forms.</p>
          </div>
          <ReportFormBrowser schoolId={schoolId} isAdmin={true} />
        </>
      )}
    </div>
  );
}
