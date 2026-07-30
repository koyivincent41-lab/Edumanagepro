import React from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';

export default function Migration({ schoolId }: { schoolId: string }) {
  const runMigration = async () => {
    try {
      const entriesRef = collection(db, 'schools', schoolId, 'payroll_entries');
      const snapshot = await getDocs(entriesRef);
      
      for (const docSnap of snapshot.docs) {
        if (!docSnap.data().payslipNumber) {
          await updateDoc(docSnap.ref, {
            payslipNumber: (Math.floor(Math.random() * 90) + 10).toString()
          });
        }
      }
      toast.success('Migration completed successfully');
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('Migration failed');
    }
  };

  return (
    <button onClick={runMigration} className="px-4 py-2 bg-red-500 text-white rounded">
      Run Migration
    </button>
  );
}
