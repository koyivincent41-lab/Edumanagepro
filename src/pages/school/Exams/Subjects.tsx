import React, { useState, useEffect } from 'react';
import { School, Subject } from '../../../types';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useBranch } from '../../../context/BranchContext';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreErrorHandler';
import { Loader2, Plus, Edit, Trash2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import SubjectForm from '../../../components/SubjectForm';

export default function Subjects({ schoolId, school }: { schoolId: string, school: School | null }) {
  const { currentBranch } = useBranch();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  useEffect(() => {
    let q = query(collection(db, 'subjects'), where('schoolId', '==', schoolId));
    if (currentBranch) {
      q = query(q, where('branchId', '==', currentBranch.id));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setSubjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'subjects')
    );

    return () => unsubscribe();
  }, [schoolId, currentBranch]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Subjects</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-bold"
        >
          <Plus className="w-4 h-4" /> Add Subject
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
      ) : subjects.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">No Subjects</h3>
          <p className="text-gray-500 mb-4">Add subjects to start configuring exams.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-bold"
          >
            <Plus className="w-4 h-4" /> Add Subject
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                <th className="p-4">Subject Name</th>
                <th className="p-4">Code</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(subject => (
                <tr key={subject.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="p-4 font-medium text-gray-900">{subject.name}</td>
                  <td className="p-4 text-gray-600">{subject.code}</td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => setSelectedSubject(subject)}
                      className="p-2 text-gray-400 hover:text-primary transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(showForm || selectedSubject) && school && (
        <SubjectForm
          school={school}
          subject={selectedSubject}
          onClose={() => {
            setShowForm(false);
            setSelectedSubject(null);
          }}
        />
      )}
    </div>
  );
}
