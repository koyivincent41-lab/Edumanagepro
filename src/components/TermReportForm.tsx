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

  // Dynamic sizing logic to ensure it fits on one page
  const isCompact = numSubjects > 5;
  const isVeryCompact = numSubjects > 7;

  const tableTextClass = isVeryCompact ? 'text-[9px]' : isCompact ? 'text-[10px]' : 'text-xs';
  const tablePaddingClass = isVeryCompact ? 'p-0.5' : isCompact ? 'p-1' : 'p-2';
  const sectionGapClass = isVeryCompact ? 'gap-1' : isCompact ? 'gap-2' : 'gap-4';
  const summaryPaddingClass = isVeryCompact ? 'p-1' : isCompact ? 'p-2' : 'p-4';
  const commentGapClass = isVeryCompact ? 'gap-2' : isCompact ? 'gap-3' : 'gap-6';
  const headerMarginClass = isVeryCompact ? 'mb-1' : isCompact ? 'mb-2' : 'mb-4';
  const sectionMarginClass = isVeryCompact ? 'mb-1' : isCompact ? 'mb-3' : 'mb-6';

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
    return <div className="p-4 md:p-8 text-center flex items-center justify-center h-full"><Loader2 className="animate-spin rounded-full h-8 w-8 text-blue-600" /></div>;
  }

  if (isBulkPrint) {
    return (
      <div className={`print-area relative bg-white ${isVeryCompact ? 'compact-report' : ''}`} style={{ pageBreakAfter: 'always' }}>
        {school && (
          <div className={`text-center ${headerMarginClass}`}>
            {school.logo && <img src={school.logo} alt="School Logo" className={`${isVeryCompact ? 'h-10' : 'h-14'} mx-auto mb-1 object-contain`} />}
            <h1 className={`${isVeryCompact ? 'text-xl' : 'text-2xl'} font-black`} style={{ color: school.primaryColor || '#000000' }}>{school.name}</h1>
            <p className="text-gray-600 mt-0.5 text-xs">{school.address}</p>
            <p className="text-gray-600 text-xs">{school.email} | {school.phone}</p>
          </div>
        )}

        <div className={`border-b-2 border-gray-800 pb-1 ${headerMarginClass}`}>
          <h2 className={`${isVeryCompact ? 'text-lg' : 'text-xl'} font-black text-center tracking-widest`}>REPORT FORM</h2>
        </div>
        
        <div className={`flex justify-between items-start ${sectionMarginClass} text-xs`}>
          <div className="space-y-0.5 flex-1 pr-4">
            <p><span className="font-bold text-gray-600">Serial Number:</span> <span className="font-mono font-semibold">{serialNumber}</span></p>
            <p><span className="font-bold text-gray-600">Exam Type:</span> End Term Report</p>
            <p><span className="font-bold text-gray-600">Term:</span> {term}</p>
            <p><span className="font-bold text-gray-600">Academic Year:</span> {academicYear}</p>
          </div>

          {student.photoUrl && (
            <div className="flex-shrink-0 mx-4 border-2 border-gray-200 rounded-md overflow-hidden bg-gray-50 flex items-center justify-center w-20 h-24">
              <img src={student.photoUrl} alt="Student" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="space-y-0.5 text-right flex-1 pl-4">
            <p className="break-words"><span className="font-bold text-gray-600">Learner Name:</span> <span className={`font-bold ${isVeryCompact ? 'text-sm' : 'text-base'}`}>{student.fullName}</span></p>
            <p className="break-words"><span className="font-bold text-gray-600">Admission Number:</span> {student.admissionNumber}</p>
            <p className="break-words"><span className="font-bold text-gray-600">Class:</span> {studentClass?.name || ''}</p>
            <p className="break-words"><span className="font-bold text-gray-600">Stream:</span> {studentStream?.name || ''}</p>
          </div>
        </div>

        <table className={`w-full ${sectionMarginClass} border-collapse ${tableTextClass}`}>
          <thead>
            <tr style={{ backgroundColor: school?.primaryColor ? `${school.primaryColor}20` : '#f3f4f6' }}>
              <th className={`${tablePaddingClass} text-left border-b-2 border-gray-300 font-bold`}>Subject</th>
              <th className={`${tablePaddingClass} text-right border-b-2 border-gray-300 font-bold`}>Opener</th>
              <th className={`${tablePaddingClass} text-right border-b-2 border-gray-300 font-bold`}>Midterm</th>
              <th className={`${tablePaddingClass} text-right border-b-2 border-gray-300 font-bold`}>End Term</th>
              <th className={`${tablePaddingClass} text-right border-b-2 border-gray-300 font-bold`}>Total</th>
              <th className={`${tablePaddingClass} text-right border-b-2 border-gray-300 font-bold`}>Average</th>
              <th className={`${tablePaddingClass} text-right border-b-2 border-gray-300 font-bold`}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {combinedResults.length > 0 ? (
              combinedResults.map(r => (
                <tr key={r.subjectId} className="border-b border-gray-200">
                  <td className={`${tablePaddingClass}`}>{r.subjectName}</td>
                  <td className={`${tablePaddingClass} text-right`}>{r.opener}</td>
                  <td className={`${tablePaddingClass} text-right`}>{r.midterm}</td>
                  <td className={`${tablePaddingClass} text-right`}>{r.endTerm}</td>
                  <td className={`${tablePaddingClass} text-right font-semibold`}>{r.total}</td>
                  <td className={`${tablePaddingClass} text-right`}>{r.average.toFixed(1)}%</td>
                  <td className={`${tablePaddingClass} text-right font-bold`} style={{ color: school?.primaryColor || '#000000' }}>{r.grade}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-4 md:p-8 text-center text-xs">
                  <div className="flex flex-col items-center justify-center text-amber-600">
                    <AlertTriangle className="w-8 h-8 mb-2" />
                    <p className="font-bold">Incomplete report data for this learner.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {combinedResults.length > 0 && (
          <div className={`flex flex-col ${sectionGapClass}`}>
            {/* Summary Section */}
            <div className={`bg-gray-50 ${summaryPaddingClass} rounded-xl border border-gray-200`}>
              <h3 className="text-center font-bold text-gray-700 mb-1 uppercase tracking-wider text-[10px]">Term Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-center">
                <div className="space-y-0.5">
                  <p className="text-gray-500 font-medium text-[8px] uppercase">Opener</p>
                  <p className={`${isVeryCompact ? 'text-sm' : 'text-base'} font-bold`}>{openerTotal} <span className="text-[8px] text-gray-400 font-normal">/ {maxPossiblePerExam}</span></p>
                  <p className="text-[10px] text-gray-600">Mean: <span className="font-semibold">{openerMean.toFixed(1)}%</span></p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-gray-500 font-medium text-[8px] uppercase">Midterm</p>
                  <p className={`${isVeryCompact ? 'text-sm' : 'text-base'} font-bold`}>{midtermTotal} <span className="text-[8px] text-gray-400 font-normal">/ {maxPossiblePerExam}</span></p>
                  <p className="text-[10px] text-gray-600">Mean: <span className="font-semibold">{midtermMean.toFixed(1)}%</span></p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-gray-500 font-medium text-[8px] uppercase">End Term</p>
                  <p className={`${isVeryCompact ? 'text-sm' : 'text-base'} font-bold`}>{endTermTotal} <span className="text-[8px] text-gray-400 font-normal">/ {maxPossiblePerExam}</span></p>
                  <p className="text-[10px] text-gray-600">Mean: <span className="font-semibold">{endTermMean.toFixed(1)}%</span></p>
                </div>
              </div>
            </div>

            {/* Final Grade Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 gap-4">
              <div className={`bg-gray-100 ${summaryPaddingClass} rounded-xl border border-gray-300 flex-1 flex items-center justify-around`}>
                <div className="text-center">
                  <p className="text-gray-500 font-medium mb-0.5 uppercase text-[8px] tracking-wider">Final Mean</p>
                  <p className={`${isVeryCompact ? 'text-xl' : 'text-2xl'} font-black`}>{finalMean.toFixed(2)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500 font-medium mb-0.5 uppercase text-[8px] tracking-wider">Final Grade</p>
                  <p className={`${isVeryCompact ? 'text-2xl' : 'text-3xl'} font-black`} style={{ color: school?.primaryColor || '#000000' }}>{finalGrade}</p>
                </div>
              </div>

              {/* School Seal */}
              <div 
                className={`${isVeryCompact ? 'w-20 h-20' : 'w-24 h-24'} shrink-0 rounded-full border-[3px] border-double flex items-center justify-center p-1 opacity-80 rotate-[-15deg] pointer-events-none`} 
                style={{ borderColor: school?.primaryColor || '#1e3a8a', color: school?.primaryColor || '#1e3a8a' }}
              >
                <div className="w-full h-full rounded-full border border-dashed flex flex-col items-center justify-center text-center p-1 relative bg-white">
                  <div className="font-black text-[5px] uppercase tracking-wider mb-0.5 border-b border-current pb-0.5 w-full truncate px-1">{school?.name}</div>
                  <div className="font-bold text-[4px] uppercase text-gray-600">REPORT FORM</div>
                  <div className="font-bold text-[4px] uppercase mt-0.5">Adm: {student.admissionNumber}</div>
                  <div className="font-bold text-[4px] uppercase">Cls: {studentClass?.name || ''}</div>
                  <div className="font-bold text-[4px] uppercase">Str: {studentStream?.name || ''}</div>
                  <div className="font-bold text-[4px] uppercase mt-0.5 border-t border-current pt-0.5 w-full">{academicYear}</div>
                </div>
              </div>
            </div>

            {/* Manual Comments Section */}
            <div className={`mt-2 pt-2 border-t-2 border-gray-200`}>
              <div className={`grid grid-cols-1 ${commentGapClass} text-xs`}>
                <div className="flex items-end">
                  <span className="font-bold text-gray-700 whitespace-nowrap mr-2">Class Teacher's Comment:</span>
                  <div className="flex-1 border-b border-gray-400 border-dashed pb-0.5 px-2 text-gray-800 italic">{teacherComment}</div>
                </div>
                <div className="flex items-end">
                  <span className="font-bold text-gray-700 whitespace-nowrap mr-2">Principal's Comment:</span>
                  <div className="flex-1 border-b border-gray-400 border-dashed pb-0.5 px-2 text-gray-800 italic">{principalComment}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
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
          .print-area { position: absolute; left: 0; top: 0; width: 100%; height: auto; }
          @page { size: A4; margin: 10mm; }
          .compact-report { transform-origin: top center; }
        `}
      </style>
      <style>
        {`
          .pdf-exporting {
            width: 794px !important; /* A4 width at 96 DPI */
            max-width: none !important;
            padding: 30px !important;
            background: white !important;
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            transform: none !important;
          }
        `}
      </style>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:p-0 print:bg-white print:block print:relative print:inset-auto">
        <div className="bg-white rounded-3xl shadow-2xl w-[calc(100%-2rem)] md:w-full max-w-4xl p-4 md:p-8 max-h-[90vh] overflow-y-auto print:shadow-none print:max-w-none print:max-h-none print:p-0 print:overflow-visible">
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
          <div className={`print-area relative bg-white ${isVeryCompact ? 'compact-report' : ''}`} id="report-form-print-area">
            {school && (
              <div className={`text-center ${headerMarginClass}`}>
                {school.logo && <img src={school.logo} alt="School Logo" className={`${isVeryCompact ? 'h-10' : 'h-14'} mx-auto mb-1 object-contain`} />}
                <h1 className={`${isVeryCompact ? 'text-xl' : 'text-2xl'} font-black`} style={{ color: school.primaryColor || '#000000' }}>{school.name}</h1>
                <p className="text-gray-600 mt-0.5 text-xs">{school.address}</p>
                <p className="text-gray-600 text-xs">{school.email} | {school.phone}</p>
              </div>
            )}

            <div className={`border-b-2 border-gray-800 pb-1 ${headerMarginClass}`}>
              <h2 className={`${isVeryCompact ? 'text-lg' : 'text-xl'} font-black text-center tracking-widest`}>REPORT FORM</h2>
            </div>
            
            <div className={`flex justify-between items-start ${sectionMarginClass} text-xs`}>
              <div className="space-y-0.5 flex-1 pr-4">
                <p><span className="font-bold text-gray-600">Serial Number:</span> <span className="font-mono font-semibold">{serialNumber}</span></p>
                <p><span className="font-bold text-gray-600">Exam Type:</span> End Term Report</p>
                <p><span className="font-bold text-gray-600">Term:</span> {term}</p>
                <p><span className="font-bold text-gray-600">Academic Year:</span> {academicYear}</p>
              </div>

              {student.photoUrl && (
                <div className="flex-shrink-0 mx-4 border-2 border-gray-200 rounded-md overflow-hidden bg-gray-50 flex items-center justify-center w-20 h-24">
                  <img src={student.photoUrl} alt="Student" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="space-y-0.5 text-right flex-1 pl-4">
                <p className="break-words"><span className="font-bold text-gray-600">Learner Name:</span> <span className={`font-bold ${isVeryCompact ? 'text-sm' : 'text-base'}`}>{student.fullName}</span></p>
                <p className="break-words"><span className="font-bold text-gray-600">Admission Number:</span> {student.admissionNumber}</p>
                <p className="break-words"><span className="font-bold text-gray-600">Class:</span> {studentClass?.name || ''}</p>
                <p className="break-words"><span className="font-bold text-gray-600">Stream:</span> {studentStream?.name || ''}</p>
              </div>
            </div>

            <table className={`w-full ${sectionMarginClass} border-collapse ${tableTextClass}`}>
              <thead>
                <tr style={{ backgroundColor: school?.primaryColor ? `${school.primaryColor}20` : '#f3f4f6' }}>
                  <th className={`${tablePaddingClass} text-left border-b-2 border-gray-300 font-bold`}>Subject</th>
                  <th className={`${tablePaddingClass} text-right border-b-2 border-gray-300 font-bold`}>Opener</th>
                  <th className={`${tablePaddingClass} text-right border-b-2 border-gray-300 font-bold`}>Midterm</th>
                  <th className={`${tablePaddingClass} text-right border-b-2 border-gray-300 font-bold`}>End Term</th>
                  <th className={`${tablePaddingClass} text-right border-b-2 border-gray-300 font-bold`}>Total</th>
                  <th className={`${tablePaddingClass} text-right border-b-2 border-gray-300 font-bold`}>Average</th>
                  <th className={`${tablePaddingClass} text-right border-b-2 border-gray-300 font-bold`}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {combinedResults.length > 0 ? (
                  combinedResults.map(r => (
                    <tr key={r.subjectId} className="border-b border-gray-200">
                      <td className={`${tablePaddingClass}`}>{r.subjectName}</td>
                      <td className={`${tablePaddingClass} text-right`}>{r.opener}</td>
                      <td className={`${tablePaddingClass} text-right`}>{r.midterm}</td>
                      <td className={`${tablePaddingClass} text-right`}>{r.endTerm}</td>
                      <td className={`${tablePaddingClass} text-right font-semibold`}>{r.total}</td>
                      <td className={`${tablePaddingClass} text-right`}>{r.average.toFixed(1)}%</td>
                      <td className={`${tablePaddingClass} text-right font-bold`} style={{ color: school?.primaryColor || '#000000' }}>{r.grade}</td>
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
              <div className={`flex flex-col ${sectionGapClass}`}>
                {/* Summary Section */}
                <div className={`bg-gray-50 ${summaryPaddingClass} rounded-xl border border-gray-200`}>
                  <h3 className="text-center font-bold text-gray-700 mb-1 uppercase tracking-wider text-[10px]">Term Summary</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-center">
                    <div className="space-y-0.5">
                      <p className="text-gray-500 font-medium text-[8px] uppercase">Opener</p>
                      <p className={`${isVeryCompact ? 'text-sm' : 'text-base'} font-bold`}>{openerTotal} <span className="text-[8px] text-gray-400 font-normal">/ {maxPossiblePerExam}</span></p>
                      <p className="text-[10px] text-gray-600">Mean: <span className="font-semibold">{openerMean.toFixed(1)}%</span></p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-gray-500 font-medium text-[8px] uppercase">Midterm</p>
                      <p className={`${isVeryCompact ? 'text-sm' : 'text-base'} font-bold`}>{midtermTotal} <span className="text-[8px] text-gray-400 font-normal">/ {maxPossiblePerExam}</span></p>
                      <p className="text-[10px] text-gray-600">Mean: <span className="font-semibold">{midtermMean.toFixed(1)}%</span></p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-gray-500 font-medium text-[8px] uppercase">End Term</p>
                      <p className={`${isVeryCompact ? 'text-sm' : 'text-base'} font-bold`}>{endTermTotal} <span className="text-[8px] text-gray-400 font-normal">/ {maxPossiblePerExam}</span></p>
                      <p className="text-[10px] text-gray-600">Mean: <span className="font-semibold">{endTermMean.toFixed(1)}%</span></p>
                    </div>
                  </div>
                </div>

                {/* Final Grade Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 gap-4">
                  <div className={`bg-gray-100 ${summaryPaddingClass} rounded-xl border border-gray-300 flex-1 flex items-center justify-around`}>
                    <div className="text-center">
                      <p className="text-gray-500 font-medium mb-0.5 uppercase text-[8px] tracking-wider">Final Mean</p>
                      <p className={`${isVeryCompact ? 'text-xl' : 'text-2xl'} font-black`}>{finalMean.toFixed(2)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 font-medium mb-0.5 uppercase text-[8px] tracking-wider">Final Grade</p>
                      <p className={`${isVeryCompact ? 'text-2xl' : 'text-3xl'} font-black`} style={{ color: school?.primaryColor || '#000000' }}>{finalGrade}</p>
                    </div>
                  </div>

                  {/* School Seal */}
                  <div 
                    className={`${isVeryCompact ? 'w-20 h-20' : 'w-24 h-24'} shrink-0 rounded-full border-[3px] border-double flex items-center justify-center p-1 opacity-80 rotate-[-15deg] pointer-events-none`} 
                    style={{ borderColor: school?.primaryColor || '#1e3a8a', color: school?.primaryColor || '#1e3a8a' }}
                  >
                    <div className="w-full h-full rounded-full border border-dashed flex flex-col items-center justify-center text-center p-1 relative bg-white">
                      <div className="font-black text-[5px] uppercase tracking-wider mb-0.5 border-b border-current pb-0.5 w-full truncate px-1">{school?.name}</div>
                      <div className="font-bold text-[4px] uppercase text-gray-600">REPORT FORM</div>
                      <div className="font-bold text-[4px] uppercase mt-0.5">Adm: {student.admissionNumber}</div>
                      <div className="font-bold text-[4px] uppercase">Cls: {studentClass?.name || ''}</div>
                      <div className="font-bold text-[4px] uppercase">Str: {studentStream?.name || ''}</div>
                      <div className="font-bold text-[4px] uppercase mt-0.5 border-t border-current pt-0.5 w-full">{academicYear}</div>
                    </div>
                  </div>
                </div>

                {/* Manual Comments Section */}
                <div className={`mt-2 pt-2 border-t-2 border-gray-200`}>
                  <div className={`grid grid-cols-1 ${commentGapClass} text-xs`}>
                    <div className="flex items-end">
                      <span className="font-bold text-gray-700 whitespace-nowrap mr-2">Class Teacher's Comment:</span>
                      <div className="flex-1 border-b border-gray-400 border-dashed pb-0.5 px-2 text-gray-800 italic">{teacherComment}</div>
                    </div>
                    <div className="flex items-end">
                      <span className="font-bold text-gray-700 whitespace-nowrap mr-2">Principal's Comment:</span>
                      <div className="flex-1 border-b border-gray-400 border-dashed pb-0.5 px-2 text-gray-800 italic">{principalComment}</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
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
