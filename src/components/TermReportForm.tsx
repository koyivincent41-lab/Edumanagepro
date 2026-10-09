import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { School, Student, Class, Stream, ExamSession, ExamResult, GradingSystem, Subject } from '../types';
import { X, Download, Printer, Loader2, AlertTriangle } from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { printElement } from '../lib/printUtils';

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

        const openerRes = allTermResults.filter(r => r.examsCategory === 'Openar Exams' || r.examsCategory === 'Opener Exams' || r.examType === 'Openar' || r.examType === 'Opener');
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
    const roundedScore = Math.round(score);
    const band = gradingSystem.bands.find(b => roundedScore >= b.minScore && roundedScore <= b.maxScore);
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

  const { teacherComment, principalComment } = React.useMemo(() => {
    if (combinedResults.length === 0) return { teacherComment: '', principalComment: '' };
    
    const name = student.fullName.split(' ')[0];

    const excellentTeacher = [
      `${name} has demonstrated outstanding academic excellence this term. Keep up the phenomenal work!`,
      `An exceptional performance by ${name}! Your dedication to your studies is truly inspiring.`,
      `Brilliant results, ${name}! You have set a great example for your peers.`,
      `${name} is a highly motivated learner. Let's aim even higher next term!`,
      `A pleasure to teach. ${name} consistently produces top-tier work. Keep shining!`
    ];
    
    const excellentPrincipal = [
      `Outstanding achievement! The school is incredibly proud of your hard work, ${name}.`,
      `Excellent term, ${name}. Continue striving for greatness. The sky is your limit.`,
      `A stellar performance. ${name}, your commitment to academic excellence is commendable.`,
      `Superb results! We look forward to seeing your continued success in the future.`,
      `Congratulations on an amazing term, ${name}! You are a true asset to our school.`
    ];

    const goodTeacher = [
      `${name} has performed very well this term. Keep focusing and you will achieve even greater heights.`,
      `A solid performance, ${name}. I am proud of the progress you have made.`,
      `Great work, ${name}! With a little more effort, you can reach the top of the class.`,
      `${name} is a diligent student who has shown great commitment. Well done!`,
      `Good effort this term, ${name}. Keep believing in yourself and keep pushing forward.`
    ];

    const goodPrincipal = [
      `Very good performance, ${name}. I encourage you to keep up the hard work.`,
      `A commendable effort this term. The school believes in your immense potential, ${name}.`,
      `Well done, ${name}! We are happy with your results and know you can achieve even more.`,
      `A successful term! Keep working hard and never stop believing in your abilities.`,
      `Good job, ${name}. Keep focused and continue to chase excellence.`
    ];

    const averageTeacher = [
      `${name} has made a fair effort this term. I encourage you to study harder to unlock your true potential.`,
      `A steady term, ${name}. With more focus and determination, your grades will surely improve.`,
      `${name} has the ability to do much better. Let's work together to achieve higher results next term.`,
      `Keep pushing yourself, ${name}. You are capable of great things if you put in the extra effort.`,
      `A fair performance. I believe in you, ${name}. Let's aim for better results next term.`
    ];

    const averagePrincipal = [
      `A fair attempt, ${name}. The school expects more from you because we know you can do it!`,
      `${name}, your potential is limitless. Focus more on your studies and you will succeed.`,
      `Keep working hard, ${name}. Every step forward is progress. We believe in you.`,
      `You have the capacity to excel, ${name}. Dedicate more time to your studies next term.`,
      `A decent effort, but there is plenty of room for improvement. Keep pushing, ${name}!`
    ];

    const belowAverageTeacher = [
      `This term has been challenging, but I believe in your ability to bounce back, ${name}. Don't give up!`,
      `${name}, your true potential is yet to be seen. Let's work harder and turn things around next term.`,
      `Every setback is a setup for a comeback. Keep your head up, ${name}, and keep trying.`,
      `Results don't define you, ${name}. Let this be motivation to work twice as hard. I am here to help.`,
      `You faced some difficulties this term, but I know you are capable of improving. Believe in yourself, ${name}.`
    ];

    const belowAveragePrincipal = [
      `We believe in you, ${name}. Do not be discouraged; use this as a stepping stone to work harder.`,
      `Success takes time, ${name}. Keep putting in the effort and the results will surely follow.`,
      `The school is here to support you, ${name}. Stay positive and commit more time to your studies.`,
      `You have what it takes to improve, ${name}. Let's make the next term your best one yet!`,
      `Do not lose hope, ${name}. Hard work and perseverance will eventually pay off. Keep pushing forward.`
    ];

    let tComments = [];
    let pComments = [];

    if (finalMean >= 80) {
      tComments = excellentTeacher;
      pComments = excellentPrincipal;
    } else if (finalMean >= 60) {
      tComments = goodTeacher;
      pComments = goodPrincipal;
    } else if (finalMean >= 40) {
      tComments = averageTeacher;
      pComments = averagePrincipal;
    } else {
      tComments = belowAverageTeacher;
      pComments = belowAveragePrincipal;
    }

    let hash = 0;
    const seed = `${student.id}-${term}-${academicYear}`;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const absHash = Math.abs(hash);
    
    return {
      teacherComment: tComments[absHash % tComments.length],
      principalComment: pComments[(absHash + 1) % pComments.length]
    };
  }, [finalMean, student.id, student.fullName, term, academicYear, combinedResults.length]);

  const handlePrint = () => {
    printElement('report-form-print-area', `${student.fullName} - Term Report Form - ${term} ${academicYear}`);
  };

  const handleDownload = async () => {
    const element = document.getElementById('report-form-print-area');
    if (!element) return;

    try {
      element.classList.add('pdf-exporting');
      
      const dataUrl = await toPng(element, {
        quality: 1.0,
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        style: {
          width: '794px',
          minHeight: '1123px',
          boxSizing: 'border-box',
        }
      });

      element.classList.remove('pdf-exporting');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm
      
      // Standard 8mm margin so content fills exactly 194mm printable width on A4
      const marginX = 8;
      const marginY = 8;
      const printableWidth = pdfWidth - (marginX * 2); // 194mm
      const printableHeight = pdfHeight - (marginY * 2); // 281mm

      const imgProps = pdf.getImageProperties(dataUrl);
      const imgRatio = imgProps.width / imgProps.height;

      let finalWidth = printableWidth;
      let finalHeight = printableWidth / imgRatio;

      if (finalHeight > printableHeight) {
        finalHeight = printableHeight;
        finalWidth = printableHeight * imgRatio;
      }

      // Center horizontally and vertically within the A4 page
      const xOffset = (pdfWidth - finalWidth) / 2;
      const yOffset = (pdfHeight - finalHeight) / 2;
      
      pdf.addImage(dataUrl, 'PNG', xOffset, yOffset, finalWidth, finalHeight, undefined, 'FAST');
      pdf.save(`${student.fullName.replace(/\s+/g, '_')}_Report_Form_${term}_${academicYear}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      element.classList.remove('pdf-exporting');
    }
  };

  useEffect(() => {
    if (!loading) {
      if (initialAction === 'print') {
        const timer = setTimeout(handlePrint, 500);
        return () => clearTimeout(timer);
      } else if (initialAction === 'download') {
        const timer = setTimeout(handleDownload, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, initialAction]);

  if (loading) {
    if (isBulkPrint) {
      return (
        <div className="p-8 text-center flex flex-col items-center justify-center min-h-[300px] bg-white rounded-2xl border border-dashed border-gray-200">
          <Loader2 className="animate-spin rounded-full h-8 w-8 text-purple-600 mb-2" />
          <p className="text-sm font-bold text-gray-700">Loading {student.fullName}...</p>
          <p className="text-xs text-gray-400">Adm: {student.admissionNumber}</p>
        </div>
      );
    }
    return <div className="p-4 md:p-8 text-center flex items-center justify-center h-full"><Loader2 className="animate-spin rounded-full h-8 w-8 text-blue-600" /></div>;
  }

  const renderReportCardContent = () => (
    <div className="report-card flex flex-col w-full max-w-full text-gray-900 font-sans bg-white p-0 box-border">
      {/* 1. School Branding & Letterhead */}
      {school && (
        <div className="text-center mb-6">
          {school.logo && (
            <img 
              src={school.logo} 
              alt="School Logo" 
              className="h-20 mx-auto mb-3 object-contain" 
            />
          )}
          <h1 
            className="text-2xl md:text-3xl font-black uppercase tracking-tight" 
            style={{ color: school.primaryColor || '#000000' }}
          >
            {school.name}
          </h1>
          {school.motto && (
            <p className="text-gray-600 italic text-sm mt-0.5 font-medium">"{school.motto}"</p>
          )}
          <p className="text-gray-600 mt-1 text-sm">
            {school.address}
          </p>
          <p className="text-gray-600 text-sm">
            {[
              school.email ? `Email: ${school.email}` : null,
              school.phone ? `Tel: ${school.phone}` : null
            ].filter(Boolean).join(' | ')}
          </p>
        </div>
      )}

      {/* 2. Divider & REPORT FORM Title */}
      <div className="border-b-2 border-gray-800 pb-3 mb-6 w-full text-center">
        <h2 className="text-xl md:text-2xl font-black tracking-widest text-gray-950 uppercase">
          REPORT FORM
        </h2>
      </div>

      {/* 3. Student Profile & Exam Meta Information */}
      <div className="flex justify-between items-start mb-6 text-sm text-gray-800 w-full">
        <div className="space-y-1.5 flex-1 pr-4">
          <p><span className="font-bold text-gray-600">Serial Number:</span> <span className="font-mono font-semibold text-gray-950">{serialNumber}</span></p>
          <p><span className="font-bold text-gray-600">Exam Type:</span> <span className="text-gray-900">End Term Report</span></p>
          <p><span className="font-bold text-gray-600">Term:</span> <span className="text-gray-900">{term}</span></p>
          <p><span className="font-bold text-gray-600">Academic Year:</span> <span className="text-gray-900">{academicYear}</span></p>
        </div>

        {student.photoUrl && (
          <div className="flex-shrink-0 mx-4 border-2 border-gray-200 rounded-md overflow-hidden bg-gray-50 flex items-center justify-center w-24 h-28">
            <img src={student.photoUrl} alt="Student" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="space-y-1.5 text-right flex-1 pl-4">
          <p className="break-words"><span className="font-bold text-gray-600">Learner Name:</span> <span className="font-bold text-base md:text-lg text-gray-950">{student.fullName}</span></p>
          <p className="break-words"><span className="font-bold text-gray-600">Admission Number:</span> <span className="text-gray-900">{student.admissionNumber}</span></p>
          <p className="break-words"><span className="font-bold text-gray-600">Class:</span> <span className="text-gray-900">{studentClass?.name || '—'}</span></p>
          <p className="break-words"><span className="font-bold text-gray-600">Stream:</span> <span className="text-gray-900">{studentStream?.name || '—'}</span></p>
        </div>
      </div>

      {/* 4. Marks Table */}
      <div className="mb-6 w-full">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ backgroundColor: school?.primaryColor ? `${school.primaryColor}20` : '#f3f4f6' }}>
              <th className="p-3 text-left border-b-2 border-gray-300 font-bold text-sm">Subject</th>
              <th className="p-3 text-right border-b-2 border-gray-300 font-bold text-sm whitespace-nowrap">Opener</th>
              <th className="p-3 text-right border-b-2 border-gray-300 font-bold text-sm whitespace-nowrap">Midterm</th>
              <th className="p-3 text-right border-b-2 border-gray-300 font-bold text-sm whitespace-nowrap">End Term</th>
              <th className="p-3 text-right border-b-2 border-gray-300 font-bold text-sm whitespace-nowrap">Total</th>
              <th className="p-3 text-right border-b-2 border-gray-300 font-bold text-sm whitespace-nowrap">Average</th>
              <th className="p-3 text-right border-b-2 border-gray-300 font-bold text-sm whitespace-nowrap">Grade</th>
            </tr>
          </thead>
          <tbody>
            {combinedResults.length > 0 ? (
              combinedResults.map(r => (
                <tr key={r.subjectId} className="border-b border-gray-200">
                  <td className="p-3 text-sm font-medium text-gray-900">{r.subjectName}</td>
                  <td className="p-3 text-right text-sm text-gray-700">{r.opener}</td>
                  <td className="p-3 text-right text-sm text-gray-700">{r.midterm}</td>
                  <td className="p-3 text-right text-sm text-gray-700">{r.endTerm}</td>
                  <td className="p-3 text-right text-sm font-bold text-gray-950">{r.total}</td>
                  <td className="p-3 text-right text-sm font-bold text-gray-900">{r.average.toFixed(1)}%</td>
                  <td className="p-3 text-right text-sm font-bold" style={{ color: school?.primaryColor || '#000000' }}>{r.grade}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500 text-sm">
                  <div className="flex flex-col items-center justify-center text-amber-600">
                    <AlertTriangle className="w-6 h-6 mb-1" />
                    <p className="font-semibold">Incomplete report data for this learner.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Summary Section & Stamp */}
      {combinedResults.length > 0 && (
        <div className="flex flex-row items-center justify-between gap-4 mb-6 w-full">
          <div className="bg-gray-50 p-4 md:p-6 rounded-xl border border-gray-200 relative z-10 flex-1">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-gray-500 font-medium mb-1 text-xs md:text-sm">Total Score</p>
                <p className="text-xl md:text-2xl font-black text-gray-900">{finalTotal} <span className="text-sm text-gray-400 font-normal">/ {maxPossiblePerExam * 3}</span></p>
              </div>
              <div>
                <p className="text-gray-500 font-medium mb-1 text-xs md:text-sm">Average / Mean</p>
                <p className="text-xl md:text-2xl font-black text-gray-900">{finalMean.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium mb-1 text-xs md:text-sm">Final Grade</p>
                <p className="text-xl md:text-2xl font-black" style={{ color: school?.primaryColor || '#000000' }}>{finalGrade || '—'}</p>
              </div>
            </div>
          </div>

          {/* School Seal */}
          <div 
            className="w-32 h-32 shrink-0 rounded-full border-[4px] border-double flex items-center justify-center p-1 opacity-80 rotate-[-15deg] pointer-events-none" 
            style={{ borderColor: school?.primaryColor || '#1e3a8a', color: school?.primaryColor || '#1e3a8a' }}
          >
            <div className="w-full h-full rounded-full border border-dashed flex flex-col items-center justify-center text-center p-2 relative bg-white">
              <div className="font-black text-[7px] uppercase tracking-wider mb-0.5 border-b border-current pb-0.5 w-full truncate px-1">{school?.name}</div>
              <div className="font-bold text-[6px] uppercase text-gray-600">REPORT FORM</div>
              <div className="font-bold text-[6px] uppercase mt-0.5">Adm: {student.admissionNumber}</div>
              <div className="font-bold text-[6px] uppercase">Cls: {studentClass?.name || ''}</div>
              <div className="font-bold text-[6px] uppercase">Str: {studentStream?.name || ''}</div>
              <div className="font-bold text-[6px] uppercase mt-0.5 border-t border-current pt-0.5 w-full">{academicYear}</div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Comments & Dates Section */}
      <div className="space-y-4 pt-4 border-t border-gray-200 text-sm w-full">
        <div>
          <p className="font-bold text-gray-800 mb-1">Class Teacher's Comment:</p>
          <div className="border-b border-dotted border-gray-400 pb-1 text-gray-700 italic min-h-[26px] flex items-center">
            {teacherComment}
          </div>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-1">Principal's Comment:</p>
          <div className="border-b border-dotted border-gray-400 pb-1 text-gray-700 italic min-h-[26px] flex items-center">
            {principalComment}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 pt-4">
          <div className="space-y-4">
            <div className="flex items-end">
              <span className="font-medium text-gray-700 whitespace-nowrap mr-2">Term Closing Date:</span>
              <div className="flex-1 border-b border-dotted border-gray-400"></div>
            </div>
            <div className="flex items-end">
              <span className="font-medium text-gray-700 whitespace-nowrap mr-2">Principal's Signature:</span>
              <div className="flex-1 border-b border-dotted border-gray-400"></div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-end">
              <span className="font-medium text-gray-700 whitespace-nowrap mr-2">Next Term Opening Date:</span>
              <div className="flex-1 border-b border-dotted border-gray-400"></div>
            </div>
            <div className="flex items-end">
              <span className="font-medium text-gray-700 whitespace-nowrap mr-2">Official Stamp & Date:</span>
              <div className="flex-1 border-b border-dotted border-gray-400"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (isBulkPrint) {
    return (
      <div className="bulk-report-card-page relative bg-white w-full max-w-full m-0 p-0" style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
        {renderReportCardContent()}
      </div>
    );
  }

  return (
    <>
      <style type="text/css" media="print">
        {`
          @page { 
            size: A4 portrait; 
            margin: 8mm; 
          }
          html, body {
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          body * { 
            visibility: hidden !important; 
          }
          #report-form-print-area, 
          #report-form-print-area *,
          .report-card,
          .report-card * { 
            visibility: visible !important; 
          }
          .report-card,
          #report-form-print-area { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            max-width: none !important;
            min-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            display: block !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
          }
          .report-card table,
          #report-form-print-area table {
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            box-sizing: border-box !important;
          }
          .report-card th,
          .report-card td,
          #report-form-print-area th,
          #report-form-print-area td {
            box-sizing: border-box !important;
          }
          .report-modal-backdrop {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            display: block !important;
            inset: auto !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .report-modal-box {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .print\\:hidden { 
            display: none !important; 
          }
        `}
      </style>
      <style>
        {`
          .pdf-exporting {
            width: 794px !important; /* Exactly standard A4 width at 96 DPI */
            min-height: 1123px !important; /* Exactly standard A4 height at 96 DPI */
            max-width: none !important;
            padding: 24px 28px !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            transform: none !important;
          }
        `}
      </style>
      <div className="report-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:p-0 print:bg-white print:block print:static print:inset-auto">
        <div className="report-modal-box bg-white rounded-3xl shadow-2xl w-[calc(100%-2rem)] md:w-full max-w-5xl p-4 md:p-8 max-h-[92vh] overflow-y-auto print:shadow-none print:max-w-none print:max-h-none print:p-0 print:overflow-visible print:static">
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
          
          {/* Printable Area - renders the exact unified large content */}
          <div className="print-area relative bg-white w-full max-w-full m-0 p-0" id="report-form-print-area">
            {renderReportCardContent()}
          </div>
        </div>
      </div>
    </>
  );
}
