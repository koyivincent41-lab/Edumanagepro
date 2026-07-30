import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Hostel, HostelRoom } from '../../../types';
import { Bed, Plus, Edit2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function Rooms({ schoolId }: { schoolId: string }) {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<HostelRoom | null>(null);

  const [formData, setFormData] = useState({
    hostelId: '',
    roomNumber: '',
    type: '2-Seater',
    capacity: 2,
    costPerTerm: 0,
    description: ''
  });

  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);

  useEffect(() => {
    const qHostels = query(collection(db, 'schools', schoolId, 'hostels'));
    const unsubHostels = onSnapshot(qHostels, (snap) => {
      setHostels(snap.docs.map(d => ({ id: d.id, ...d.data() } as Hostel)));
    });

    const qRooms = query(collection(db, 'schools', schoolId, 'hostelRooms'));
    const unsubRooms = onSnapshot(qRooms, (snap) => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as HostelRoom)));
      setLoading(false);
    });

    return () => {
      unsubHostels();
      unsubRooms();
    };
  }, [schoolId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hostelId) {
      toast.error('Please select a hostel');
      return;
    }
    
    try {
      if (editingRoom) {
        await updateDoc(doc(db, 'schools', schoolId, 'hostelRooms', editingRoom.id), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        toast.success("Room updated successfully");
      } else {
        await addDoc(collection(db, 'schools', schoolId, 'hostelRooms'), {
          ...formData,
          schoolId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        toast.success("Room added successfully");
      }
      setIsModalOpen(false);
      setFormData({ hostelId: '', roomNumber: '', type: '2-Seater', capacity: 2, costPerTerm: 0, description: '' });
      setEditingRoom(null);
    } catch (err) {
      toast.error('Failed to save room');
    }
  };

  const handleDelete = async () => {
    if (roomToDelete) {
      try {
        await deleteDoc(doc(db, 'schools', schoolId, 'hostelRooms', roomToDelete));
        toast.success('Room deleted successfully');
        setRoomToDelete(null);
      } catch (err) {
        toast.error('Failed to delete room');
      }
    }
  };

  const openEditModal = (r: HostelRoom) => {
    setEditingRoom(r);
    setFormData({
      hostelId: r.hostelId,
      roomNumber: r.roomNumber,
      type: r.type,
      capacity: r.capacity || 2,
      costPerTerm: r.costPerTerm || 0,
      description: r.description || ''
    });
    setIsModalOpen(true);
  };

  const getHostelName = (id: string) => hostels.find(h => h.id === id)?.name || 'Unknown Hostel';

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">Rooms</h2>
        <button
          onClick={() => {
            setEditingRoom(null);
            setFormData({ hostelId: hostels[0]?.id || '', roomNumber: '', type: '2-Seater', capacity: 2, costPerTerm: 0, description: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-semibold"
          disabled={hostels.length === 0}
        >
          <Plus className="w-5 h-5" />
          Add Room
        </button>
      </div>

      {hostels.length === 0 && !loading && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl mb-4 text-sm font-semibold">
          You need to add a hostel first before adding rooms.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading rooms...</p>
      ) : rooms.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Bed className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No rooms added yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {rooms.map(r => (
            <div key={r.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 relative overflow-hidden">
              <div className="absolute top-2 right-2 flex gap-1">
                <button onClick={() => openEditModal(r)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => setRoomToDelete(r.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Bed className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{r.roomNumber}</h3>
                  <p className="text-xs text-gray-500">{getHostelName(r.hostelId)}</p>
                </div>
              </div>
              
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Type:</span>
                  <span className="font-medium text-gray-900">{r.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Capacity:</span>
                  <span className="font-medium text-gray-900">{r.capacity} Beds</span>
                </div>
                {r.costPerTerm !== undefined && (
                  <div className="flex justify-between pt-1 border-t border-gray-50 mt-1">
                    <span className="text-gray-500">Cost/Term:</span>
                    <span className="font-medium text-gray-900">KES {r.costPerTerm.toLocaleString()}</span>
                  </div>
                )}
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
                {editingRoom ? 'Edit Room' : 'Add Room'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Hostel</label>
                <select required value={formData.hostelId} onChange={e => setFormData({...formData, hostelId: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary">
                  <option value="">Select Hostel</option>
                  {hostels.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Room Number / Name</label>
                <input required value={formData.roomNumber} onChange={e => setFormData({...formData, roomNumber: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" placeholder="e.g. 101, Ground-A" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Room Type</label>
                  <input required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" placeholder="e.g. 2-Seater" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Bed Capacity</label>
                  <input type="number" min="1" required value={formData.capacity || ''} onChange={e => setFormData({...formData, capacity: parseInt(e.target.value) || 1})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Cost Per Term (Optional)</label>
                <input type="number" min="0" value={formData.costPerTerm || ''} onChange={e => setFormData({...formData, costPerTerm: parseInt(e.target.value) || 0})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" placeholder="e.g. 15000" />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-600 font-semibold hover:bg-gray-50 rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90">
                  {editingRoom ? 'Save Changes' : 'Add Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {roomToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-[calc(100%-2rem)] md:w-full max-w-md overflow-hidden p-4 md:p-6 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Room</h3>
            <p className="text-gray-500 mb-6">Are you sure you want to permanently delete this room? This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setRoomToDelete(null)}
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
