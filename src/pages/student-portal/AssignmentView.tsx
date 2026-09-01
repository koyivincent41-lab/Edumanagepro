import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, query, collection, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Assignment, AssignmentSubmission } from '../../types';
import { 
  ArrowLeft, 
  Send, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Info,
  Clock,
  Calendar,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

interface AssignmentViewProps {
  session: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export default function AssignmentView({ session }: AssignmentViewProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        // 1. Fetch assignment
        const asgDoc = await getDoc(doc(db, 'assignments', id));
        if (!asgDoc.exists()) {
          toast.error("Assignment not found");
          navigate('/student-portal/assignments');
          return;
        }
        const asgData = { id: asgDoc.id, ...asgDoc.data() } as Assignment;
        setAssignment(asgData);

        // 2. Fetch existing submission
        const subQuery = query(
          collection(db, 'student_assignment_submissions'),
          where('assignmentId', '==', id),
          where('studentId', '==', session.id)
        );
        const subSnap = await getDocs(subQuery);
        if (!subSnap.empty) {
          const subData = { id: subSnap.docs[0].id, ...subSnap.docs[0].data() } as AssignmentSubmission;
          setSubmission(subData);
          setAnswers(subData.answers || {});
        }
      } catch (error) {
        console.error("Error fetching assignment:", error);
        handleFirestoreError(error, OperationType.GET, `assignments/${id}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, session.id, navigate]);

  function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType,
      path,
      timestamp: new Date().toISOString()
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    // Optional: add auth info if needed by system
  }

  const handleAnswerChange = (questionId: string, answer: string) => {
    if (submission) return; // Read-only if submitted
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !assignment || submission) return;

    // Basic validation
    if (assignment.questions && assignment.questions.length > 0) {
      const unanswered = assignment.questions.filter(q => !answers[q.id]);
      if (unanswered.length > 0) {
        if (!window.confirm(`You haven't answered ${unanswered.length} questions. Do you want to submit anyway?`)) {
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      const submissionId = `${session.id}_${id}`;
      const submissionData = {
        assignmentId: id,
        studentId: session.id,
        studentName: session.fullName,
        answers: answers,
        submittedAt: new Date().toISOString(),
        status: 'submitted',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        serverTimestamp: serverTimestamp()
      };

      await setDoc(doc(db, 'student_assignment_submissions', submissionId), submissionData);
      toast.success("Assignment submitted successfully!");
      setSubmission(submissionData as any);
    } catch (error) {
      console.error("Error submitting assignment:", error);
      toast.error("Failed to submit assignment");
      handleFirestoreError(error, OperationType.WRITE, 'student_assignment_submissions');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-bold">Loading assignment detail...</p>
      </div>
    );
  }

  if (!assignment) return null;

  const isSubmitted = !!submission;
  const isOverdue = new Date(assignment.dueDate) < new Date() && !isSubmitted;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500 pb-20">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
        <button 
          onClick={() => navigate('/student-portal/assignments')}
          className="flex items-center gap-2 text-gray-500 hover:text-primary font-bold transition-colors mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to List
        </button>

        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-4 py-1.5 bg-primary/10 text-primary text-sm font-black rounded-full uppercase tracking-widest">
                {assignment.subject}
              </span>
              {isSubmitted ? (
                <span className="px-4 py-1.5 bg-green-100 text-green-700 text-sm font-black rounded-full uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Submitted
                </span>
              ) : isOverdue ? (
                <span className="px-4 py-1.5 bg-red-100 text-red-700 text-sm font-black rounded-full uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> Overdue
                </span>
              ) : (
                <span className="px-4 py-1.5 bg-blue-100 text-blue-700 text-sm font-black rounded-full uppercase tracking-widest flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Active
                </span>
              )}
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-tight">{assignment.title}</h1>
            <div className="flex items-center gap-6 text-gray-500 font-medium">
               <div className="flex items-center gap-2">
                 <Calendar className="h-5 w-5" />
                 <span>Due: {new Date(assignment.dueDate).toLocaleDateString(undefined, { dateStyle: 'full' })}</span>
               </div>
               <div className="flex items-center gap-2">
                 <Clock className="h-5 w-5" />
                 <span>{new Date(assignment.dueDate).toLocaleTimeString(undefined, { timeStyle: 'short' })}</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description & Attachment */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 space-y-6">
        <div>
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2 mb-4">
            <Info className="h-5 w-5 text-primary" />
            Instructions
          </h3>
          <div className="prose prose-blue max-w-none text-gray-600 font-medium">
            {assignment.description.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>

        {assignment.attachmentUrl && (
          <div className="pt-6 border-t border-gray-100">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2 mb-6">
              <FileText className="h-5 w-5 text-primary" />
              Attached Document
            </h3>
            
            <div className="aspect-[16/9] md:aspect-[16/10] bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 shadow-inner relative group">
              <iframe 
                src={assignment.attachmentUrl} 
                className="w-full h-full border-none"
                title="Assignment Attachment"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 pointer-events-none transition-colors" />
            </div>
            
            <div className="mt-4 flex justify-end">
              <a 
                href={assignment.attachmentUrl} 
                target="_blank" 
                rel="noreferrer"
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-all flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                View in Full Screen
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Questions Section */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {assignment.questions && assignment.questions.length > 0 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-4">
              <h3 className="text-xl font-black text-gray-900">Questions</h3>
              <span className="text-sm font-bold text-gray-400">{assignment.questions.length} total</span>
            </div>
            
            {assignment.questions.map((q, index) => (
              <div 
                key={q.id}
                className={`bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm transition-all duration-300 ${isSubmitted ? 'opacity-80' : 'hover:border-primary/20 hover:shadow-md'}`}
              >
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary/5 rounded-2xl flex items-center justify-center text-primary font-black">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-6">
                    <p className="text-lg font-bold text-gray-800 leading-relaxed">{q.text}</p>
                    
                    {q.type === 'multiple_choice' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        {q.options?.map((opt, i) => {
                          const label = String.fromCharCode(65 + i); // A, B, C, D
                          const isSelected = answers[q.id] === opt;
                          return (
                            <label 
                              key={i}
                              className={`
                                relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer
                                ${isSelected 
                                  ? 'border-primary bg-primary/5 shadow-sm' 
                                  : 'border-gray-100 bg-gray-50 hover:border-gray-200'}
                                ${isSubmitted ? 'cursor-default' : ''}
                              `}
                            >
                              <input 
                                type="radio"
                                name={q.id}
                                value={opt}
                                disabled={isSubmitted}
                                checked={isSelected}
                                onChange={() => handleAnswerChange(q.id, opt)}
                                className="hidden"
                              />
                              <div className={`
                                w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm
                                ${isSelected ? 'bg-primary text-white' : 'bg-white text-gray-400 group-hover:text-primary'}
                              `}>
                                {label}
                              </div>
                              <span className={`font-bold ${isSelected ? 'text-primary' : 'text-gray-600'}`}>
                                {opt}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-4">
                        <textarea 
                          rows={4}
                          disabled={isSubmitted}
                          placeholder="Type your response here..."
                          value={answers[q.id] || ''}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                          className={`
                            w-full p-4 rounded-2xl border-2 bg-gray-50 placeholder-gray-400 font-medium transition-all resize-none
                            ${isSubmitted 
                              ? 'border-gray-100 text-gray-500' 
                              : 'border-gray-100 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/5'}
                          `}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Open Response Assignment</h3>
            <p className="text-sm text-gray-500 mt-1 mb-6">There are no structured questions for this assignment. Please provide your general response below.</p>
            
            <textarea 
              rows={8}
              disabled={isSubmitted}
              placeholder="Type your response here..."
              value={answers['general'] || ''}
              onChange={(e) => handleAnswerChange('general', e.target.value)}
              className={`
                w-full p-6 rounded-3xl border-2 bg-gray-50 placeholder-gray-400 font-medium transition-all resize-none
                ${isSubmitted 
                  ? 'border-gray-100 text-gray-500' 
                  : 'border-gray-100 focus:border-primary focus:bg-white focus:ring-8 focus:ring-primary/5'}
              `}
            />
          </div>
        )}

        {/* Submit Bar */}
        <div className="sticky bottom-8 left-0 right-0 z-10 px-4 md:px-0">
          <div className="max-w-md mx-auto bg-white rounded-full p-2 shadow-2xl border border-gray-100 flex items-center justify-between gap-4">
            <div className="pl-6 flex items-center gap-3">
               <div className={`w-3 h-3 rounded-full animate-pulse ${isSubmitted ? 'bg-green-500' : 'bg-blue-500'}`} />
               <span className="text-sm font-black text-gray-900 uppercase tracking-widest whitespace-nowrap">
                  {isSubmitted ? 'Submitted' : 'Ready?'}
               </span>
            </div>
            
            {!isSubmitted ? (
              <button 
                type="submit"
                disabled={submitting}
                className="px-10 py-4 bg-primary text-white font-black rounded-full flex items-center gap-2 hover:bg-rose-900 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-primary/20"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    <span>Submit Work</span>
                  </>
                )}
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => navigate('/student-portal/assignments')}
                className="px-10 py-4 bg-gray-900 text-white font-black rounded-full flex items-center gap-2 hover:bg-black transition-all active:scale-95 shadow-lg shadow-black/20"
              >
                <ArrowRight className="h-5 w-5" />
                Done
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Grade and Feedback Footer (Visible only after submission and grading) */}
      {isSubmitted && submission?.feedback && (
        <div className="bg-school-gradient rounded-3xl p-8 text-white shadow-xl shadow-primary/20 space-y-4">
           <h3 className="text-xl font-black flex items-center gap-3">
             <CheckCircle className="h-6 w-6 text-green-400" />
             Teacher's Evaluation
           </h3>
           <div className="p-6 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1">
                   <p className="text-brand-200 text-sm font-bold uppercase tracking-widest mb-2">Feedback</p>
                   <p className="text-lg font-medium leading-relaxed italic">"{submission.feedback}"</p>
                </div>
                {submission.grade && (
                  <div className="flex-shrink-0 text-center px-8 py-4 bg-white rounded-2xl">
                     <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-1">Grade</p>
                     <p className="text-4xl font-black text-primary">{submission.grade}</p>
                  </div>
                )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
