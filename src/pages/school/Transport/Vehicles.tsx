import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Vehicle } from '../../../types';
import { Bus, Plus, Edit2, Trash2, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '../../../context/BranchContext';
import WazeTrackerModal from '../../../components/WazeTrackerModal';

export default function Vehicles({ schoolId }: { schoolId: string }) {
  const { currentBranch } = useBranch();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [trackingVehicle, setTrackingVehicle] = useState<Vehicle | null>(null);

  const [formData, setFormData] = useState({
    registrationNumber: '',
    make: '',
    model: '',
    capacity: 0,
    driverName: '',
    driverPhone: '',
    status: 'active' as 'active' | 'maintenance' | 'inactive'
  });

  useEffect(() => {
    let q = query(collection(db, 'schools', schoolId, 'vehicles'));
    if (currentBranch) {
      q = query(q, where('branchId', '==', currentBranch.id));
    }

    const unsub = onSnapshot(q, (snap) => {
      setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
      setLoading(false);
    });

    return () => unsub();
  }, [schoolId, currentBranch]);

  useEffect(() => {
    // Automatically generate tracking ID for older vehicles that don't have one
    vehicles.forEach(async (v) => {
      if (!v.trackingId) {
        const generatedTrackingId = `TRK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        try {
          await updateDoc(doc(db, 'schools', schoolId, 'vehicles', v.id), {
            trackingId: generatedTrackingId
          });
        } catch (error) {
          console.error("Error generating tracking ID:", error);
        }
      }
    });
  }, [vehicles, schoolId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVehicle) {
        await updateDoc(doc(db, 'schools', schoolId, 'vehicles', editingVehicle.id), {
          ...formData,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          updatedAt: new Date().toISOString()
        });
        toast.success("Vehicle updated successfully");
      } else {
        const generatedTrackingId = `TRK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        await addDoc(collection(db, 'schools', schoolId, 'vehicles'), {
          ...formData,
          trackingId: generatedTrackingId,
          schoolId,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        toast.success("Vehicle added successfully");
      }
      setIsModalOpen(false);
      setEditingVehicle(null);
      setFormData({ registrationNumber: '', make: '', model: '', capacity: 0, driverName: '', driverPhone: '', status: 'active' });
    } catch (err) {
      toast.error("Failed to save vehicle");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schools', schoolId, 'vehicles', id));
      toast.success('Vehicle deleted successfully');
    } catch (err) {
      toast.error('Failed to delete vehicle');
    }
  };

  const openEditModal = (v: Vehicle) => {
    setEditingVehicle(v);
    setFormData({
      registrationNumber: v.registrationNumber,
      make: v.make,
      model: v.model,
      capacity: v.capacity,
      driverName: v.driverName,
      driverPhone: v.driverPhone,
      status: v.status
    });
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">Vehicles</h2>
        <button
          onClick={() => {
            setEditingVehicle(null);
            setFormData({ registrationNumber: '', make: '', model: '', capacity: 0, driverName: '', driverPhone: '', status: 'active' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-bold text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Vehicle
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading vehicles...</p>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Bus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No vehicles added yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map(v => (
            <div key={v.id} className="bg-white border text-left border-gray-100 rounded-xl shadow-sm p-4 relative overflow-hidden group">
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEditModal(v)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(v.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-indigo-50 rounded-lg">
                  <Bus className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{v.registrationNumber}</h3>
                  <p className="text-xs text-gray-500">{v.make} {v.model}</p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-gray-50 mb-2">
                  <span className="text-gray-500 font-medium">Tracking ID:</span>
                  <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{v.trackingId || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Capacity:</span>
                  <span className="font-semibold text-gray-900">{v.capacity} Seats</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Driver:</span>
                  <span className="font-semibold text-gray-900">{v.driverName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Phone:</span>
                  <span className="font-semibold text-gray-900">{v.driverPhone}</span>
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-50">
                  <span className="text-gray-500">Status:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    v.status === 'active' ? 'bg-green-100 text-green-700' :
                    v.status === 'maintenance' ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {v.status}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setTrackingVehicle(v)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 rounded-xl text-sm font-bold transition-colors"
                >
                  <Navigation className="w-4 h-4" />
                  Track Live Map
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <WazeTrackerModal 
        vehicle={trackingVehicle} 
        onClose={() => setTrackingVehicle(null)} 
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-black text-gray-900">{editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <Trash2 className="w-5 h-5 hidden" />
                <span>✕</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Registration Number</label>
                <input required value={formData.registrationNumber} onChange={e => setFormData({...formData, registrationNumber: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" placeholder="e.g. KAB 123C" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Make</label>
                  <input required value={formData.make} onChange={e => setFormData({...formData, make: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" placeholder="e.g. Toyota" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Model</label>
                  <input required value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" placeholder="e.g. Coaster" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Capacity (Seats)</label>
                <input required type="number" min="1" value={formData.capacity || ''} onChange={e => setFormData({...formData, capacity: parseInt(e.target.value) || 0})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Driver Name</label>
                  <input required value={formData.driverName} onChange={e => setFormData({...formData, driverName: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Driver Phone</label>
                  <input required value={formData.driverPhone} onChange={e => setFormData({...formData, driverPhone: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary">
                  <option value="active">Active</option>
                  <option value="maintenance">In Maintenance</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 p-3 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 p-3 bg-primary text-white rounded-xl font-bold">Save Vehicle</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
