import React, { createContext, useContext, useState, useEffect } from 'react';
import { Branch, UserProfile } from '../types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface BranchContextType {
  currentBranch: Branch | null;
  setCurrentBranch: (branch: Branch | null) => void;
  branches: Branch[];
  loadingBranches: boolean;
}

const BranchContext = createContext<BranchContextType>({
  currentBranch: null,
  setCurrentBranch: () => {},
  branches: [],
  loadingBranches: true,
});

export const useBranch = () => useContext(BranchContext);

export const BranchProvider: React.FC<{ profile: UserProfile | null, children: React.ReactNode }> = ({ profile, children }) => {
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);

  useEffect(() => {
    const fetchBranches = async () => {
      if (!profile || !profile.schoolId) {
        setBranches([]);
        setCurrentBranch(null);
        setLoadingBranches(false);
        return;
      }

      try {
        const q = query(collection(db, 'branches'), where('schoolId', '==', profile.schoolId));
        const snapshot = await getDocs(q);
        const fetchedBranches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
        setBranches(fetchedBranches);

        if (profile.role === 'branch-admin' && profile.branchId) {
          const assignedBranch = fetchedBranches.find(b => b.id === profile.branchId);
          setCurrentBranch(assignedBranch || null);
        } else if (fetchedBranches.length > 0) {
          // Default to the first branch if none is selected, or keep it null for "All Branches" view
          // For now, let's keep it null for owners to see organization overview
          if (profile.role === 'owner') {
            setCurrentBranch(null); // null means "All Branches" or "Organization Overview"
          } else {
            setCurrentBranch(fetchedBranches[0]);
          }
        }
      } catch (error) {
        console.error("Error fetching branches:", error);
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchBranches();
  }, [profile]);

  return (
    <BranchContext.Provider value={{ currentBranch, setCurrentBranch, branches, loadingBranches }}>
      {children}
    </BranchContext.Provider>
  );
};
