import React, { useState, useEffect } from 'react';
import { School, ExamSession } from '../../../types';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useBranch } from '../../../context/BranchContext';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreErrorHandler';
import { Loader2, Plus, Edit, Trash2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import ExamSessionForm from '../../../components/ExamSessionForm';
import ConfirmationModal from '../../../components/ConfirmationModal';

export default function ExamSessions({ schoolId, school }: { schoolId: string, school: School | null }) {
  const { currentBranch } = useBranch();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let q = query(collection(db, 'exam_sessions'), where('schoolId', '==', schoolId));
    if (currentBranch) {
      q = query(q, where('branchId', '==', currentBranch.id));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamSession)));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'exam_sessions')
    );

    return () => unsubscribe();
  }, [schoolId, currentBranch]);

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      // Find all exam results tied to this session
      const resultsQ = query(collection(db, 'exam_results'), where('examSessionId', '==', id));
      const resultsSnap = await getDocs(resultsQ);
      
      // Firestore batches are limited to 500 operations
      const BATCH_SIZE = 450;
      const docs = resultsSnap.docs;
      
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + BATCH_SIZE);
        chunk.forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
      }
      
      // Delete the session itself
      await deleteDoc(doc(db, 'exam_sessions', id));
      
      toast.success('Exam session and related records permanently deleted');
      setSessionToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'exam_sessions');
      toast.error('Failed to delete exam session');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold text-white">Exam Sessions</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-bold"
        >
          <Plus className="w-4 h-4" /> New Session
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-4 md:p-8"><Loader2 className="animate-spin text-primary" /></div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">No Exam Sessions</h3>
          <p className="text-gray-500 mb-4">Create your first exam session to start recording marks.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-bold"
          >
            <Plus className="w-4 h-4" /> Create Session
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="min-w-[700px] w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                <th className="p-4">Exam Name</th>
                <th className="p-4">Type</th>
                <th className="p-4">Term/Year</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(session => (
                <tr key={session.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="p-4 font-medium text-gray-900">{session.examName}</td>
                  <td className="p-4 text-gray-600">{session.examType}</td>
                  <td className="p-4 text-gray-600">{session.term} - {session.academicYear}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      session.status === 'Open' ? 'bg-green-100 text-green-700' :
                      session.status === 'Closed' ? 'bg-red-100 text-red-700' :
                      session.status === 'Published' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <button 
                      onClick={() => setSelectedSession(session)}
                      className="p-2 text-gray-400 hover:text-primary transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setSessionToDelete(session.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!sessionToDelete}
        onClose={() => !isDeleting && setSessionToDelete(null)}
        onConfirm={() => sessionToDelete && handleDelete(sessionToDelete)}
        title="Delete Exam Session?"
        message={isDeleting ? "Deleting exam session and all related records... Please wait." : "Are you sure you want to permanently delete this exam session and all related marks? This action cannot be undone."}
        confirmText={isDeleting ? "Deleting..." : "Delete Permanently"}
        isLoading={isDeleting}
      />

      {(showForm || selectedSession) && school && (
        <ExamSessionForm
          school={school}
          session={selectedSession}
          onClose={() => {
            setShowForm(false);
            setSelectedSession(null);
          }}
        />
      )}
    </div>
  );
}
