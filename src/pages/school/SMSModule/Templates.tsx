import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { SMSTemplate } from '../../../types';
import { FileText, Plus, Edit2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function Templates({ schoolId }: { schoolId: string }) {
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'schools', schoolId, 'smsTemplates'));
    const unsub = onSnapshot(q, (snap) => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as SMSTemplate)));
      setLoading(false);
    });

    return () => unsub();
  }, [schoolId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return;
    
    try {
      if (editingTemplate) {
        await updateDoc(doc(db, 'schools', schoolId, 'smsTemplates', editingTemplate.id), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        toast.success("Template updated successfully");
      } else {
        await addDoc(collection(db, 'schools', schoolId, 'smsTemplates'), {
          ...formData,
          schoolId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        toast.success("Template added successfully");
      }
      setIsModalOpen(false);
      setFormData({ title: '', content: '' });
      setEditingTemplate(null);
    } catch (err) {
      toast.error('Failed to save template');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        await deleteDoc(doc(db, 'schools', schoolId, 'smsTemplates', id));
        toast.success('Template deleted successfully');
      } catch (err) {
        toast.error('Failed to delete template');
      }
    }
  };

  const openEditModal = (t: SMSTemplate) => {
    setEditingTemplate(t);
    setFormData({
      title: t.title,
      content: t.content
    });
    setIsModalOpen(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">Message Templates</h2>
        <button
          onClick={() => {
            setEditingTemplate(null);
            setFormData({ title: '', content: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-semibold"
        >
          <Plus className="w-5 h-5" />
          Add Template
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading templates...</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No templates added yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {templates.map(t => (
            <div key={t.id} className="bg-white border text-left border-gray-100 rounded-xl shadow-sm p-4 relative overflow-hidden group">
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEditModal(t)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(t.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-indigo-50 rounded-lg">
                  <FileText className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{t.title}</h3>
                </div>
              </div>
              
              <div className="text-sm text-gray-600 whitespace-pre-wrap mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                {t.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-[calc(100%-2rem)] md:w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">
                {editingTemplate ? 'Edit Template' : 'Add Template'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" placeholder="e.g. Fee Reminder" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Content</label>
                <textarea required rows={5} value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary resize-none" placeholder="Type your message template here..." />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-600 font-semibold hover:bg-gray-50 rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90">
                  {editingTemplate ? 'Save Changes' : 'Add Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
