import React, { createContext, useContext, useState, useEffect } from 'react';
import { Branch, UserProfile, Class, Stream } from '../types';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface BranchContextType {
  currentBranch: Branch | null;
  setCurrentBranch: (branch: Branch | null) => void;
  branches: Branch[];
  loadingBranches: boolean;
  classes: Class[];
  streams: Stream[];
}

const BranchContext = createContext<BranchContextType>({
  currentBranch: null,
  setCurrentBranch: () => {},
  branches: [],
  loadingBranches: true,
  classes: [],
  streams: [],
});

export const useBranch = () => useContext(BranchContext);

export const BranchProvider: React.FC<{ profile: UserProfile | null, children: React.ReactNode }> = ({ profile, children }) => {
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);

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

  useEffect(() => {
    if (!profile || !profile.schoolId) {
      setClasses([]);
      setStreams([]);
      return;
    }

    let classesQuery = query(collection(db, 'schools', profile.schoolId, 'classes'));
    let streamsQuery = query(collection(db, 'schools', profile.schoolId, 'streams'));

    if (currentBranch) {
      classesQuery = query(classesQuery, where('branchId', '==', currentBranch.id));
      streamsQuery = query(streamsQuery, where('branchId', '==', currentBranch.id));
    }

    const unsubClasses = onSnapshot(classesQuery, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    });

    const unsubStreams = onSnapshot(streamsQuery, (snapshot) => {
      setStreams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stream)));
    });

    return () => {
      unsubClasses();
      unsubStreams();
    };
  }, [profile, currentBranch]);

  return (
    <BranchContext.Provider value={{ currentBranch, setCurrentBranch, branches, loadingBranches, classes, streams }}>
      {children}
    </BranchContext.Provider>
  );
};

