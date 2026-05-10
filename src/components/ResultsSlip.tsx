import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Student, Subject, ExamResult, ExamSession, School, Class, Stream, GradingSystem } from '../types';
import { X, Download, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';

export default function ResultsSlip({ student, examSessionId, schoolId, initialAction = 'view', onClose }: { student: Student, examSessionId: string, schoolId: string, initialAction?: 'view' | 'download' | 'print', onClose: () => void }) {
  const [school, setSchool] = useState<School | null>(null);
  const [examSession, setExamSession] = useState<ExamSession | null>(null);
  const [studentClass, setStudentClass] = useState<Class | null>(null);
  const [studentStream, setStudentStream] = useState<Stream | null>(null);
  const [results, setResults] = useState<(ExamResult & { subjectName: string })[]>([]);
  const [gradingSystem, setGradingSystem] = useState<GradingSystem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch school branding
        const schoolDoc = await getDoc(doc(db, 'schools', schoolId));
        if (schoolDoc.exists()) setSchool(schoolDoc.data() as School);

        // Fetch exam session
        const sessionDoc = await getDoc(doc(db, 'exam_sessions', examSessionId));
        if (sessionDoc.exists()) setExamSession(sessionDoc.data() as ExamSession);

        // Fetch class
        if (student.classId) {
          const classDoc = await getDoc(doc(db, 'schools', schoolId, 'classes', student.classId));
          if (classDoc.exists()) setStudentClass(classDoc.data() as Class);
        }

        // Fetch stream
        if (student.streamId) {
          const streamDoc = await getDoc(doc(db, 'schools', schoolId, 'streams', student.streamId));
          if (streamDoc.exists()) setStudentStream(streamDoc.data() as Stream);
        }

        // Fetch grading system
        const gradingQ = query(collection(db, 'grading_systems'), where('schoolId', '==', schoolId));
        const gradingSnap = await getDocs(gradingQ);
        if (!gradingSnap.empty) setGradingSystem(gradingSnap.docs[0].data() as GradingSystem);

        // Fetch subjects
        const subjectsQ = query(collection(db, 'subjects'), where('schoolId', '==', schoolId));
        const subjectsSnap = await getDocs(subjectsQ);
        const subjectsMap = new Map<string, string>();
        subjectsSnap.docs.forEach(d => subjectsMap.set(d.id, d.data().name));

        // Fetch results
        const resultsQ = query(collection(db, 'exam_results'), 
          where('studentId', '==', student.id),
          where('examSessionId', '==', examSessionId)
        );
        const resultsSnap = await getDocs(resultsQ);
        const fetchedResults = resultsSnap.docs.map(d => {
          const data = d.data() as ExamResult;
          return {
            ...data,
            subjectName: subjectsMap.get(data.subjectId) || data.subjectId
          };
        });
        setResults(fetchedResults);
      } catch (error) {
        console.error("Error fetching results slip data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [student.id, student.classId, student.streamId, examSessionId, schoolId]);

  const totalScore = results.reduce((sum, r) => sum + (Number(r.scoreObtained) || 0), 0);
  const totalMax = results.reduce((sum, r) => sum + (Number(r.maximumScore) || 0), 0);
  const average = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

  let finalGrade = '';
  if (gradingSystem && gradingSystem.bands) {
    const band = gradingSystem.bands.find(b => average >= b.minScore && average <= b.maxScore);
    if (band) finalGrade = band.gradeName;
  }

  let displayExamType = examSession?.examType || 'Exam';
  if (results.length > 0 && results[0].examsCategory) {
    displayExamType = results[0].examsCategory;
  } else if (examSession?.examType) {
    if (examSession.examType === 'Openar' || examSession.examType === 'Opener') displayExamType = 'Openar Exams';
    else if (examSession.examType === 'Midterm') displayExamType = 'Midterm Exams';
    else if (examSession.examType === 'End Term') displayExamType = 'End Term Exams';
  }

  // Generate a deterministic 6-character serial number
  const generateSerialNumber = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let serial = '';
    let num = Math.abs(hash);
    for (let i = 0; i < 6; i++) {
      serial += chars[num % chars.length];
      num = Math.floor(num / chars.length);
    }
    return serial;
  };

  const serialNumber = generateSerialNumber(`${student.id}-${examSessionId}`);

  const handleDownload = async () => {
    const printArea = document.getElementById('results-slip-print-area');
    if (!printArea) return;

    try {
      // Add a class temporarily to ensure it renders well for the image
      printArea.classList.add('pdf-exporting');
      
      const dataUrl = await toPng(printArea, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        style: {
          margin: '0',
          padding: '20px',
          boxShadow: 'none',
          borderRadius: '0'
        }
      });
      
      printArea.classList.remove('pdf-exporting');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(dataUrl);
      const imgRatio = imgProps.width / imgProps.height;
      
      let finalWidth = pdfWidth - 20; // 10mm margin on each side
      let finalHeight = finalWidth / imgRatio;

      if (finalHeight > pdfHeight - 20) {
        finalHeight = pdfHeight - 20;
        finalWidth = finalHeight * imgRatio;
      }

      pdf.addImage(dataUrl, 'PNG', 10, 10, finalWidth, finalHeight);
      pdf.save(`ResultsSlip_${student.admissionNumber}_${examSession?.examType || 'Exam'}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    if (!loading) {
      if (initialAction === 'download') {
        handleDownload();
      } else if (initialAction === 'print') {
        setTimeout(() => {
          handlePrint();
        }, 500);
      }
    }
  }, [loading, initialAction]);

  if (loading) return <div className="p-8 text-center flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>;

  return (
    <>
      <style type="text/css" media="print">
        {`
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            margin: 20mm;
          }
        `}
      </style>
      <style>
        {`
          .pdf-exporting {
            width: 800px !important;
            max-width: none !important;
            padding: 40px !important;
            background: white !important;
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            transform: none !important;
          }
        `}
      </style>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:p-0 print:bg-white print:block print:relative print:inset-auto">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl p-8 max-h-[90vh] overflow-y-auto print:shadow-none print:max-w-none print:max-h-none print:p-0 print:overflow-visible">
          <div className="flex justify-between items-center mb-6 print:hidden">
          <h2 className="text-xl font-black">Results Slip Preview</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" title="Print">
              <Printer className="h-5 w-5" />
            </button>
            <button onClick={handleDownload} className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors" title="Download PDF">
              <Download className="h-5 w-5" />
            </button>
            <button onClick={onClose} className="p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors" title="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Printable Area */}
        <div className="print-area relative bg-white" id="results-slip-print-area">
          {school && (
            <div className="text-center mb-8">
              {school.logo && <img src={school.logo} alt="School Logo" className="h-16 mx-auto mb-4 object-contain" />}
              <h1 className="text-3xl font-black" style={{ color: school.primaryColor || '#000000' }}>{school.name}</h1>
              <p className="text-gray-600 mt-1">{school.address}</p>
              <p className="text-gray-600">{school.email} | {school.phone}</p>
            </div>
          )}

          <div className="border-b-2 border-gray-800 pb-4 mb-6">
            <h2 className="text-2xl font-black text-center tracking-widest">RESULTS SLIP</h2>
          </div>
          
          <div className="flex justify-between items-start mb-8 text-sm">
            <div className="space-y-2 flex-1 pr-4">
              <p><span className="font-bold text-gray-600">Serial Number:</span> <span className="font-mono font-semibold">{serialNumber}</span></p>
              <p><span className="font-bold text-gray-600">Exam Type:</span> {displayExamType}</p>
              <p><span className="font-bold text-gray-600">Term:</span> {examSession?.term}</p>
              <p><span className="font-bold text-gray-600">Academic Year:</span> {examSession?.academicYear}</p>
            </div>

            {student.photoUrl && (
              <div className="flex-shrink-0 mx-4 border-2 border-gray-200 rounded-md overflow-hidden bg-gray-50 flex items-center justify-center w-24 h-28">
                <img src={student.photoUrl} alt="Student" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="space-y-2 text-right flex-1 pl-4">
              <p className="break-words"><span className="font-bold text-gray-600">Learner Name:</span> <span className="font-bold text-lg">{student.fullName}</span></p>
              <p className="break-words"><span className="font-bold text-gray-600">Admission Number:</span> {student.admissionNumber}</p>
              <p className="break-words"><span className="font-bold text-gray-600">Class:</span> {studentClass?.name || ''}</p>
              <p className="break-words"><span className="font-bold text-gray-600">Stream:</span> {studentStream?.name || ''}</p>
            </div>
          </div>

          <table className="w-full mb-8 border-collapse">
            <thead>
              <tr style={{ backgroundColor: school?.primaryColor ? `${school.primaryColor}20` : '#f3f4f6' }}>
                <th className="p-3 text-left border-b-2 border-gray-300 font-bold">Subject</th>
                <th className="p-3 text-right border-b-2 border-gray-300 font-bold whitespace-nowrap">Score</th>
                <th className="p-3 text-right border-b-2 border-gray-300 font-bold whitespace-nowrap">Max Marks</th>
              </tr>
            </thead>
            <tbody>
              {results.length > 0 ? (
                results.map(r => (
                  <tr key={r.subjectId} className="border-b border-gray-200">
                    <td className="p-3">{r.subjectName}</td>
                    <td className="p-3 text-right font-semibold">{r.scoreObtained}</td>
                    <td className="p-3 text-right text-gray-500">{r.maximumScore}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-gray-500">No marks recorded for this exam session.</td>
                </tr>
              )}
            </tbody>
          </table>

          {results.length > 0 && (
            <div className="flex items-center justify-between gap-6">
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 relative z-10 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div>
                    <p className="text-gray-500 font-medium mb-1">Total Score</p>
                    <p className="text-2xl font-black">{totalScore} <span className="text-lg text-gray-400 font-normal">/ {totalMax}</span></p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-medium mb-1">Average / Mean</p>
                    <p className="text-2xl font-black">{average.toFixed(2)}%</p>
                  </div>
                  {finalGrade && (
                    <div>
                      <p className="text-gray-500 font-medium mb-1">Final Grade</p>
                      <p className="text-2xl font-black" style={{ color: school?.primaryColor || '#000000' }}>{finalGrade}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* School Seal */}
              <div 
                className="w-32 h-32 shrink-0 rounded-full border-[4px] border-double flex items-center justify-center p-1 opacity-80 rotate-[-15deg] pointer-events-none" 
                style={{ borderColor: school?.primaryColor || '#1e3a8a', color: school?.primaryColor || '#1e3a8a' }}
              >
                <div className="w-full h-full rounded-full border border-dashed flex flex-col items-center justify-center text-center p-2 relative bg-white">
                  <div className="font-black text-[7px] uppercase tracking-wider mb-0.5 border-b border-current pb-0.5 w-full truncate px-1">{school?.name}</div>
                  <div className="font-bold text-[6px] uppercase text-gray-600">OFFICIAL RESULTS</div>
                  <div className="font-bold text-[6px] uppercase mt-0.5">Adm: {student.admissionNumber}</div>
                  <div className="font-bold text-[6px] uppercase">Cls: {studentClass?.name || ''}</div>
                  <div className="font-bold text-[6px] uppercase">Str: {studentStream?.name || ''}</div>
                  <div className="font-bold text-[6px] uppercase mt-0.5 border-t border-current pt-0.5 w-full">{examSession?.academicYear}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
