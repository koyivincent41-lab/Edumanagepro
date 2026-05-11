import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { School } from '../../types';
import { Globe, ExternalLink, Copy, CheckCircle2, AlertCircle, Save, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';

export default function Website({ school }: { school: School | null }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [websiteData, setWebsiteData] = useState<any>(null);

  useEffect(() => {
    const fetchWebsiteData = async () => {
      if (!school?.id) return;
      try {
        const docRef = doc(db, 'websites', school.id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setWebsiteData(docSnap.data());
        } else {
          // Generate a default slug from school name
          const defaultSlug = school.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
          setWebsiteData({
            slug: defaultSlug,
            isPublished: false,
            heroTitle: '',
            heroSubtitle: '',
            aboutText: '',
            mission: '',
            vision: '',
            values: ''
          });
        }
      } catch (error) {
        console.error('Error fetching website data:', error);
        toast.error('Failed to load website settings');
      } finally {
        setLoading(false);
      }
    };

    fetchWebsiteData();
  }, [school]);

  const handleSave = async () => {
    if (!school?.id || !websiteData) return;
    setSaving(true);
    try {
      const docRef = doc(db, 'websites', school.id);
      await setDoc(docRef, {
        ...websiteData,
        schoolId: school.id,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success('Website settings saved successfully');
    } catch (error) {
      console.error('Error saving website data:', error);
      toast.error('Failed to save website settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!school?.id || !websiteData) return;
    const newStatus = !websiteData.isPublished;
    setWebsiteData({ ...websiteData, isPublished: newStatus });
    
    try {
      const docRef = doc(db, 'websites', school.id);
      await setDoc(docRef, {
        ...websiteData,
        isPublished: newStatus,
        schoolId: school.id,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success(newStatus ? 'Website published successfully' : 'Website unpublished');
    } catch (error) {
      console.error('Error updating publish status:', error);
      toast.error('Failed to update website status');
      setWebsiteData({ ...websiteData, isPublished: !newStatus }); // Revert
    }
  };

  const publicUrl = `${window.location.origin}/s/${websiteData?.slug || school?.id}`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success('Link copied to clipboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Our Website</h1>
          <p className="text-gray-600 mt-1">Manage your school's public website</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => window.open(publicUrl, '_blank')}
            className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Preview
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Status Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-full ${websiteData?.isPublished ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Website Status</h3>
              <div className="flex items-center mt-1">
                {websiteData?.isPublished ? (
                  <span className="flex items-center text-sm text-green-600 font-medium">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Published & Live
                  </span>
                ) : (
                  <span className="flex items-center text-sm text-gray-500 font-medium">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    Not Published
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleTogglePublish}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              websiteData?.isPublished 
                ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                : 'bg-green-50 text-green-600 hover:bg-green-100'
            }`}
          >
            {websiteData?.isPublished ? 'Unpublish Website' : 'Publish Website'}
          </button>
        </div>

        {websiteData?.isPublished && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
            <div className="flex-1 truncate mr-4">
              <p className="text-sm text-gray-500 mb-1">Public Link</p>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium truncate block">
                {publicUrl}
              </a>
            </div>
            <button
              onClick={copyLink}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              title="Copy Link"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Content Editor */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center space-x-2">
            <LayoutTemplate className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-gray-900">Website Content</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Customize the content shown on your public website. Leave blank to use professional generic placeholders.
          </p>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">URL Slug</label>
              <div className="flex rounded-md shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                  /s/
                </span>
                <input
                  type="text"
                  value={websiteData?.slug || ''}
                  onChange={(e) => setWebsiteData({ ...websiteData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300 focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="school-name"
                />
              </div>
              <p className="text-xs text-gray-500">Letters, numbers, and hyphens only.</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 border-b pb-2">Homepage</h4>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Hero Title</label>
              <input
                type="text"
                value={websiteData?.heroTitle || ''}
                onChange={(e) => setWebsiteData({ ...websiteData, heroTitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                placeholder={`Welcome to ${school?.name}`}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Hero Subtitle</label>
              <input
                type="text"
                value={websiteData?.heroSubtitle || ''}
                onChange={(e) => setWebsiteData({ ...websiteData, heroSubtitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                placeholder="Nurturing learning, discipline, and excellence."
              />
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h4 className="font-medium text-gray-900 border-b pb-2">About Us Page</h4>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">About the School</label>
              <textarea
                value={websiteData?.aboutText || ''}
                onChange={(e) => setWebsiteData({ ...websiteData, aboutText: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                placeholder="Our school is committed to providing quality education in a supportive environment..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Mission</label>
                <textarea
                  value={websiteData?.mission || ''}
                  onChange={(e) => setWebsiteData({ ...websiteData, mission: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  placeholder="To empower students with knowledge..."
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Vision</label>
                <textarea
                  value={websiteData?.vision || ''}
                  onChange={(e) => setWebsiteData({ ...websiteData, vision: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  placeholder="To be a leading center of excellence..."
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Core Values</label>
                <textarea
                  value={websiteData?.values || ''}
                  onChange={(e) => setWebsiteData({ ...websiteData, values: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  placeholder="Integrity, Excellence, Respect..."
                />
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Contact information (email, phone, address) and school logo are automatically synced from your main dashboard Settings. You do not need to enter them here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
