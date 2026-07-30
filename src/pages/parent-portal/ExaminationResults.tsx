import React, { useState, useEffect } from 'react';
import ParentLayout from '../../components/ParentLayout';
import { UserProfile } from '../../types';
import { LayoutDashboard, FileText, Loader2 } from 'lucide-react';
import ParentExamRecordsBrowser from '../../components/ParentExamRecordsBrowser';
import ParentReportFormBrowser from '../../components/ParentReportFormBrowser';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

type TabType = 'opener' | 'midterm' | 'end_term' | 'report_form';

export default function parentExaminationResults({ profile }: { profile: UserProfile }) {
  const [activeTab, setActiveTab] = useState<TabType>('opener');
  const [parentId, setParentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !profile.schoolId || !profile.uid) return;

    const findParentId = async () => {
      try {
        const parentsQuery = query(
          collection(db, 'schools', profile.schoolId!, 'parents'), 
          where('uid', '==', profile.uid)
        );
        const parentsSnapshot = await getDocs(parentsQuery);
        
        let pId = '';
        if (!parentsSnapshot.empty) {
          pId = parentsSnapshot.docs[0].id;
        } else {
          // Check if profile.uid is actually the parent document ID (from localStorage login)
          const parentDoc = await getDoc(doc(db, 'schools', profile.schoolId!, 'parents', profile.uid));
          if (parentDoc.exists()) {
            pId = parentDoc.id;
          }
        }
        setParentId(pId);
      } catch (error) {
        console.error("Error fetching parent ID:", error);
      } finally {
        setLoading(false);
      }
    };

    findParentId();
  }, [profile]);

  if (loading) {
    return (
      <ParentLayout profile={profile}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ParentLayout>
    );
  }

  if (!parentId) {
    return (
      <ParentLayout profile={profile}>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500 font-medium">Could not load parent profile. Please try again later.</p>
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout profile={profile}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Examination Results</h1>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button 
            onClick={() => setActiveTab('opener')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all ${activeTab === 'opener' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
          >
            <LayoutDashboard className="h-5 w-5" />
            Open Exams
          </button>
          <button 
            onClick={() => setActiveTab('midterm')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all ${activeTab === 'midterm' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
          >
            <LayoutDashboard className="h-5 w-5" />
            Mid-Term Exams
          </button>
          <button 
            onClick={() => setActiveTab('end_term')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all ${activeTab === 'end_term' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
          >
            <LayoutDashboard className="h-5 w-5" />
            End-Term Exams
          </button>
          <button 
            onClick={() => setActiveTab('report_form')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all ${activeTab === 'report_form' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
          >
            <FileText className="h-5 w-5" />
            Termly Report
          </button>
        </div>

        {activeTab === 'opener' && (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Open Exams Records</h2>
              <p className="text-gray-500 dark:text-gray-400">View and download stored results for Open Exams for your children.</p>
            </div>
            <ParentExamRecordsBrowser schoolId={profile.schoolId!} parentId={parentId} examsCategory="Openar Exams" />
          </>
        )}

        {activeTab === 'midterm' && (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Mid-Term Exams Records</h2>
              <p className="text-gray-500 dark:text-gray-400">View and download stored results for Mid-Term Exams for your children.</p>
            </div>
            <ParentExamRecordsBrowser schoolId={profile.schoolId!} parentId={parentId} examsCategory="Midterm Exams" />
          </>
        )}

        {activeTab === 'end_term' && (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">End-Term Exams Records</h2>
              <p className="text-gray-500 dark:text-gray-400">View and download stored results for End-Term Exams for your children.</p>
            </div>
            <ParentExamRecordsBrowser schoolId={profile.schoolId!} parentId={parentId} examsCategory="End Term Exams" />
          </>
        )}

        {activeTab === 'report_form' && (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Termly Report Form</h2>
              <p className="text-gray-500 dark:text-gray-400">View and download full end-of-term report forms for your children.</p>
            </div>
            <ParentReportFormBrowser schoolId={profile.schoolId!} parentId={parentId} />
          </>
        )}
      </div>
    </ParentLayout>
  );
}
