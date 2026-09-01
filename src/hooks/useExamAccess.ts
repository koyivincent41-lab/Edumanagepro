import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Student } from '../types';

interface ExamAccessSettings {
  automationEnabled: boolean;
  globalDefaults: {
    'Openar Exams'?: boolean;
    'Opener Exams'?: boolean;
    'Midterm Exams': boolean;
    'End Term Exams': boolean;
    'Report Forms': boolean;
  };
  rules: {
    feeBalanceThreshold: number;
    graceDays: number;
  };
}

export function useExamAccess(schoolId: string, parentId: string) {
  const [accessSettings, setAccessSettings] = useState<ExamAccessSettings | null>(null);
  const [overrides, setOverrides] = useState<Record<string, 'allowed' | 'blocked'>>({});
  const [parentOverride, setParentOverride] = useState<'allowed' | 'blocked' | null>(null);
  const [studentBalances, setStudentBalances] = useState<Record<string, number>>({});
  const [loadingAccess, setLoadingAccess] = useState(true);

  useEffect(() => {
    if (!schoolId || !parentId) return;

    const loadAccessData = async () => {
      try {
        // 1. Settings
        const settingsRef = doc(db, 'schools', schoolId, 'exam_access_settings', 'master');
        const settingsSnap = await getDoc(settingsRef);
        const settingsData = settingsSnap.exists() ? settingsSnap.data() as ExamAccessSettings : null;
        setAccessSettings(settingsData);

        // 2. Fetch Parent's Students First
        const myKidsQ = query(collection(db, 'schools', schoolId, 'students'), where('parentId', '==', parentId));
        const kidsSnap = await getDocs(myKidsQ);
        const studentIds = kidsSnap.docs.map(k => k.id);

        // 3. Overrides (Parent & their children)
        let pOverride: 'allowed' | 'blocked' | null = null;
        const pOverrideSnap = await getDoc(doc(db, 'schools', schoolId, 'exam_access_overrides', parentId));
        if (pOverrideSnap.exists()) {
          pOverride = pOverrideSnap.data().status;
        }

        const ovs: Record<string, 'allowed' | 'blocked'> = {};
        if (studentIds.length > 0) {
          const kidsOverridesSnaps = await Promise.all(
            studentIds.map(id => getDoc(doc(db, 'schools', schoolId, 'exam_access_overrides', id)))
          );
          kidsOverridesSnaps.forEach(snap => {
            if (snap.exists() && snap.data().targetType === 'student') {
              ovs[snap.id] = snap.data().status;
            }
          });
        }

        setParentOverride(pOverride);
        setOverrides(ovs);

        // 4. If automation enabled, calculate balances for parent's students
        if (settingsData?.automationEnabled) {
          const balances: Record<string, number> = {};
          
          // Initial arrears
          kidsSnap.docs.forEach(doc => {
             balances[doc.id] = doc.data().arrears || 0;
          });

          // Unpaid invoices
          if (studentIds.length > 0) {
            // chunking studentIds by 10
            for (let i = 0; i < studentIds.length; i+=10) {
              const chunk = studentIds.slice(i, i+10);
              const invQ = query(
                collection(db, 'schools', schoolId, 'invoices'), 
                where('studentId', 'in', chunk)
              );
              const invSnap = await getDocs(invQ);
              invSnap.docs.forEach(inv => {
                const data = inv.data();
                if (['sent', 'partial', 'overdue'].includes(data.status) && data.balanceDue > 0) {
                  balances[data.studentId] = (balances[data.studentId] || 0) + data.balanceDue;
                }
              });
            }
          }

          setStudentBalances(balances);
        }

      } catch (error) {
        console.error("Error loading access constraints", error);
      } finally {
        setLoadingAccess(false);
      }
    };

    loadAccessData();
  }, [schoolId, parentId]);

  const checkAccess = (studentId: string, examTypeCategory: 'Openar Exams' | 'Opener Exams' | 'Midterm Exams' | 'End Term Exams' | 'Report Forms'): boolean => {
    // 1. Parent Override
    if (parentOverride === 'allowed') return true;
    if (parentOverride === 'blocked') return false;

    // 2. Student Override
    if (overrides[studentId] === 'allowed') return true;
    if (overrides[studentId] === 'blocked') return false;

    // 3. Automation
    if (accessSettings && accessSettings.automationEnabled) {
      const balance = studentBalances[studentId] || 0;
      if (balance > (accessSettings.rules?.feeBalanceThreshold || 0)) {
        return false;
      }
    }

    // 4. Global Defaults
    if (accessSettings && accessSettings.globalDefaults) {
      if (examTypeCategory === 'Openar Exams' || examTypeCategory === 'Opener Exams') {
        return accessSettings.globalDefaults['Opener Exams'] ?? accessSettings.globalDefaults['Openar Exams'] ?? true;
      }
      return accessSettings.globalDefaults[examTypeCategory] ?? true;
    }

    // Fallback default
    return true;
  };

  return { loadingAccess, checkAccess };
}
