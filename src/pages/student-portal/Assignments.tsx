import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Assignment, AssignmentSubmission } from '../../types';
import { BookOpen, Calendar, Clock, Lock, CheckCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AssignmentsProps {
  session: any;
}

export default function Assignments({ session }: AssignmentsProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch active assignments for the student's class
        const asgQuery = query(
          collection(db, 'assignments'),
          where('schoolId', '==', session.schoolId),
          where('classId', '==', session.classId),
          where('status', '==', 'Active')
        );
        const asgSnap = await getDocs(asgQuery);
        const asgData = asgSnap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
        
        // 2. Fetch student's submissions for these assignments
        const subQuery = query(
          collection(db, 'student_assignment_submissions'),
          where('studentId', '==', session.id)
        );
        const subSnap = await getDocs(subQuery);
        const subData = subSnap.docs.map(d => ({ id: d.id, ...d.data() } as AssignmentSubmission));
        
        setAssignments(asgData.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()));
        setSubmissions(subData);
      } catch (error) {
        console.error("Error fetching assignments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  const getSubmissionStatus = (assignmentId: string) => {
    return submissions.find(s => s.assignmentId === assignmentId);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">My Assignments</h2>
          <p className="text-gray-500 font-medium">Complete your classwork and track your progress</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-gray-500 font-bold animate-pulse">Loading assignments...</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-gray-100 shadow-sm">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen className="h-10 w-10 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Assignments Found</h3>
          <p className="text-gray-500 max-w-sm mx-auto">You don't have any active assignments for your class at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {assignments.map((asg) => {
            const submission = getSubmissionStatus(asg.id);
            const isSubmitted = !!submission;
            const isOverdue = new Date(asg.dueDate) < new Date() && !isSubmitted;

            return (
              <div 
                key={asg.id}
                className="group bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 bg-primary/5 text-primary text-xs font-black rounded-full uppercase tracking-wider">
                        {asg.subject}
                      </span>
                      {isSubmitted ? (
                        <span className="px-3 py-1 bg-green-50 text-green-600 text-xs font-black rounded-full uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Submitted
                        </span>
                      ) : isOverdue ? (
                        <span className="px-3 py-1 bg-red-50 text-red-600 text-xs font-black rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Overdue
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-black rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors">{asg.title}</h4>
                      <p className="text-gray-500 text-sm mt-1 line-clamp-1">{asg.description}</p>
                    </div>

                    <div className="flex items-center gap-4 text-sm font-medium text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>Due: {new Date(asg.dueDate).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>{new Date(asg.dueDate).toLocaleTimeString(undefined, { timeStyle: 'short' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isSubmitted ? (
                      <button 
                        onClick={() => navigate(`/student-portal/assignments/${asg.id}`)}
                        className="w-full md:w-auto px-8 py-4 bg-gray-100 text-gray-500 font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-all active:scale-95"
                      >
                         <Lock className="h-5 w-5" />
                         View Submission
                      </button>
                    ) : (
                      <button 
                        onClick={() => navigate(`/student-portal/assignments/${asg.id}`)}
                        className="w-full md:w-auto px-8 py-4 bg-primary text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:translate-y-[-2px] transition-all active:scale-95"
                      >
                         Open and Answer
                         <ArrowRight className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
