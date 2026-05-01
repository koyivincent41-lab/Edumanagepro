import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { School, Student, Class, Stream, ExamSession, ExamResult, GradingSystem, Subject } from '../types';
import { X, Download, Printer, Loader2, AlertTriangle } from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

interface TermReportFormProps {
  student: Student;
  term: string;
  academicYear: string;
  schoolId: string;
  initialAction?: 'view' | 'download' | 'print' | 'bulk-print';
  onClose?: () => void;
  onLoad?: () => void;
  isBulkPrint?: boolean;
}

export default function TermReportForm({ student, term, academicYear, schoolId, initialAction = 'view', onClose, onLoad, isBulkPrint = false }: TermReportFormProps) {
  const [school, setSchool] = useState<School | null>(null);
  const [studentClass, setStudentClass] = useState<Class | null>(null);
  const [studentStream, setStudentStream] = useState<Stream | null>(null);
  const [gradingSystem, setGradingSystem] = useState<GradingSystem | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  const [openerResults, setOpenerResults] = useState<ExamResult[]>([]);
  const [midtermResults, setMidtermResults] = useState<ExamResult[]>([]);
  const [endTermResults, setEndTermResults] = useState<ExamResult[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [serialNumber, setSerialNumber] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch School
        const schoolDoc = await getDoc(doc(db, 'schools', schoolId));
        if (schoolDoc.exists()) setSchool({ id: schoolDoc.id, ...schoolDoc.data() } as School);

        // 2. Fetch Class & Stream
        if (student.classId) {
          const classDoc = await getDoc(doc(db, 'schools', schoolId, 'classes', student.classId));
          if (classDoc.exists()) setStudentClass({ id: classDoc.id, ...classDoc.data() } as Class);
        }
        if (student.streamId) {
          const streamDoc = await getDoc(doc(db, 'schools', schoolId, 'streams', student.streamId));
          if (streamDoc.exists()) setStudentStream({ id: streamDoc.id, ...streamDoc.data() } as Stream);
        }

        // 3. Fetch Grading System
        const gradingQ = query(collection(db, 'grading_systems'), where('schoolId', '==', schoolId));
        const gradingSnap = await getDocs(gradingQ);
        if (!gradingSnap.empty) {
          setGradingSystem({ id: gradingSnap.docs[0].id, ...gradingSnap.docs[0].data() } as GradingSystem);
        }

        // 4. Fetch Subjects
        const subjectsQ = query(collection(db, 'subjects'), where('schoolId', '==', schoolId));
        const subjectsSnap = await getDocs(subjectsQ);
        const subjectsData = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));
        setSubjects(subjectsData);

        // 5. Fetch Results for the term and year
        const resQ = query(
          collection(db, 'exam_results'),
          where('studentId', '==', student.id),
          where('term', '==', term),
          where('academicYear', '==', academicYear)
        );
        const resSnap = await getDocs(resQ);
        const allTermResults = resSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResult));

        const openerRes = allTermResults.filter(r => r.examsCategory === 'Openar Exams' || r.examType === 'Openar' || r.examType === 'Opener');
        const midtermRes = allTermResults.filter(r => r.examsCategory === 'Midterm Exams' || r.examType === 'Midterm');
        const endTermRes = allTermResults.filter(r => r.examsCategory === 'End Term Exams' || r.examType === 'End Term');

        setOpenerResults(openerRes);
        setMidtermResults(midtermRes);
        setEndTermResults(endTermRes);

        // 6. Generate Serial Number
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
        setSerialNumber(generateSerialNumber(`${student.id}-${term}-${academicYear}`));

      } catch (error) {
        console.error("Error fetching report form data:", error);
      } finally {
        setLoading(false);
        if (onLoad) onLoad();
      }
    };

    fetchData();
  }, [student, term, academicYear, schoolId]);

  const getGrade = (score: number) => {
    if (!gradingSystem || !gradingSystem.bands) return '';
    const band = gradingSystem.bands.find(b => score >= b.minScore && score <= b.maxScore);
    return band ? band.gradeName : '';
  };

  // Calculate combined data
  const allSubjectIds = new Set([
    ...openerResults.map(r => r.subjectId),
    ...midtermResults.map(r => r.subjectId),
    ...endTermResults.map(r => r.subjectId)
  ]);

  const combinedResults = Array.from(allSubjectIds).map(subjectId => {
    const subject = subjects.find(s => s.id === subjectId);
    const opener = openerResults.find(r => r.subjectId === subjectId)?.scoreObtained || 0;
    const midterm = midtermResults.find(r => r.subjectId === subjectId)?.scoreObtained || 0;
    const endTerm = endTermResults.find(r => r.subjectId === subjectId)?.scoreObtained || 0;
    
    const total = opener + midterm + endTerm;
    const average = total / 3;
    const grade = getGrade(average);

    return {
      subjectId,
      subjectName: subject?.name || 'Unknown Subject',
      opener,
      midterm,
      endTerm,
      total,
      average,
      grade
    };
  }).sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  // Summary calculations
  const numSubjects = combinedResults.length;
  const maxPossiblePerExam = numSubjects * 100;

  const openerTotal = combinedResults.reduce((sum, r) => sum + r.opener, 0);
  const midtermTotal = combinedResults.reduce((sum, r) => sum + r.midterm, 0);
  const endTermTotal = combinedResults.reduce((sum, r) => sum + r.endTerm, 0);

  const openerMean = numSubjects > 0 ? openerTotal / numSubjects : 0;
  const midtermMean = numSubjects > 0 ? midtermTotal / numSubjects : 0;
  const endTermMean = numSubjects > 0 ? endTermTotal / numSubjects : 0;

  const finalTotal = openerTotal + midtermTotal + endTermTotal;
  const finalMean = numSubjects > 0 ? finalTotal / (numSubjects * 3) : 0;
  const finalGrade = getGrade(finalMean);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    const element = document.getElementById('report-form-print-area');
    if (!element) return;

    try {
      element.classList.add('pdf-exporting');
      
      const dataUrl = await toPng(element, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: '800px',
        }
      });

      element.classList.remove('pdf-exporting');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(dataUrl);
      const imgRatio = imgProps.width / imgProps.height;
      const pdfRatio = pdfWidth / pdfHeight;

      let finalWidth = pdfWidth;
      let finalHeight = pdfWidth / imgRatio;

      if (finalHeight > pdfHeight) {
        finalHeight = pdfHeight;
        finalWidth = pdfHeight * imgRatio;
      }

      const xOffset = (pdfWidth - finalWidth) / 2;
      
      pdf.addImage(dataUrl, 'PNG', xOffset, 10, finalWidth, finalHeight);
      pdf.save(`${student.fullName.replace(/\s+/g, '_')}_Report_Form_${term}_${academicYear}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      element.classList.remove('pdf-exporting');
    }
  };

  useEffect(() => {
    if (!loading) {
      if (initialAction === 'print') {
        setTimeout(handlePrint, 500);
      } else if (initialAction === 'download') {
        setTimeout(handleDownload, 500);
      }
    }
  }, [loading, initialAction]);

  if (loading) {
    if (isBulkPrint) return null;
    return <div className="p-8 text-center flex items-center justify-center h-full"><Loader2 className="animate-spin rounded-full h-8 w-8 text-blue-600" /></div>;
  }

  if (isBulkPrint) {
    return (
      <div className="print-area relative bg-white" style={{ pageBreakAfter: 'always' }}>
        {school && (
          <div className="text-center mb-4">
            {school.logo && <img src={school.logo} alt="School Logo" className="h-14 mx-auto mb-2 object-contain" />}
            <h1 className="text-2xl font-black" style={{ color: school.primaryColor || '#000000' }}>{school.name}</h1>
            <p className="text-gray-600 mt-1 text-sm">{school.address}</p>
            <p className="text-gray-600 text-sm">{school.email} | {school.phone}</p>
          </div>
        )}

        <div className="border-b-2 border-gray-800 pb-2 mb-4">
          <h2 className="text-xl font-black text-center tracking-widest">REPORT FORM</h2>
        </div>
        
        <div className="flex justify-between items-start mb-6 text-sm">
          <div className="space-y-1 flex-1 pr-4">
            <p><span className="font-bold text-gray-600">Serial Number:</span> <span className="font-mono font-semibold">{serialNumber}</span></p>
            <p><span className="font-bold text-gray-600">Exam Type:</span> End Term Report</p>
            <p><span className="font-bold text-gray-600">Term:</span> {term}</p>
            <p><span className="font-bold text-gray-600">Academic Year:</span> {academicYear}</p>
          </div>
          <div className="space-y-1 text-right flex-1 pl-4">
            <p className="break-words"><span className="font-bold text-gray-600">Learner Name:</span> <span className="font-bold text-base">{student.fullName}</span></p>
            <p className="break-words"><span className="font-bold text-gray-600">Admission Number:</span> {student.admissionNumber}</p>
            <p className="break-words"><span className="font-bold text-gray-600">Class:</span> {studentClass?.name || ''}</p>
            <p className="break-words"><span className="font-bold text-gray-600">Stream:</span> {studentStream?.name || ''}</p>
          </div>
        </div>

        <table className="w-full mb-6 border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: school?.primaryColor ? `${school.primaryColor}20` : '#f3f4f6' }}>
              <th className="p-2 text-left border-b-2 border-gray-300 font-bold">Subject</th>
              <th className="p-2 text-right border-b-2 border-gray-300 font-bold">Openar</th>
              <th className="p-2 text-right border-b-2 border-gray-300 font-bold">Midterm</th>
              <th className="p-2 text-right border-b-2 border-gray-300 font-bold">End Term</th>
              <th className="p-2 text-right border-b-2 border-gray-300 font-bold">Total</th>
              <th className="p-2 text-right border-b-2 border-gray-300 font-bold">Average</th>
              <th className="p-2 text-right border-b-2 border-gray-300 font-bold">Grade</th>
            </tr>
          </thead>
          <tbody>
            {combinedResults.length > 0 ? (
              combinedResults.map(r => (
                <tr key={r.subjectId} className="border-b border-gray-200">
                  <td className="p-2">{r.subjectName}</td>
                  <td className="p-2 text-right">{r.opener}</td>
                  <td className="p-2 text-right">{r.midterm}</td>
                  <td className="p-2 text-right">{r.endTerm}</td>
                  <td className="p-2 text-right font-semibold">{r.total}</td>
                  <td className="p-2 text-right">{r.average.toFixed(1)}%</td>
                  <td className="p-2 text-right font-bold" style={{ color: school?.primaryColor || '#000000' }}>{r.grade}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-8 text-center">
                  <div className="flex flex-col items-center justify-center text-amber-600">
                    <AlertTriangle className="w-8 h-8 mb-2" />
                    <p className="font-bold">Incomplete report data for this learner.</p>
                    <p className="text-xs text-amber-500 mt-1">No exam marks found for the selected term and year.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {combinedResults.length > 0 && (
          <div className="flex flex-col gap-4">
            {/* Summary Section */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <h3 className="text-center font-bold text-gray-700 mb-2 uppercase tracking-wider text-xs">Term Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <p className="text-gray-500 font-medium text-[10px] uppercase">Openar Exams</p>
                  <p className="text-base font-bold">{openerTotal} <span className="text-xs text-gray-400 font-normal">/ {maxPossiblePerExam}</span></p>
                  <p className="text-xs text-gray-600">Mean: <span className="font-semibold">{openerMean.toFixed(1)}%</span></p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 font-medium text-[10px] uppercase">Midterm Exams</p>
                  <p className="text-base font-bold">{midtermTotal} <span className="text-xs text-gray-400 font-normal">/ {maxPossiblePerExam}</span></p>
                  <p className="text-xs text-gray-600">Mean: <span className="font-semibold">{midtermMean.toFixed(1)}%</span></p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 font-medium text-[10px] uppercase">End Term Exams</p>
                  <p className="text-base font-bold">{endTermTotal} <span className="text-xs text-gray-400 font-normal">/ {maxPossiblePerExam}</span></p>
                  <p className="text-xs text-gray-600">Mean: <span className="font-semibold">{endTermMean.toFixed(1)}%</span></p>
                </div>
              </div>
            </div>

            {/* Final Grade Section */}
            <div className="flex items-center justify-between gap-4">
              <div className="bg-gray-100 p-4 rounded-xl border border-gray-300 flex-1 flex items-center justify-around">
                <div className="text-center">
                  <p className="text-gray-500 font-medium mb-1 uppercase text-[10px] tracking-wider">Final Mean</p>
                  <p className="text-2xl font-black">{finalMean.toFixed(2)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500 font-medium mb-1 uppercase text-[10px] tracking-wider">Final Grade</p>
                  <p className="text-3xl font-black" style={{ color: school?.primaryColor || '#000000' }}>{finalGrade}</p>
                </div>
              </div>

              {/* School Seal */}
              <div 
                className="w-24 h-24 shrink-0 rounded-full border-[3px] border-double flex items-center justify-center p-1 opacity-80 rotate-[-15deg] pointer-events-none" 
                style={{ borderColor: school?.primaryColor || '#1e3a8a', color: school?.primaryColor || '#1e3a8a' }}
              >
                <div className="w-full h-full rounded-full border border-dashed flex flex-col items-center justify-center text-center p-1 relative bg-white">
                  <div className="font-black text-[6px] uppercase tracking-wider mb-0.5 border-b border-current pb-0.5 w-full truncate px-1">{school?.name}</div>
                  <div className="font-bold text-[5px] uppercase text-gray-600">REPORT FORM</div>
                  <div className="font-bold text-[5px] uppercase mt-0.5">Adm: {student.admissionNumber}</div>
                  <div className="font-bold text-[5px] uppercase">Cls: {studentClass?.name || ''}</div>
                  <div className="font-bold text-[5px] uppercase">Str: {studentStream?.name || ''}</div>
                  <div className="font-bold text-[5px] uppercase mt-0.5 border-t border-current pt-0.5 w-full">{academicYear}</div>
                </div>
              </div>
            </div>

            {/* Manual Comments Section */}
            <div className="mt-4 pt-4 border-t-2 border-gray-200">
              <div className="grid grid-cols-1 gap-6 text-sm">
                <div className="flex items-end">
                  <span className="font-bold text-gray-700 whitespace-nowrap mr-2">Class Teacher's Comment:</span>
                  <div className="flex-1 border-b border-gray-400 border-dashed"></div>
                </div>
                <div className="flex items-end">
                  <span className="font-bold text-gray-700 whitespace-nowrap mr-2">Principal's Comment:</span>
                  <div className="flex-1 border-b border-gray-400 border-dashed"></div>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div className="flex items-end">
                    <span className="font-bold text-gray-700 whitespace-nowrap mr-2">Closing Date:</span>
                    <div className="flex-1 border-b border-gray-400 border-dashed"></div>
                  </div>
                  <div className="flex items-end">
                    <span className="font-bold text-gray-700 whitespace-nowrap mr-2">Opening Date:</span>
                    <div className="flex-1 border-b border-gray-400 border-dashed"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <style type="text/css" media="print">
        {`
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          @page { margin: 20mm; }
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
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl p-8 max-h-[90vh] overflow-y-auto print:shadow-none print:max-w-none print:max-h-none print:p-0 print:overflow-visible">
          <div className="flex justify-between items-center mb-6 print:hidden">
            <h2 className="text-xl font-black">Term Report Form Preview</h2>
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
          <div className="print-area relative bg-white" id="report-form-print-area">
            {school && (
              <div className="text-center mb-4">
                {school.logo && <img src={school.logo} alt="School Logo" className="h-14 mx-auto mb-2 object-contain" />}
                <h1 className="text-2xl font-black" style={{ color: school.primaryColor || '#000000' }}>{school.name}</h1>
                <p className="text-gray-600 mt-1 text-sm">{school.address}</p>
                <p className="text-gray-600 text-sm">{school.email} | {school.phone}</p>
              </div>
            )}

            <div className="border-b-2 border-gray-800 pb-2 mb-4">
              <h2 className="text-xl font-black text-center tracking-widest">REPORT FORM</h2>
            </div>
            
            <div className="flex justify-between items-start mb-6 text-sm">
              <div className="space-y-1 flex-1 pr-4">
                <p><span className="font-bold text-gray-600">Serial Number:</span> <span className="font-mono font-semibold">{serialNumber}</span></p>
                <p><span className="font-bold text-gray-600">Exam Type:</span> End Term Report</p>
                <p><span className="font-bold text-gray-600">Term:</span> {term}</p>
                <p><span className="font-bold text-gray-600">Academic Year:</span> {academicYear}</p>
              </div>
              <div className="space-y-1 text-right flex-1 pl-4">
                <p className="break-words"><span className="font-bold text-gray-600">Learner Name:</span> <span className="font-bold text-base">{student.fullName}</span></p>
                <p className="break-words"><span className="font-bold text-gray-600">Admission Number:</span> {student.admissionNumber}</p>
                <p className="break-words"><span className="font-bold text-gray-600">Class:</span> {studentClass?.name || ''}</p>
                <p className="break-words"><span className="font-bold text-gray-600">Stream:</span> {studentStream?.name || ''}</p>
              </div>
            </div>

            <table className="w-full mb-6 border-collapse text-sm">
              <thead>
                <tr style={{ backgroundColor: school?.primaryColor ? `${school.primaryColor}20` : '#f3f4f6' }}>
                  <th className="p-2 text-left border-b-2 border-gray-300 font-bold">Subject</th>
                  <th className="p-2 text-right border-b-2 border-gray-300 font-bold">Openar</th>
                  <th className="p-2 text-right border-b-2 border-gray-300 font-bold">Midterm</th>
                  <th className="p-2 text-right border-b-2 border-gray-300 font-bold">End Term</th>
                  <th className="p-2 text-right border-b-2 border-gray-300 font-bold">Total</th>
                  <th className="p-2 text-right border-b-2 border-gray-300 font-bold">Average</th>
                  <th className="p-2 text-right border-b-2 border-gray-300 font-bold">Grade</th>
                </tr>
              </thead>
              <tbody>
                {combinedResults.length > 0 ? (
                  combinedResults.map(r => (
                    <tr key={r.subjectId} className="border-b border-gray-200">
                      <td className="p-2">{r.subjectName}</td>
                      <td className="p-2 text-right">{r.opener}</td>
                      <td className="p-2 text-right">{r.midterm}</td>
                      <td className="p-2 text-right">{r.endTerm}</td>
                      <td className="p-2 text-right font-semibold">{r.total}</td>
                      <td className="p-2 text-right">{r.average.toFixed(1)}%</td>
                      <td className="p-2 text-right font-bold" style={{ color: school?.primaryColor || '#000000' }}>{r.grade}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-gray-500">No marks recorded for this term.</td>
                  </tr>
                )}
              </tbody>
            </table>

            {combinedResults.length > 0 && (
              <div className="flex flex-col gap-4">
                {/* Summary Section */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <h3 className="text-center font-bold text-gray-700 mb-2 uppercase tracking-wider text-xs">Term Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="space-y-1">
                      <p className="text-gray-500 font-medium text-[10px] uppercase">Openar Exams</p>
                      <p className="text-base font-bold">{openerTotal} <span className="text-xs text-gray-400 font-normal">/ {maxPossiblePerExam}</span></p>
                      <p className="text-xs text-gray-600">Mean: <span className="font-semibold">{openerMean.toFixed(1)}%</span></p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-500 font-medium text-[10px] uppercase">Midterm Exams</p>
                      <p className="text-base font-bold">{midtermTotal} <span className="text-xs text-gray-400 font-normal">/ {maxPossiblePerExam}</span></p>
                      <p className="text-xs text-gray-600">Mean: <span className="font-semibold">{midtermMean.toFixed(1)}%</span></p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-500 font-medium text-[10px] uppercase">End Term Exams</p>
                      <p className="text-base font-bold">{endTermTotal} <span className="text-xs text-gray-400 font-normal">/ {maxPossiblePerExam}</span></p>
                      <p className="text-xs text-gray-600">Mean: <span className="font-semibold">{endTermMean.toFixed(1)}%</span></p>
                    </div>
                  </div>
                </div>

                {/* Final Grade Section */}
                <div className="flex items-center justify-between gap-4">
                  <div className="bg-gray-100 p-4 rounded-xl border border-gray-300 flex-1 flex items-center justify-around">
                    <div className="text-center">
                      <p className="text-gray-500 font-medium mb-1 uppercase text-[10px] tracking-wider">Final Mean</p>
                      <p className="text-2xl font-black">{finalMean.toFixed(2)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 font-medium mb-1 uppercase text-[10px] tracking-wider">Final Grade</p>
                      <p className="text-3xl font-black" style={{ color: school?.primaryColor || '#000000' }}>{finalGrade}</p>
                    </div>
                  </div>

                  {/* School Seal */}
                  <div 
                    className="w-24 h-24 shrink-0 rounded-full border-[3px] border-double flex items-center justify-center p-1 opacity-80 rotate-[-15deg] pointer-events-none" 
                    style={{ borderColor: school?.primaryColor || '#1e3a8a', color: school?.primaryColor || '#1e3a8a' }}
                  >
                    <div className="w-full h-full rounded-full border border-dashed flex flex-col items-center justify-center text-center p-1 relative bg-white">
                      <div className="font-black text-[6px] uppercase tracking-wider mb-0.5 border-b border-current pb-0.5 w-full truncate px-1">{school?.name}</div>
                      <div className="font-bold text-[5px] uppercase text-gray-600">REPORT FORM</div>
                      <div className="font-bold text-[5px] uppercase mt-0.5">Adm: {student.admissionNumber}</div>
                      <div className="font-bold text-[5px] uppercase">Cls: {studentClass?.name || ''}</div>
                      <div className="font-bold text-[5px] uppercase">Str: {studentStream?.name || ''}</div>
                      <div className="font-bold text-[5px] uppercase mt-0.5 border-t border-current pt-0.5 w-full">{academicYear}</div>
                    </div>
                  </div>
                </div>

                {/* Manual Comments Section */}
                <div className="mt-4 pt-4 border-t-2 border-gray-200">
                  <div className="grid grid-cols-1 gap-6 text-sm">
                    <div className="flex items-end">
                      <span className="font-bold text-gray-700 whitespace-nowrap mr-2">Class Teacher's Comment:</span>
                      <div className="flex-1 border-b border-gray-400 border-dashed"></div>
                    </div>
                    <div className="flex items-end">
                      <span className="font-bold text-gray-700 whitespace-nowrap mr-2">Principal's Comment:</span>
                      <div className="flex-1 border-b border-gray-400 border-dashed"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="flex items-end">
                        <span className="font-bold text-gray-700 whitespace-nowrap mr-2">Closing Date:</span>
                        <div className="flex-1 border-b border-gray-400 border-dashed"></div>
                      </div>
                      <div className="flex items-end">
                        <span className="font-bold text-gray-700 whitespace-nowrap mr-2">Opening Date:</span>
                        <div className="flex-1 border-b border-gray-400 border-dashed"></div>
                      </div>
                    </div>
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
