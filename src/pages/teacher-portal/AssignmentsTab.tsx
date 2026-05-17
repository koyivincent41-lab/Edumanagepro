import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Class, Student } from '../../types';
import { BookOpen, Calendar, Clock, Plus, Edit2, Trash2, CheckCircle, XCircle, AlertCircle, Search, FileText, Upload, User as UserIcon, X, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Assignment {
  id?: string;
  teacherId: string;
  schoolId: string;
  title: string;
  description: string;
  subject: string;
  classId: string;
  className: string;
  dueDate: string;
  status: 'Draft' | 'Active' | 'Closed';
  attachmentUrl?: string; // We'll just use a text field for URL or store base64 string
  createdAt: string;
}

interface AssignmentSubmission {
  id?: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  submissionDate: string;
  fileUrl?: string;
  status: 'Submitted' | 'Late' | 'Missing';
  grade?: string;
  feedback?: string;
}

interface AssignmentsTabProps {
  teacher: any;
}

export default function AssignmentsTab({ teacher }: AssignmentsTabProps) {
  const [activeTab, setActiveTab] = useState<'issued' | 'submissions'>('issued');
  const [classes, setClasses] = useState<Class[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  
  // Selection states
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  
  // Grading state
  const [gradingStudent, setGradingStudent] = useState<any>(null); // combined student + submission

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    classId: '',
    dueDate: '',
    status: 'Active' as const,
    attachmentUrl: ''
  });

  const [gradeForm, setGradeForm] = useState({
    grade: '',
    feedback: ''
  });

  useEffect(() => {
    fetchClasses();
    fetchAssignments();
  }, [teacher]);

  useEffect(() => {
    if (activeTab === 'submissions' && !selectedAssignmentId && assignments.length > 0) {
      setSelectedAssignmentId(assignments[0].id!);
    }
  }, [activeTab, assignments, selectedAssignmentId]);

  useEffect(() => {
    if (activeTab === 'submissions' && selectedAssignmentId) {
      fetchSubmissionsAndStudents(selectedAssignmentId);
    }
  }, [selectedAssignmentId, activeTab]);

  const fetchClasses = async () => {
    try {
      const teacherClassesMap = new Map<string, Class>();

      // 1. Query classes where this teacher is the class teacher
      const classTeacherQuery = query(
        collection(db, 'schools', teacher.schoolId, 'classes'),
        where('classTeacherId', '==', teacher.id)
      );
      const classTeacherSnapshot = await getDocs(classTeacherQuery);
      
      classTeacherSnapshot.docs.forEach(doc => {
        teacherClassesMap.set(doc.id, { id: doc.id, ...doc.data() } as Class);
      });

      // 2. Query class_subjects where this teacher teaches a subject
      const subjectTeacherQuery = query(
        collection(db, 'class_subjects'),
        where('schoolId', '==', teacher.schoolId),
        where('teacherId', '==', teacher.id)
      );
      const subjectTeacherSnapshot = await getDocs(subjectTeacherQuery);
      
      // Fetch the class details for those class_subjects if not already in the map
      for (const csDoc of subjectTeacherSnapshot.docs) {
        const classId = csDoc.data().classId;
        if (classId && !teacherClassesMap.has(classId)) {
          const classDocRef = doc(db, 'schools', teacher.schoolId, 'classes', classId);
          const classDocSnap = await getDoc(classDocRef);
          if (classDocSnap.exists()) {
            teacherClassesMap.set(classId, { id: classId, ...classDocSnap.data() } as Class);
          }
        }
      }

      const classesData = Array.from(teacherClassesMap.values());
      setClasses(classesData);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'assignments'),
        where('teacherId', '==', teacher.id)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
      // Sort by creation date or due date
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAssignments(data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissionsAndStudents = async (assignmentId: string) => {
    try {
      setLoading(true);
      const assignment = assignments.find(a => a.id === assignmentId);
      if (!assignment) return;

      // Fetch students for this class
      const studentsQuery = query(
        collection(db, 'schools', teacher.schoolId, 'students'),
        where('classId', '==', assignment.classId),
        where('status', '==', 'active')
      );
      const stuSnap = await getDocs(studentsQuery);
      const stus = stuSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      setStudents(stus);

      // Fetch submissions
      const subQuery = query(
        collection(db, 'assignmentSubmissions'),
        where('assignmentId', '==', assignmentId)
      );
      const subSnap = await getDocs(subQuery);
      const subs = subSnap.docs.map(d => ({ id: d.id, ...d.data() } as AssignmentSubmission));
      setSubmissions(subs);

    } catch (error) {
      console.error(error);
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cls = classes.find(c => c.id === formData.classId);
      if (!cls) {
        toast.error('Please select a valid class');
        return;
      }

      const newAssignment: Assignment = {
        teacherId: teacher.id,
        schoolId: teacher.schoolId,
        title: formData.title,
        description: formData.description,
        subject: formData.subject,
        classId: cls.id,
        className: cls.name,
        dueDate: formData.dueDate,
        status: formData.status,
        attachmentUrl: formData.attachmentUrl,
        createdAt: new Date().toISOString()
      };

      if (editingAssignment?.id) {
        await updateDoc(doc(db, 'assignments', editingAssignment.id), { ...newAssignment });
        toast.success('Assignment updated');
      } else {
        await addDoc(collection(db, 'assignments'), newAssignment);
        toast.success('Assignment created');
      }

      setShowCreateModal(false);
      setEditingAssignment(null);
      setFormData({ title: '', description: '', subject: '', classId: '', dueDate: '', status: 'Active', attachmentUrl: '' });
      fetchAssignments();
    } catch (error) {
      console.error(error);
      toast.error('Operation failed');
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      try {
        await deleteDoc(doc(db, 'assignments', id));
        toast.success('Assignment deleted');
        fetchAssignments();
      } catch (error) {
        console.error(error);
        toast.error('Failed to delete assignment');
      }
    }
  };

  const openEditModal = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      title: assignment.title,
      description: assignment.description,
      subject: assignment.subject,
      classId: assignment.classId,
      dueDate: assignment.dueDate,
      status: assignment.status,
      attachmentUrl: assignment.attachmentUrl || ''
    });
    setShowCreateModal(true);
  };

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingStudent) return;

    try {
      if (gradingStudent.submissionId) {
        // Update existing submission grade
        await updateDoc(doc(db, 'assignmentSubmissions', gradingStudent.submissionId), {
          grade: gradeForm.grade,
          feedback: gradeForm.feedback
        });
      } else {
        // Technically they haven't submitted, but teacher is giving a grade (e.g. 0)
        // Create a missing submission record
        const newSub: AssignmentSubmission = {
          assignmentId: selectedAssignmentId,
          studentId: gradingStudent.student.id,
          studentName: gradingStudent.student.fullName,
          submissionDate: new Date().toISOString(),
          status: 'Missing',
          grade: gradeForm.grade,
          feedback: gradeForm.feedback
        };
        await addDoc(collection(db, 'assignmentSubmissions'), newSub);
      }
      toast.success('Grade saved successfully');
      setGradingStudent(null);
      fetchSubmissionsAndStudents(selectedAssignmentId);
    } catch (error) {
      console.error(error);
      toast.error('Failed to save grade');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active': return <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2.5 py-1 rounded-full text-xs font-bold uppercase">Active</span>;
      case 'Closed': return <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-1 rounded-full text-xs font-bold uppercase">Closed</span>;
      case 'Draft': return <span className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-full text-xs font-bold uppercase">Draft</span>;
      default: return null;
    }
  };

  const getSubStatusBadge = (status: string) => {
    switch (status) {
      case 'Submitted': return <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-bold text-xs"><CheckCircle className="h-3 w-3" /> Submitted</span>;
      case 'Late': return <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 font-bold text-xs"><AlertCircle className="h-3 w-3" /> Late</span>;
      case 'Missing': return <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold text-xs"><XCircle className="h-3 w-3" /> Missing</span>;
      default: return null;
    }
  };

  // Combine students with their submissions
  const combinedStudentsList = students.map(st => {
    const sub = submissions.find(s => s.studentId === st.id);
    const selectedAsg = assignments.find(a => a.id === selectedAssignmentId);
    
    let status = 'Missing';
    if (sub) {
      status = sub.status;
    } else if (selectedAsg && new Date(selectedAsg.dueDate).getTime() < new Date().getTime()) {
      status = 'Missing';
    }

    return {
      student: st,
      submission: sub,
      submissionId: sub?.id,
      status,
      grade: sub?.grade,
      feedback: sub?.feedback,
      submissionDate: sub?.submissionDate,
      fileUrl: sub?.fileUrl
    };
  });

  return (
    <div className="space-y-6">

      {/* Internal Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('issued')}
          className={`pb-4 px-6 text-sm font-bold transition-all ${
            activeTab === 'issued' 
              ? 'border-b-2 border-maroon text-maroon' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Issued Assignments
        </button>
        <button
          onClick={() => setActiveTab('submissions')}
          className={`pb-4 px-6 text-sm font-bold transition-all ${
            activeTab === 'submissions' 
              ? 'border-b-2 border-maroon text-maroon' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Student Submissions
        </button>
      </div>

      {activeTab === 'issued' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">All Assignments</h3>
            <button
              onClick={() => {
                setEditingAssignment(null);
                setFormData({ title: '', description: '', subject: '', classId: '', dueDate: '', status: 'Active', attachmentUrl: '' });
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-maroon text-white rounded-xl font-bold flex items-center gap-2 hover:bg-rose-900 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Assignment
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maroon"></div>
            </div>
          ) : assignments.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-gray-100 dark:border-gray-700 shadow-sm">
              <BookOpen className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Assignments Yet</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">Create your first assignment to engage your students and track their progress.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignments.map(asg => (
                <div key={asg.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                  <div className="flex justify-between items-start mb-3">
                    {getStatusBadge(asg.status)}
                    <div className="flex gap-2">
                       <button onClick={() => openEditModal(asg)} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
                         <Edit2 className="h-4 w-4" />
                       </button>
                       <button onClick={() => handleDeleteAssignment(asg.id!)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                         <Trash2 className="h-4 w-4" />
                       </button>
                    </div>
                  </div>
                  <h4 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-1 mb-1">{asg.title}</h4>
                  <p className="text-sm font-medium text-maroon mb-3">{asg.subject} • {asg.className}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">{asg.description}</p>
                  
                  <div className="flex items-center gap-4 text-xs font-semibold text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-50 dark:border-gray-700">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Due: {new Date(asg.dueDate).toLocaleDateString()}</span>
                    </div>
                    {asg.attachmentUrl && (
                      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <FileText className="h-3.5 w-3.5" />
                        <span>Has File</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'submissions' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex-1 w-full max-w-sm">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Select Assignment</label>
              <select
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon focus:border-transparent font-medium"
              >
                {assignments.length === 0 ? <option value="">No assignments available</option> : null}
                {assignments.map(a => (
                  <option key={a.id} value={a.id}>{a.title} ({a.className})</option>
                ))}
              </select>
            </div>
            
            {selectedAssignmentId && assignments.find(a => a.id === selectedAssignmentId) && (
              <div className="flex gap-4 sm:ml-auto items-center">
                <div className="text-right">
                  <span className="block text-xs font-bold text-gray-500 uppercase">Status</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {assignments.find(a => a.id === selectedAssignmentId)?.status}
                  </span>
                </div>
                <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
                <div className="text-right">
                  <span className="block text-xs font-bold text-gray-500 uppercase">Due Date</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {new Date(assignments.find(a => a.id === selectedAssignmentId)?.dueDate || '').toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {!selectedAssignmentId ? (
            <div className="text-center py-12 text-gray-500">Please select an assignment to view submissions.</div>
          ) : loading ? (
            <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maroon"></div></div>
          ) : students.length === 0 ? (
             <div className="text-center py-12 text-gray-500">No students found in this class.</div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Student Name</th>
                      <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Submitted On</th>
                      <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">File</th>
                      <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Grade</th>
                      <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {combinedStudentsList.map((item) => (
                      <tr key={item.student.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${item.status === 'Missing' ? 'bg-red-50/30' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {item.student.photoUrl ? (
                              <img src={item.student.photoUrl} alt="" className="w-6 h-6 rounded-full" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center"><UserIcon className="h-3 w-3 text-gray-500"/></div>
                            )}
                            {item.student.fullName}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">Adm: {item.student.admissionNumber}</div>
                        </td>
                        <td className="px-6 py-4">
                           {getSubStatusBadge(item.status)}
                        </td>
                        <td className="px-6 py-4">
                           <span className="text-sm text-gray-600 dark:text-gray-300">
                             {item.submissionDate ? new Date(item.submissionDate).toLocaleString() : '-'}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                          {item.fileUrl ? (
                            <a href={item.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
                              <FileText className="h-4 w-4" /> View File
                            </a>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {item.grade ? (
                            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold bg-gray-900 text-white rounded-md">{item.grade}</span>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              setGradingStudent(item);
                              setGradeForm({ grade: item.grade || '', feedback: item.feedback || '' });
                            }}
                            className="text-maroon hover:text-rose-900 text-sm font-bold bg-maroon/10 hover:bg-maroon/20 px-3 py-1.5 rounded-lg transition-colors inline-block"
                          >
                            Grade & Feedback
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-3xl shadow-2xl p-6 sm:p-8 relative">
             <button onClick={() => setShowCreateModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
               <X className="h-6 w-6" />
             </button>
             
             <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-6">
               {editingAssignment ? 'Edit Assignment' : 'Create Assignment'}
             </h2>

             <form onSubmit={handleCreateSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                   <div className="sm:col-span-2">
                     <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Title</label>
                     <input
                       type="text"
                       required
                       value={formData.title}
                       onChange={e => setFormData({...formData, title: e.target.value})}
                       className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon font-medium"
                       placeholder="e.g. Chapter 4 Math Exercises"
                     />
                   </div>

                   <div className="sm:col-span-2">
                     <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Description / Instructions</label>
                     <textarea
                       required
                       rows={3}
                       value={formData.description}
                       onChange={e => setFormData({...formData, description: e.target.value})}
                       className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon font-medium resize-none"
                       placeholder="Enter detailed instructions here..."
                     ></textarea>
                   </div>

                   <div>
                     <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                     <input
                       type="text"
                       required
                       value={formData.subject}
                       onChange={e => setFormData({...formData, subject: e.target.value})}
                       className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon font-medium"
                       placeholder="e.g. Mathematics"
                     />
                   </div>

                   <div>
                     <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Class</label>
                     <select
                       required
                       value={formData.classId}
                       onChange={e => setFormData({...formData, classId: e.target.value})}
                       className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon font-medium"
                     >
                       <option value="">Select Class</option>
                       {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                     </select>
                   </div>

                   <div>
                     <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                     <input
                       type="datetime-local"
                       required
                       value={formData.dueDate}
                       onChange={e => setFormData({...formData, dueDate: e.target.value})}
                       className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon font-medium"
                     />
                   </div>

                   <div>
                     <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Status</label>
                     <select
                       required
                       value={formData.status}
                       onChange={e => setFormData({...formData, status: e.target.value as any})}
                       className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon font-medium"
                     >
                       <option value="Draft">Draft</option>
                       <option value="Active">Active</option>
                       <option value="Closed">Closed</option>
                     </select>
                   </div>

                   <div className="sm:col-span-2">
                     <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Attachment URL (Optional)</label>
                     <div className="relative">
                       <Upload className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                       <input
                         type="url"
                         value={formData.attachmentUrl}
                         onChange={e => setFormData({...formData, attachmentUrl: e.target.value})}
                         className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon font-medium"
                         placeholder="Link to file (Google Drive, Dropbox, etc.)"
                       />
                     </div>
                   </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-6">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 py-2.5 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                  <button type="submit" className="px-6 py-2.5 rounded-xl font-bold text-white bg-maroon hover:bg-rose-900 transition-colors">
                    {editingAssignment ? 'Save Changes' : 'Create Assignment'}
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Grade Modal */}
      {gradingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl p-6 sm:p-8 relative">
             <button onClick={() => setGradingStudent(null)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
               <X className="h-6 w-6" />
             </button>
             
             <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Evaluate Submission</h2>
             <p className="text-gray-500 mb-6 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl flex items-center gap-3">
               {gradingStudent.student.photoUrl ? (
                  <img src={gradingStudent.student.photoUrl} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center"><UserIcon className="h-4 w-4 text-gray-500"/></div>
               )}
               <span className="font-bold text-gray-900 dark:text-white">{gradingStudent.student.fullName}</span>
             </p>

             <form onSubmit={handleGradeSubmit} className="space-y-5">
               <div>
                 <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Grade / Score</label>
                 <input
                   type="text"
                   required
                   value={gradeForm.grade}
                   onChange={e => setGradeForm({...gradeForm, grade: e.target.value})}
                   className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon font-medium"
                   placeholder="e.g. 85/100, A, Pass"
                 />
               </div>

               <div>
                 <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Feedback</label>
                 <textarea
                   rows={4}
                   value={gradeForm.feedback}
                   onChange={e => setGradeForm({...gradeForm, feedback: e.target.value})}
                   className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon font-medium resize-none"
                   placeholder="Write constructive feedback for the student..."
                 ></textarea>
               </div>

               <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-6">
                  <button type="button" onClick={() => setGradingStudent(null)} className="px-6 py-2.5 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                  <button type="submit" className="px-6 py-2.5 rounded-xl font-bold text-white bg-maroon hover:bg-rose-900 transition-colors flex items-center gap-2">
                    <Check className="h-4 w-4" /> Save Evaluation
                  </button>
               </div>
             </form>
          </div>
        </div>
      )}

    </div>
  );
}
