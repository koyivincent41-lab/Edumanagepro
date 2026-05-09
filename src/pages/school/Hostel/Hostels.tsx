import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Hostel } from '../../../types';
import { Building2, Plus, Edit2, Trash2, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function Hostels({ schoolId }: { schoolId: string }) {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHostel, setEditingHostel] = useState<Hostel | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'Boys' as 'Boys' | 'Girls' | 'Mixed',
    block: '',
    wardenName: '',
    wardenPhone: '',
    capacity: 0,
    description: ''
  });

  const [hostelToDelete, setHostelToDelete] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'schools', schoolId, 'hostels'));

    const unsub = onSnapshot(q, (snap) => {
      setHostels(snap.docs.map(d => ({ id: d.id, ...d.data() } as Hostel)));
      setLoading(false);
    });

    return () => unsub();
  }, [schoolId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingHostel) {
        await updateDoc(doc(db, 'schools', schoolId, 'hostels', editingHostel.id), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        toast.success("Hostel updated successfully");
      } else {
        await addDoc(collection(db, 'schools', schoolId, 'hostels'), {
          ...formData,
          schoolId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        toast.success("Hostel added successfully");
      }
      setIsModalOpen(false);
      setFormData({ name: '', type: 'Boys', block: '', wardenName: '', wardenPhone: '', capacity: 0, description: '' });
      setEditingHostel(null);
    } catch (err) {
      toast.error('Failed to save hostel');
    }
  };

  const handleDelete = async () => {
    if (hostelToDelete) {
      try {
        await deleteDoc(doc(db, 'schools', schoolId, 'hostels', hostelToDelete));
        toast.success('Hostel deleted successfully');
        setHostelToDelete(null);
      } catch (err) {
        toast.error('Failed to delete hostel');
      }
    }
  };

  const openEditModal = (h: Hostel) => {
    setEditingHostel(h);
    setFormData({
      name: h.name,
      type: h.type,
      block: h.block || '',
      wardenName: h.wardenName || '',
      wardenPhone: h.wardenPhone || '',
      capacity: h.capacity || 0,
      description: h.description || ''
    });
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">Hostels</h2>
        <button
          onClick={() => {
            setEditingHostel(null);
            setFormData({ name: '', type: 'Boys', block: '', wardenName: '', wardenPhone: '', capacity: 0, description: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-semibold"
        >
          <Plus className="w-5 h-5" />
          Add Hostel
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading hostels...</p>
      ) : hostels.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hostels added yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hostels.map(h => (
            <div key={h.id} className="bg-white border text-left border-gray-100 rounded-xl shadow-sm p-4 relative overflow-hidden">
              <div className="absolute top-2 right-2 flex gap-1">
                <button onClick={() => openEditModal(h)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => setHostelToDelete(h.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-indigo-50 rounded-lg">
                  <Building2 className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{h.name}</h3>
                  <p className="text-xs text-gray-500">{h.type} Hostel</p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Capacity:</span>
                  <span className="font-semibold text-gray-900">{h.capacity || 'N/A'}</span>
                </div>
                {h.block && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Block:</span>
                    <span className="font-semibold text-gray-900">{h.block}</span>
                  </div>
                )}
                {h.wardenName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Warden:</span>
                    <span className="font-semibold text-gray-900">{h.wardenName}</span>
                  </div>
                )}
                {h.wardenPhone && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone:</span>
                    <span className="font-semibold text-gray-900">{h.wardenPhone}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">
                {editingHostel ? 'Edit Hostel' : 'Add Hostel'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Hostel Name</label>
                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" placeholder="e.g. Sunrise Hostel" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
                  <select required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary">
                    <option value="Boys">Boys</option>
                    <option value="Girls">Girls</option>
                    <option value="Mixed">Mixed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Total Capacity</label>
                  <input type="number" min="0" value={formData.capacity || ''} onChange={e => setFormData({...formData, capacity: parseInt(e.target.value) || 0})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Block (Optional)</label>
                <input value={formData.block} onChange={e => setFormData({...formData, block: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" placeholder="e.g. Block A" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Warden Name (Optional)</label>
                  <input value={formData.wardenName} onChange={e => setFormData({...formData, wardenName: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" placeholder="e.g. John Doe" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Warden Phone (Optional)</label>
                  <input value={formData.wardenPhone} onChange={e => setFormData({...formData, wardenPhone: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" placeholder="e.g. 1234567890" />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-600 font-semibold hover:bg-gray-50 rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90">
                  {editingHostel ? 'Save Changes' : 'Add Hostel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {hostelToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden p-6 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Hostel</h3>
            <p className="text-gray-500 mb-6">Are you sure you want to permanently delete this hostel? This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setHostelToDelete(null)}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="px-5 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
