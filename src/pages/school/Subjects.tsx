import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, doc, addDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { School, Subject, Class, ClassSubject, Employee } from '../../types';
import { Plus, Search, Filter, Edit2, Trash2, BookOpen, Link as LinkIcon, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import SubjectForm from '../../components/SubjectForm';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrorHandler';
import { useBranch } from '../../context/BranchContext';

export default function Subjects({ school }: { school: School }) {
  const { currentBranch } = useBranch();
  const [activeTab, setActiveTab] = useState<'list' | 'assign'>('list');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // Assignment State
  const [selectedClassId, setSelectedClassId] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);

  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);

  useEffect(() => {
    // Fetch Subjects
    let subjectsQ = query(collection(db, 'subjects'), where('schoolId', '==', school.id));
    if (currentBranch) {
      subjectsQ = query(subjectsQ, where('branchId', '==', currentBranch.id));
    }
    const unsubSubjects = onSnapshot(
      subjectsQ,
      (snap) => {
        setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'subjects')
    );

    // Fetch Classes
    let classesQ = query(collection(db, 'schools', school.id, 'classes'));
    if (currentBranch) {
      classesQ = query(classesQ, where('branchId', '==', currentBranch.id));
    }
    const unsubClasses = onSnapshot(
      classesQ,
      (snap) => {
        setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `schools/${school.id}/classes`)
    );

    // Fetch Class-Subject Links
    let linksQ = query(collection(db, 'class_subjects'), where('schoolId', '==', school.id));
    if (currentBranch) {
      linksQ = query(linksQ, where('branchId', '==', currentBranch.id));
    }
    const unsubLinks = onSnapshot(
      linksQ,
      (snap) => {
        setClassSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassSubject)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'class_subjects')
    );

    // Fetch Employees (Teachers)
    let employeesQ = query(
      collection(db, 'employees'), 
      where('schoolId', '==', school.id),
      where('status', '==', 'active')
    );
    if (currentBranch) {
      employeesQ = query(employeesQ, where('branchId', '==', currentBranch.id));
    }
    const unsubEmployees = onSnapshot(
      employeesQ,
      (snap) => {
        setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'employees')
    );

    return () => {
      unsubSubjects();
      unsubClasses();
      unsubLinks();
      unsubEmployees();
    };
  }, [school.id, currentBranch]);

  const handleDeleteSubject = async () => {
    if (!subjectToDelete) return;

    try {
      await deleteDoc(doc(db, 'subjects', subjectToDelete));
      toast.success('Subject deleted successfully');
      setSubjectToDelete(null);
    } catch (error) {
      toast.error('Failed to delete subject');
    }
  };

  const confirmDelete = (id: string) => {
    // Check if linked to any classes
    const isLinked = classSubjects.some(link => link.subjectId === id);
    if (isLinked) {
      toast.error('Cannot delete subject that is assigned to classes. Unassign it first.');
      return;
    }
    setSubjectToDelete(id);
  };

  const filteredSubjects = subjects.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleSaveAssignments = async (assignments: { subjectId: string, teacherId?: string }[]) => {
    if (!selectedClassId) return;
    setSavingAssignment(true);
    try {
      const batch = writeBatch(db);
      
      // Remove existing assignments for this class
      const existingAssignments = classSubjects.filter(link => link.classId === selectedClassId);
      existingAssignments.forEach(link => {
        batch.delete(doc(db, 'class_subjects', link.id));
      });

      // Add new assignments
      assignments.forEach(assignment => {
        const newRef = doc(collection(db, 'class_subjects'));
        const teacher = employees.find(e => e.id === assignment.teacherId);
        batch.set(newRef, {
          schoolId: school.id,
          branchId: currentBranch?.id || null,
          classId: selectedClassId,
          subjectId: assignment.subjectId,
          teacherId: assignment.teacherId || null,
          teacherName: teacher?.fullName || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();
      toast.success('Subject assignments updated successfully');
    } catch (error) {
      console.error('Error saving assignments:', error);
      toast.error('Failed to update assignments');
    } finally {
      setSavingAssignment(false);
    }
  };

  const selectedClassAssignments = classSubjects
    .filter(link => link.classId === selectedClassId)
    .map(link => ({ 
      subjectId: link.subjectId, 
      teacherId: link.teacherId 
    }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Subject Management</h1>
          <p className="text-gray-500">Manage subjects and class assignments</p>
        </div>
        <button
          onClick={() => {
            setEditingSubject(null);
            setShowSubjectForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          Add Subject
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('list')}
          className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-colors relative ${
            activeTab === 'list' ? 'text-primary' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          All Subjects
          {activeTab === 'list' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab('assign')}
          className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-colors relative ${
            activeTab === 'assign' ? 'text-primary' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Assign Subjects to Classes
          {activeTab === 'assign' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
        </button>
      </div>

      {activeTab === 'list' ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search subjects by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border rounded-xl outline-none"
            >
              <option value="all">All Categories</option>
              <option value="Languages">Languages</option>
              <option value="Sciences">Sciences</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Humanities">Humanities</option>
              <option value="Technical">Technical</option>
              <option value="Other">Other</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-xl outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Subjects Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[700px] w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Subject</th>
                    <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Code</th>
                    <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Category</th>
                    <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                    <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 md:px-6 py-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                        <p className="text-gray-500">Loading subjects...</p>
                      </td>
                    </tr>
                  ) : filteredSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 md:px-6 py-12 text-center">
                        <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500 font-medium">No subjects found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSubjects.map((subject) => (
                      <tr key={subject.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 md:px-6 py-4">
                          <div className="font-bold text-gray-900">{subject.name}</div>
                          {subject.description && (
                            <div className="text-xs text-gray-500 line-clamp-1">{subject.description}</div>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold">
                            {subject.code}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-4 text-sm text-gray-600">
                          {subject.category || 'N/A'}
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            subject.status === 'active' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {subject.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {subject.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingSubject(subject);
                                setShowSubjectForm(true);
                              }}
                              className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => confirmDelete(subject.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Class Selection */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-primary" />
                Select Class
              </h3>
              <div className="space-y-2">
                {classes.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClassId(c.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all border ${
                      selectedClassId === c.id
                        ? 'bg-primary/5 border-primary text-primary font-bold shadow-sm'
                        : 'bg-white border-gray-100 text-gray-600 hover:border-primary/30'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
                {classes.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4 italic">No classes found</p>
                )}
              </div>
            </div>
          </div>

          {/* Subject Assignment */}
          <div className="lg:col-span-2 space-y-4">
            {selectedClassId ? (
              <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold">
                      Assign Subjects to {classes.find(c => c.id === selectedClassId)?.name}
                    </h3>
                    <p className="text-sm text-gray-500">Select subjects and assign teachers for this class</p>
                  </div>
                  <button
                    onClick={() => handleSaveAssignments(selectedClassAssignments)}
                    disabled={savingAssignment}
                    className="px-4 md:px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingAssignment ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                  </button>
                </div>

                <div className="space-y-3">
                  {subjects.filter(s => s.status === 'active').map((subject) => {
                    const assignment = selectedClassAssignments.find(a => a.subjectId === subject.id);
                    const isAssigned = !!assignment;
                    
                    return (
                      <div
                        key={subject.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
                          isAssigned
                            ? 'bg-primary/5 border-primary shadow-sm'
                            : 'bg-white border-gray-100 hover:border-primary/30'
                        }`}
                      >
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={(e) => {
                              const newAssignments = e.target.checked
                                ? [...selectedClassAssignments, { subjectId: subject.id }]
                                : selectedClassAssignments.filter(a => a.subjectId !== subject.id);
                              handleSaveAssignments(newAssignments);
                            }}
                            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <div>
                            <div className={`font-bold ${isAssigned ? 'text-primary' : 'text-gray-900'}`}>
                              {subject.name}
                            </div>
                            <div className="text-xs text-gray-500">{subject.code}</div>
                          </div>
                        </label>

                        {isAssigned && (
                          <div className="flex items-center gap-2 min-w-[200px]">
                            <select
                              value={assignment.teacherId || ''}
                              onChange={(e) => {
                                const newAssignments = selectedClassAssignments.map(a => 
                                  a.subjectId === subject.id ? { ...a, teacherId: e.target.value } : a
                                );
                                handleSaveAssignments(newAssignments);
                              }}
                              className="w-full p-2 text-sm border rounded-lg bg-white focus:ring-2 focus:ring-primary/20 outline-none"
                            >
                              <option value="">Assign Teacher</option>
                              {employees
                                .filter(e => e.jobTitle.toLowerCase().includes('teacher') || e.department.toLowerCase().includes('academic'))
                                .map(teacher => (
                                  <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>
                                ))
                              }
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {subjects.filter(s => s.status === 'active').length === 0 && (
                  <div className="text-center py-12">
                    <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">No active subjects available to assign</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
                <LinkIcon className="w-16 h-16 mx-auto text-gray-200 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Class Selected</h3>
                <p className="text-gray-500 max-w-xs mx-auto">
                  Please select a class from the left panel to manage its assigned subjects.
                </p>
              </div>
            )}

            {/* Assignment Summary Table */}
            {selectedClassId && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 md:px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                  <h4 className="font-bold text-gray-900">Current Assignments</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[700px] w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 md:px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-widest">Subject Name</th>
                        <th className="px-4 md:px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-widest">Code</th>
                        <th className="px-4 md:px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-widest">Teacher</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {selectedClassAssignments.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 md:px-6 py-4 md:py-8 text-center text-gray-500 italic">
                            No subjects assigned to this class yet
                          </td>
                        </tr>
                      ) : (
                        selectedClassAssignments.map(assignment => {
                          const subject = subjects.find(s => s.id === assignment.subjectId);
                          const teacher = employees.find(e => e.id === assignment.teacherId);
                          if (!subject) return null;
                          return (
                            <tr key={assignment.subjectId} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 md:px-6 py-4 font-bold text-gray-900">{subject.name}</td>
                              <td className="px-4 md:px-6 py-4">
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold">
                                  {subject.code}
                                </span>
                              </td>
                              <td className="px-4 md:px-6 py-4 text-sm text-gray-600">
                                {teacher ? (
                                  <span className="font-medium text-primary">{teacher.fullName}</span>
                                ) : (
                                  <span className="text-amber-500 italic">No teacher assigned</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showSubjectForm && (
        <SubjectForm
          school={school}
          subject={editingSubject}
          onClose={() => {
            setShowSubjectForm(false);
            setEditingSubject(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {subjectToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-[calc(100%-2rem)] md:w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 md:p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Subject?</h3>
              <p className="text-gray-500 mb-8">
                Are you sure you want to delete <span className="font-bold text-gray-900">{subjects.find(s => s.id === subjectToDelete)?.name}</span>? 
                This action cannot be undone and will permanently remove the subject from the system.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setSubjectToDelete(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSubject}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:scale-105 transition-all"
                >
                  Delete Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
