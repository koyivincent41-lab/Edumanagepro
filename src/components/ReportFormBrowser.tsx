import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Class, Student, Stream, ExamSession } from '../types';
import { Loader2, Search, Eye, Download, Printer, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import TermReportForm from './TermReportForm';
import { useBranch } from '../context/BranchContext';

interface ReportFormBrowserProps {
  schoolId: string;
  isAdmin?: boolean;
}

export default function ReportFormBrowser({ schoolId, isAdmin = false }: ReportFormBrowserProps) {
  const { classes, streams } = useBranch();
  
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(new Date().getFullYear().toString());
  
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [viewingStudent, setViewingStudent] = useState<{ student: Student, action: 'view' | 'download' | 'print' } | null>(null);
  const [bulkPrinting, setBulkPrinting] = useState(false);
  const [bulkPrintIndex, setBulkPrintIndex] = useState(0);

  const handleLoadRecords = async () => {
    if (!selectedClassId || !selectedTerm || !selectedAcademicYear) {
      toast.error('Please select class, academic year, and term before loading learners.');
      return;
    }
    setLoading(true);

    try {
      // Fetch students
      const studentsQ = query(
        collection(db, 'schools', schoolId, 'students'),
        where('classId', '==', selectedClassId),
        where('status', '==', 'active')
      );
      const studentsSnap = await getDocs(studentsQ);
      const studentData = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      
      // Sort by admission number (ascending)
      setStudents(studentData.sort((a, b) => {
        const numA = parseInt(a.admissionNumber.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.admissionNumber.replace(/\D/g, '')) || 0;
        if (numA !== numB) return numA - numB;
        return a.admissionNumber.localeCompare(b.admissionNumber, undefined, { numeric: true });
      }));
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

  const [bulkPrintStudents, setBulkPrintStudents] = useState<Student[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const [showBulkPrintModal, setShowBulkPrintModal] = useState(false);

  const handleBulkPrint = () => {
    if (!selectedClassId || !selectedTerm || !selectedAcademicYear) {
      toast.error('Please select class, academic year, and term before bulk printing.');
      return;
    }
    if (students.length === 0) {
      toast.error('No report forms found for the selected class and term.');
      return;
    }
    setBulkPrinting(true);
    setShowBulkPrintModal(true);
    setLoadedCount(0);
    setBulkPrintStudents(students);
  };

  const handleReportFormLoad = () => {
    setLoadedCount(prev => prev + 1);
  };

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 items-end">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Class</label>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold text-gray-700">
              <option value="">-- Choose Class --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
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
            Load Learners
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : students.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h3 className="text-lg font-black text-gray-900">Generate Term Report Form</h3>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Search learner..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg outline-none text-sm" />
              </div>
              {isAdmin && (
                <button onClick={handleBulkPrint} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-bold text-sm whitespace-nowrap">
                  <Copy className="h-4 w-4" />
                  Bulk Print Class
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="min-w-[700px] w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Admission</th>
                  <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Name</th>
                  <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Class</th>
                  <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Stream</th>
                  <th className="px-4 md:px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((student) => {
                  const studentClass = classes.find(c => c.id === student.classId);
                  const studentStream = streams.find(s => s.id === student.streamId);

                  return (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-900">{student.admissionNumber}</td>
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-900">{student.fullName}</td>
                      <td className="px-4 md:px-6 py-4 text-gray-600">{studentClass?.name || '-'}</td>
                      <td className="px-4 md:px-6 py-4 text-gray-600">{studentStream?.name || '-'}</td>
                      <td className="px-4 md:px-6 py-4 flex items-center gap-2">
                        <button onClick={() => setViewingStudent({ student, action: 'view' })} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Report Form">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => setViewingStudent({ student, action: 'download' })} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Download Report Form">
                          <Download className="h-4 w-4" />
                        </button>
                        <button onClick={() => setViewingStudent({ student, action: 'print' })} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Print Report Form">
                          <Printer className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500 font-medium">Select criteria and load learners to generate report forms.</p>
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

      {showBulkPrintModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-4 md:p-8">
          <div className="bg-white w-[calc(100%-2rem)] md:w-full max-w-5xl h-full rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100 p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
                  <Printer className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">Bulk Print Report Forms</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {classes.find(c => c.id === selectedClassId)?.name}
                    </span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {selectedAcademicYear} - {selectedTerm}
                    </span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">
                      {loadedCount} / {bulkPrintStudents.length} Loaded
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={triggerPrint}
                  disabled={loadedCount < bulkPrintStudents.length}
                  className="flex items-center gap-2 px-4 md:px-6 py-3 bg-purple-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-purple-600/20 hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer className="h-4 w-4" />
                  Print All
                </button>
                <button
                  onClick={() => {
                    setShowBulkPrintModal(false);
                    setBulkPrinting(false);
                    setBulkPrintStudents([]);
                  }}
                  className="p-3 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-all"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-12 bg-gray-50/50 bulk-print-modal-body">
              {loadedCount < bulkPrintStudents.length && (
                <div className="flex flex-col items-center justify-center py-20 print:hidden">
                  <Loader2 className="h-12 w-12 animate-spin text-purple-600 mb-4" />
                  <p className="text-lg font-bold text-gray-900">Preparing Report Forms...</p>
                  <p className="text-sm text-gray-500">Please wait while we load all learner data.</p>
                </div>
              )}
              
              <div className="bulk-print-container">
                {bulkPrintStudents.map(student => (
                  <div key={student.id} className="bg-white p-4 md:p-8 rounded-3xl shadow-sm border border-gray-100 mb-8 last:mb-0 print:m-0 print:p-0 print:shadow-none print:border-none print:block">
                    <TermReportForm
                      student={student}
                      term={selectedTerm}
                      academicYear={selectedAcademicYear}
                      schoolId={schoolId}
                      initialAction="bulk-print"
                      isBulkPrint={true}
                      onLoad={handleReportFormLoad}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <style type="text/css" media="print">
            {`
              @page { 
                margin: 10mm; 
                size: portrait;
              }
              body * { visibility: hidden !important; }
              .bulk-print-modal-body, .bulk-print-modal-body * { visibility: visible !important; }
              .bulk-print-container, .bulk-print-container * { visibility: visible !important; }
              
              .bulk-print-modal-body {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                padding: 0 !important;
                margin: 0 !important;
                background: white !important;
                overflow: visible !important;
                display: block !important;
              }
              
              .bulk-print-container {
                display: block !important;
                width: 100% !important;
              }
              
              .bulk-print-container > div {
                page-break-after: always !important;
                break-after: page !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                display: block !important;
                width: 100% !important;
              }
              
              /* Hide UI elements */
              .print\\:hidden { display: none !important; }
              .sticky { display: none !important; }
              button { display: none !important; }
            `}
          </style>
        </div>
      )}
    </div>
  );
}
