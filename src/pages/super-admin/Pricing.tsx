import React, { useState, useEffect } from 'react';
import { 
  Layout, 
  Save, 
  Loader2, 
  Type, 
  CheckSquare, 
  MousePointer2,
  Eye,
  EyeOff
} from 'lucide-react';
import { doc, onSnapshot, updateDoc, collection, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Package } from '../../types';
import { toast } from 'sonner';

interface PricingSettings {
  title: string;
  subtitle: string;
  highlights: string[];
  buttonLabel: string;
  showTrialBadge: boolean;
}

export default function PricingManagement() {
  const [settings, setSettings] = useState<PricingSettings>({
    title: 'Simple, Transparent Pricing',
    subtitle: 'Choose the perfect plan for your school\'s needs.',
    highlights: ['No hidden fees', 'Cancel anytime', '24/7 Support'],
    buttonLabel: 'Get Started',
    showTrialBadge: true
  });
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'pricing'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as PricingSettings);
      }
      setLoading(false);
    });

    const unsubscribePackages = onSnapshot(collection(db, 'packages'), (snapshot) => {
      const packageData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Package));
      setPackages(packageData.sort((a, b) => (a.order || 0) - (b.order || 0)));
    });

    return () => {
      unsubscribeSettings();
      unsubscribePackages();
    };
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'pricing'), settings);
      toast.success('Pricing settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const togglePackageVisibility = async (pkg: Package) => {
    try {
      await updateDoc(doc(db, 'packages', pkg.id), {
        status: pkg.status === 'active' ? 'inactive' : 'active'
      });
      toast.success(`Package ${pkg.status === 'active' ? 'hidden' : 'shown'} successfully`);
    } catch (error) {
      toast.error('Failed to update package visibility');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Pricing Page Management</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Manage how subscription plans are displayed on the public website.</p>
          </div>
          <button 
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-white text-maroon rounded-xl font-bold hover:bg-white/90 transition-all disabled:opacity-50 shadow-lg"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Text Settings */}
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/5 text-primary rounded-lg">
              <Type className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Page Content</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Main Title</label>
              <input 
                type="text"
                value={settings.title}
                onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Subtitle</label>
              <textarea 
                value={settings.subtitle}
                onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary h-24 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Button Label</label>
              <div className="relative">
                <MousePointer2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                  type="text"
                  value={settings.buttonLabel}
                  onChange={(e) => setSettings({ ...settings, buttonLabel: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Highlights Settings */}
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/5 text-primary rounded-lg">
              <CheckSquare className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Feature Highlights</h2>
          </div>

          <div className="space-y-4">
            {settings.highlights.map((highlight, index) => (
              <div key={index} className="flex gap-2">
                <input 
                  type="text"
                  value={highlight}
                  onChange={(e) => {
                    const newHighlights = [...settings.highlights];
                    newHighlights[index] = e.target.value;
                    setSettings({ ...settings, highlights: newHighlights });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary"
                />
                <button 
                  onClick={() => {
                    const newHighlights = settings.highlights.filter((_, i) => i !== index);
                    setSettings({ ...settings, highlights: newHighlights });
                  }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <EyeOff className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button 
              onClick={() => setSettings({ ...settings, highlights: [...settings.highlights, ''] })}
              className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold hover:border-primary hover:text-primary transition-all"
            >
              + Add Highlight
            </button>
          </div>
        </div>

        {/* Package Visibility */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/5 text-primary rounded-lg">
              <Layout className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Package Visibility</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className={`p-4 rounded-2xl border transition-all ${
                pkg.status === 'active' ? 'border-primary/20 bg-primary/5' : 'border-gray-100 bg-gray-50 opacity-60'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900">{pkg.name}</h3>
                  <button 
                    onClick={() => togglePackageVisibility(pkg)}
                    className={`p-2 rounded-lg transition-colors ${
                      pkg.status === 'active' ? 'text-primary hover:bg-primary/10' : 'text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {pkg.status === 'active' ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">{pkg.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">${pkg.monthlyPrice}/mo</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                    pkg.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {pkg.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
