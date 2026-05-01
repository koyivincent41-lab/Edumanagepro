import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';
import { GradingBand } from '../../../types';
import { useBranch } from '../../../context/BranchContext';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreErrorHandler';

export default function GradingSystemSettings({ schoolId }: { schoolId: string }) {
  const { currentBranch } = useBranch();
  const [bands, setBands] = useState<GradingBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchGradingSystem = async () => {
      try {
        const docId = currentBranch ? `${schoolId}_${currentBranch.id}` : schoolId;
        const docRef = doc(db, 'grading_systems', docId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setBands(docSnap.data().bands || []);
        } else {
          // Default bands
          setBands([
            { id: '1', gradeName: 'A', minScore: 80, maxScore: 100, remarks: 'Excellent' },
            { id: '2', gradeName: 'B', minScore: 70, maxScore: 79, remarks: 'Very Good' },
            { id: '3', gradeName: 'C', minScore: 60, maxScore: 69, remarks: 'Good' },
            { id: '4', gradeName: 'D', minScore: 50, maxScore: 59, remarks: 'Fair' },
            { id: '5', gradeName: 'E', minScore: 0, maxScore: 49, remarks: 'Needs Improvement' },
          ]);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `grading_systems/${currentBranch ? `${schoolId}_${currentBranch.id}` : schoolId}`);
        console.error('Error fetching grading system:', error);
        toast.error('Failed to load grading system');
      } finally {
        setLoading(false);
      }
    };

    fetchGradingSystem();
  }, [schoolId, currentBranch]);

  const handleAddBand = () => {
    setBands([...bands, { id: Date.now().toString(), gradeName: '', minScore: 0, maxScore: 0, remarks: '' }]);
  };

  const handleRemoveBand = (id: string) => {
    setBands(bands.filter(b => b.id !== id));
  };

  const handleChange = (id: string, field: keyof GradingBand, value: string | number) => {
    setBands(bands.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const docId = currentBranch ? `${schoolId}_${currentBranch.id}` : schoolId;
      const docRef = doc(db, 'grading_systems', docId);
      await setDoc(docRef, {
        schoolId,
        ...(currentBranch ? { branchId: currentBranch.id } : {}),
        bands,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success('Grading system saved successfully');
    } catch (error) {
      console.error('Error saving grading system:', error);
      toast.error('Failed to save grading system');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-4"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="p-3 text-xs font-bold text-gray-600 uppercase">Grade</th>
              <th className="p-3 text-xs font-bold text-gray-600 uppercase">Min Score</th>
              <th className="p-3 text-xs font-bold text-gray-600 uppercase">Max Score</th>
              <th className="p-3 text-xs font-bold text-gray-600 uppercase">Remarks</th>
              <th className="p-3 text-xs font-bold text-gray-600 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bands.map((band, index) => (
              <tr key={band.id} className="border-b border-gray-100">
                <td className="p-2">
                  <input
                    type="text"
                    value={band.gradeName}
                    onChange={(e) => handleChange(band.id, 'gradeName', e.target.value)}
                    className="w-full p-2 border rounded-lg text-sm"
                    placeholder="e.g. A"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    value={band.minScore}
                    onChange={(e) => handleChange(band.id, 'minScore', Number(e.target.value))}
                    className="w-full p-2 border rounded-lg text-sm"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    value={band.maxScore}
                    onChange={(e) => handleChange(band.id, 'maxScore', Number(e.target.value))}
                    className="w-full p-2 border rounded-lg text-sm"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="text"
                    value={band.remarks}
                    onChange={(e) => handleChange(band.id, 'remarks', e.target.value)}
                    className="w-full p-2 border rounded-lg text-sm"
                    placeholder="e.g. Excellent"
                  />
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => handleRemoveBand(band.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="flex justify-between items-center pt-4">
        <button
          onClick={handleAddBand}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Grade Band
        </button>
        
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Grading System
        </button>
      </div>
    </div>
  );
}
