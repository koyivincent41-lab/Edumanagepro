import React, { useState, useEffect } from 'react';
import { School } from '../../../types';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';
import { Save, Settings as SettingsIcon } from 'lucide-react';

interface Props {
  schoolId: string;
  school: School | null;
}

export default function Settings({ schoolId, school }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    taxPin: '',
    nssfNumber: '',
    nhifNumber: '',
    payrollApprovalRequired: true,
    defaultPayDate: 25,
    currency: 'KES',
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'schools', schoolId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.payrollSettings) {
          setSettings({ ...settings, ...data.payrollSettings });
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [schoolId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'schools', schoolId), {
        payrollSettings: settings
      });
      toast.success('Payroll settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary/10 text-primary rounded-xl">
          <SettingsIcon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">Payroll Settings</h2>
          <p className="text-gray-500">Configure statutory details and payroll preferences</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">Statutory Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Tax PIN (KRA)</label>
              <input
                type="text"
                value={settings.taxPin}
                onChange={(e) => setSettings({ ...settings, taxPin: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="e.g. A123456789Z"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">NSSF Number</label>
              <input
                type="text"
                value={settings.nssfNumber}
                onChange={(e) => setSettings({ ...settings, nssfNumber: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">NHIF Number</label>
              <input
                type="text"
                value={settings.nhifNumber}
                onChange={(e) => setSettings({ ...settings, nhifNumber: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">Payroll Preferences</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Default Pay Date</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={settings.defaultPayDate}
                  onChange={(e) => setSettings({ ...settings, defaultPayDate: Number(e.target.value) })}
                  className="w-24 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <span className="text-gray-500 text-sm">of every month</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="approvalRequired"
                checked={settings.payrollApprovalRequired}
                onChange={(e) => setSettings({ ...settings, payrollApprovalRequired: e.target.checked })}
                className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <label htmlFor="approvalRequired" className="text-sm font-bold text-gray-700">
                Require approval before marking payroll as paid
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 md:px-8 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-bold"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Save className="h-5 w-5" />
            )}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
