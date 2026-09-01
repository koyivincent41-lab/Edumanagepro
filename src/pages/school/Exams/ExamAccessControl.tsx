import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, getDoc, where, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { Loader2, Search, Filter, ShieldCheck, CheckCircle2, XCircle, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmationModal from '../../../components/ConfirmationModal';

interface ExamAccessSettings {
  automationEnabled: boolean;
  globalDefaults: {
    'Openar Exams': boolean;
    'Opener Exams': boolean;
    'Midterm Exams': boolean;
    'End Term Exams': boolean;
    'Report Forms': boolean;
  };
  rules: {
    feeBalanceThreshold: number;
    graceDays: number;
  };
}

interface ExamAccessOverride {
  targetId: string;
  targetType: 'student' | 'parent';
  targetName: string;
  targetRef: string; // admission number or parent email
  status: 'allowed' | 'blocked';
  notes?: string;
  updatedAt: string;
}

export default function ExamAccessControl({ schoolId }: { schoolId: string }) {
  const [activeTab, setActiveTab] = useState<'automation' | 'students' | 'parents'>('automation');
  const [loading, setLoading] = useState(true);
  
  // Settings
  const [settings, setSettings] = useState<ExamAccessSettings>({
    automationEnabled: false,
    globalDefaults: {
      'Openar Exams': true,
      'Opener Exams': true,
      'Midterm Exams': true,
      'End Term Exams': true,
      'Report Forms': true,
    },
    rules: {
      feeBalanceThreshold: 0,
      graceDays: 0,
    }
  });

  // Overrides
  const [overrides, setOverrides] = useState<ExamAccessOverride[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isSaving, setIsSaving] = useState(false);
  const [removeModal, setRemoveModal] = useState<{isOpen: boolean, targetId: string | null}>({isOpen: false, targetId: null});

  useEffect(() => {
    loadData();
  }, [schoolId]);

  const loadData = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      // Load Settings
      const settingsRef = doc(db, 'schools', schoolId, 'exam_access_settings', 'master');
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        const loaded = settingsSnap.data() as ExamAccessSettings;
        if (loaded.globalDefaults) {
          const val = loaded.globalDefaults['Openar Exams'] ?? loaded.globalDefaults['Opener Exams'] ?? true;
          loaded.globalDefaults['Openar Exams'] = val;
          loaded.globalDefaults['Opener Exams'] = val;
        }
        setSettings(loaded);
      }

      // Load Overrides
      const overridesRef = collection(db, 'schools', schoolId, 'exam_access_overrides');
      const overridesSnap = await getDocs(overridesRef);
      setOverrides(overridesSnap.docs.map(d => ({ targetId: d.id, ...d.data() } as ExamAccessOverride)));

    } catch (error) {
      console.error("Error loading access control data:", error);
      toast.error('Failed to load access control data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const settingsRef = doc(db, 'schools', schoolId, 'exam_access_settings', 'master');
      await setDoc(settingsRef, settings, { merge: true });
      toast.success('Automation settings saved successfully');
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAutomation = async () => {
    const newStatus = !settings.automationEnabled;
    setSettings(prev => ({ ...prev, automationEnabled: newStatus }));
    
    // Auto save this specifically
    try {
      const settingsRef = doc(db, 'schools', schoolId, 'exam_access_settings', 'master');
      await setDoc(settingsRef, { automationEnabled: newStatus }, { merge: true });
      toast.success(newStatus ? 'Automation enabled' : 'Automation disabled');
    } catch (error) {
      toast.error('Failed to update automation status');
      setSettings(prev => ({ ...prev, automationEnabled: !newStatus }));
    }
  };

  const [overrideModal, setOverrideModal] = useState<{ isOpen: boolean, type: 'student' | 'parent', targetId?: string, targetName?: string, targetRef?: string, status?: 'allowed' | 'blocked', notes?: string }>({ isOpen: false, type: 'student' });
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearchEntity = async (term: string) => {
    if (!term || term.length < 3) return;
    setSearching(true);
    try {
      if (overrideModal.type === 'student') {
        const q = query(collection(db, 'schools', schoolId, 'students'));
        const snap = await getDocs(q);
        const results = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((d: any) => 
            d.fullName.toLowerCase().includes(term.toLowerCase()) || 
            (d.admissionNumber && d.admissionNumber.toLowerCase().includes(term.toLowerCase()))
          ).slice(0, 5);
        setSearchResults(results);
      } else {
        const q = query(collection(db, 'schools', schoolId, 'parents'));
        const snap = await getDocs(q);
        const results = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((d: any) => 
            (d.fullName && d.fullName.toLowerCase().includes(term.toLowerCase())) || 
            (d.email && d.email.toLowerCase().includes(term.toLowerCase()))
          ).slice(0, 5);
        setSearchResults(results);
      }
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setSearching(false);
    }
  };

  const logAudit = async (action: string, description: string) => {
    try {
      const auditRef = doc(collection(db, 'schools', schoolId, 'exam_access_logs'));
      await setDoc(auditRef, {
        action,
        description,
        userEmail: auth.currentUser?.email || 'Unknown Admin',
        userId: auth.currentUser?.uid || 'unknown',
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error('Failed to write audit log', e);
    }
  };

  const handleSaveOverride = async () => {
    if (!overrideModal.targetId || !overrideModal.status) return;
    setIsSaving(true);
    try {
      const targetRef = doc(db, 'schools', schoolId, 'exam_access_overrides', overrideModal.targetId);
      const data: Omit<ExamAccessOverride, 'targetId'> = {
        targetType: overrideModal.type,
        targetName: overrideModal.targetName || '',
        targetRef: overrideModal.targetRef || '',
        status: overrideModal.status,
        notes: overrideModal.notes || '',
        updatedAt: new Date().toISOString()
      };
      
      await setDoc(targetRef, data);
      await logAudit('Add Override', `Set override for ${overrideModal.type} ${overrideModal.targetName} to ${overrideModal.status}`);

      setOverrides(prev => {
        const existing = prev.filter(o => o.targetId !== overrideModal.targetId);
        return [...existing, { targetId: overrideModal.targetId!, ...data }];
      });
      toast.success('Access override saved successfully');
      setOverrideModal({ isOpen: false, type: 'student' });
    } catch (error) {
      console.error("Error saving override:", error);
      toast.error('Failed to save override');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveOverride = async () => {
    if (!removeModal.targetId) return;
    const targetId = removeModal.targetId;
    setIsSaving(true);
    try {
      const targetName = overrides.find(o => o.targetId === targetId)?.targetName || targetId;
      await deleteDoc(doc(db, 'schools', schoolId, 'exam_access_overrides', targetId));
      await logAudit('Remove Override', `Removed override for ${targetName}`);

      setOverrides(prev => prev.filter(o => o.targetId !== targetId));
      toast.success('Override removed successfully');
      setRemoveModal({ isOpen: false, targetId: null });
    } catch (error) {
      console.error("Error removing override:", error);
      toast.error('Failed to remove override');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleOverrideStatus = async (override: ExamAccessOverride) => {
    const newStatus = override.status === 'allowed' ? 'blocked' : 'allowed';
    try {
      const targetRef = doc(db, 'schools', schoolId, 'exam_access_overrides', override.targetId);
      await setDoc(targetRef, { status: newStatus, updatedAt: new Date().toISOString() }, { merge: true });
      await logAudit('Toggle Override Status', `Changed override status for ${override.targetName} to ${newStatus}`);

      setOverrides(prev => prev.map(o => o.targetId === override.targetId ? { ...o, status: newStatus } : o));
      toast.success(`Access ${newStatus === 'allowed' ? 'granted' : 'revoked'} successfully`);
    } catch (error) {
      console.error("Error toggling override status:", error);
      toast.error('Failed to change status');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const filteredOverrides = overrides.filter(o => o.targetType === (activeTab === 'students' ? 'student' : 'parent'))
    .filter(o => 
      searchTerm ? (o.targetName.toLowerCase().includes(searchTerm.toLowerCase()) || o.targetRef.toLowerCase().includes(searchTerm.toLowerCase())) : true
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Examination Results Access Control</h1>
          <p className="text-gray-500">Manage parent access to results via manual overrides or fee-based automation.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveTab('automation')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'automation' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
        >
          <Layers className="h-4 w-4 inline-block mr-2" /> Automation & Defaults
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'students' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
        >
          <ShieldCheck className="h-4 w-4 inline-block mr-2" /> Student Overrides
        </button>
        <button
          onClick={() => setActiveTab('parents')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'parents' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
        >
          <ShieldCheck className="h-4 w-4 inline-block mr-2" /> Parent Overrides
        </button>
      </div>

      {activeTab === 'automation' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900">Automation Master Switch</h2>
                <p className="text-sm text-gray-500 mt-1">If enabled, the system automatically checks fee balances before allowing access.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={settings.automationEnabled} onChange={handleToggleAutomation} />
                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
              </label>
            </div>

            <div className={`space-y-4 pt-6 border-t border-gray-100 ${!settings.automationEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <h3 className="font-bold text-gray-900">Automation Rules</h3>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Fee Balance Threshold (Max allowed balance)</label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-medium">KSh</span>
                  <input 
                    type="number" 
                    value={settings.rules.feeBalanceThreshold} 
                    onChange={e => setSettings(p => ({...p, rules: {...p.rules, feeBalanceThreshold: Number(e.target.value)}}))}
                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    min="0"
                  />
                </div>
                <p className="text-xs text-gray-500">If a student\'s total fee balance is strictly greater than this amount, results will be blocked.</p>
              </div>

              <div className="space-y-2 pt-2">
                <label className="block text-sm font-medium text-gray-700">Grace Period (Days)</label>
                <input 
                  type="number" 
                  value={settings.rules.graceDays} 
                  onChange={e => setSettings(p => ({...p, rules: {...p.rules, graceDays: Number(e.target.value)}}))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  min="0"
                />
                <p className="text-xs text-gray-500">Number of days after invoice due date before restriction applies (0 for immediate).</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-black text-gray-900">Default Access Status</h2>
              <p className="text-sm text-gray-500 mt-1">If automation is disabled, or for users passing the automation rules, what is their default access per exam type?</p>
            </div>

            <div className="space-y-4">
              {(Object.keys(settings.globalDefaults) as Array<keyof typeof settings.globalDefaults>)
                .filter(examType => examType !== 'Openar Exams')
                .map(examType => (
                  <div key={examType} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="font-medium text-gray-900">{examType}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={settings.globalDefaults[examType]} 
                        onChange={(e) => setSettings(p => {
                          const val = e.target.checked;
                          const updatedDefaults = { ...p.globalDefaults, [examType]: val };
                          if (examType === 'Opener Exams') {
                            updatedDefaults['Openar Exams'] = val;
                          }
                          return {
                            ...p,
                            globalDefaults: updatedDefaults
                          };
                        })} 
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                ))}
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {(activeTab === 'students' || activeTab === 'parents') && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-lg font-black text-gray-900">Manual {activeTab === 'students' ? 'Student' : 'Parent'} Overrides</h2>
              <p className="text-sm text-gray-500">These manually configured overrides take priority over automation and default rules.</p>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Filter overrides..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm"
                />
              </div>
              <button 
                onClick={() => setOverrideModal({ isOpen: true, type: activeTab === 'students' ? 'student' : 'parent' })}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 shrink-0"
              >
                Add Override
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase">Target Name</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase">Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase">Notes</th>
                  <th className="px-6 py-3 text-right text-xs font-black text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOverrides.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No overrides configured.
                    </td>
                  </tr>
                ) : (
                  filteredOverrides.map((override) => (
                    <tr key={override.targetId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-bold text-gray-900">{override.targetName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{override.targetRef}</td>
                      <td className="px-6 py-4">
                        {override.status === 'allowed' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Allowed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                            <XCircle className="h-3.5 w-3.5" /> Blocked
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate">{override.notes || '-'}</td>
                      <td className="px-6 py-4 text-right space-x-3">
                        <button 
                          onClick={() => handleToggleOverrideStatus(override)}
                          className={`${override.status === 'blocked' ? 'text-green-600 hover:text-green-800' : 'text-orange-500 hover:text-orange-700'} text-sm font-medium transition-colors`}
                        >
                          {override.status === 'blocked' ? 'Grant Access' : 'Revoke Access'}
                        </button>
                        <button 
                          onClick={() => setRemoveModal({ isOpen: true, targetId: override.targetId })}
                          className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {overrideModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Add {overrideModal.type === 'student' ? 'Student' : 'Parent'} Override</h2>
            
            <div className="space-y-4">
              {!overrideModal.targetId ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search {overrideModal.type}</label>
                  <input 
                    type="text" 
                    placeholder="Type name or ID to search..." 
                    className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary"
                    onChange={(e) => {
                      const term = e.target.value;
                      if (term.length >= 3) {
                        handleSearchEntity(term);
                      } else {
                        setSearchResults([]);
                      }
                    }}
                  />
                  {searching && <p className="text-xs text-blue-500 mt-2">Searching...</p>}
                  
                  {searchResults.length > 0 && (
                    <div className="mt-2 border rounded-lg bg-white overflow-hidden max-h-48 overflow-y-auto shadow-sm">
                      {searchResults.map((res: any) => (
                        <div 
                          key={res.id} 
                          onClick={() => {
                            setOverrideModal(prev => ({
                              ...prev,
                              targetId: res.id,
                              targetName: res.fullName || res.name || 'Unknown',
                              targetRef: res.admissionNumber || res.email || 'N/A'
                            }));
                            setSearchResults([]);
                          }}
                          className="p-3 hover:bg-gray-50 border-b last:border-0 cursor-pointer"
                        >
                          <p className="font-bold text-sm text-gray-900">{res.fullName || res.name}</p>
                          <p className="text-xs text-gray-500">{res.admissionNumber || res.email}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-900">{overrideModal.targetName}</p>
                    <p className="text-sm text-gray-500">{overrideModal.targetRef}</p>
                  </div>
                  <button onClick={() => setOverrideModal(p => ({...p, targetId: undefined, targetName: undefined, targetRef: undefined}))} className="text-xs text-blue-600 font-medium">Change</button>
                </div>
              )}

              {overrideModal.targetId && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Override Status</label>
                    <select 
                      value={overrideModal.status || ''} 
                      onChange={e => setOverrideModal(p => ({...p, status: e.target.value as 'allowed' | 'blocked'}))}
                      className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary bg-white"
                    >
                      <option value="">-- Select Status --</option>
                      <option value="allowed">Force Allowed (Grant Access)</option>
                      <option value="blocked">Force Blocked (Revoke Access)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                    <textarea 
                      value={overrideModal.notes || ''} 
                      onChange={e => setOverrideModal(p => ({...p, notes: e.target.value}))}
                      placeholder="Reason for override..."
                      className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary h-24 resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-8">
              <button 
                onClick={() => setOverrideModal({ isOpen: false, type: 'student' })}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveOverride}
                disabled={!overrideModal.targetId || !overrideModal.status || isSaving}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Override
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={removeModal.isOpen}
        onClose={() => setRemoveModal({ isOpen: false, targetId: null })}
        onConfirm={handleRemoveOverride}
        title="Remove Override"
        message="Are you sure you want to remove this access override? The user's access will revert to default/automation rules."
        confirmText={isSaving ? "Removing..." : "Remove"}
        variant="danger"
      />
    </div>
  );
}
