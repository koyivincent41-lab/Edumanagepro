import React, { useState } from 'react';
import { AcademicSettings } from '../../../../../types';
import { Settings, Save, AlertCircle } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../../firebase';
import { toast } from 'sonner';

interface AcademicSettingsPanelProps {
  schoolId: string;
  settings: AcademicSettings | null;
  onUpdate: (s: AcademicSettings) => void;
}

export default function AcademicSettingsPanel({ schoolId, settings, onUpdate }: AcademicSettingsPanelProps) {
  const [formData, setFormData] = useState<AcademicSettings>(settings || {
    enableRanking: true,
    rankingBasis: 'total',
    passMark: 50,
    updatedAt: new Date().toISOString()
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = { ...formData, updatedAt: new Date().toISOString() };
      await updateDoc(doc(db, 'schools', schoolId), {
        academicSettings: updated
      });
      onUpdate(updated);
      toast.success('Academic settings updated successfully');
    } catch (error) {
      console.error("Error saving academic settings:", error);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
            <h3 className="text-xl font-bold text-gray-900">Academic Policy Configuration</h3>
            <p className="text-sm text-gray-500">Configure how ranking and performance are calculated across the system.</p>
        </div>
      </div>

      <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <div>
                  <p className="text-sm font-bold text-gray-900">Enable Automated Ranking</p>
                  <p className="text-xs text-gray-500">Automatically position students based on performance.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.enableRanking}
                  onChange={(e) => setFormData({ ...formData, enableRanking: e.target.checked })}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
          </div>

          <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ranking Basis</label>
              <select
                value={formData.rankingBasis}
                onChange={(e) => setFormData({ ...formData, rankingBasis: e.target.value as any })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:border-primary outline-none"
              >
                  <option value="total">Total Marks</option>
                  <option value="average">Mean Average Score</option>
              </select>
              <p className="text-[10px] text-gray-500 italic p-1">Choose whether students are ranked by their cumulative points or percentile average.</p>
          </div>

          <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">General Pass Mark (%)</label>
              <input
                type="number"
                value={formData.passMark}
                onChange={(e) => setFormData({ ...formData, passMark: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:border-primary outline-none"
              />
          </div>

          <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 shrink-0" />
              <p className="text-xs text-orange-800 font-medium leading-relaxed">
                  Changes to academic settings will reflect globally on all new and existing examination reports, mark lists, and performance dashboards.
              </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 bg-school-gradient text-white rounded-2xl font-black shadow-lg shadow-primary/20 hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
              {saving ? 'UPDATING...' : (
                  <>
                    <Save className="h-5 w-5" /> SAVE CONFIGURATION
                  </>
              )}
          </button>
      </div>
    </div>
  );
}
