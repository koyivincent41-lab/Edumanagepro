import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Route, Vehicle, School } from '../../../types';
import { Map, Plus, Edit2, Trash2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '../../../context/BranchContext';

export default function RoutesPage({ schoolId, school }: { schoolId: string; school: School | null }) {
  const { currentBranch } = useBranch();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    vehicleId: '',
    termlyFee: 0,
    status: 'active' as 'active' | 'inactive',
    stops: [] as { name: string; time: string; fee: number }[]
  });

  useEffect(() => {
    let routesQ = query(collection(db, 'schools', schoolId, 'routes'));
    let vehiclesQ = query(collection(db, 'schools', schoolId, 'vehicles'));
    
    if (currentBranch) {
      routesQ = query(routesQ, where('branchId', '==', currentBranch.id));
      vehiclesQ = query(vehiclesQ, where('branchId', '==', currentBranch.id));
    }

    const unsubRoutes = onSnapshot(routesQ, (snap) => {
      setRoutes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Route)));
      setLoading(false);
    });

    const unsubVehicles = onSnapshot(vehiclesQ, (snap) => {
      setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
    });

    return () => {
      unsubRoutes();
      unsubVehicles();
    };
  }, [schoolId, currentBranch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRoute) {
        await updateDoc(doc(db, 'schools', schoolId, 'routes', editingRoute.id), {
          ...formData,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          updatedAt: new Date().toISOString()
        });
        toast.success("Route updated successfully");
      } else {
        await addDoc(collection(db, 'schools', schoolId, 'routes'), {
          ...formData,
          schoolId,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        toast.success("Route added successfully");
      }
      setIsModalOpen(false);
      setEditingRoute(null);
      setFormData({ name: '', description: '', vehicleId: '', termlyFee: 0, status: 'active', stops: [] });
    } catch (err) {
      toast.error("Failed to save route");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schools', schoolId, 'routes', id));
      toast.success('Route deleted successfully');
    } catch (err) {
      toast.error('Failed to delete route');
    }
  };

  const openEditModal = (r: Route) => {
    setEditingRoute(r);
    setFormData({
      name: r.name,
      description: r.description || '',
      vehicleId: r.vehicleId || '',
      termlyFee: r.termlyFee,
      status: r.status,
      stops: r.stops || []
    });
    setIsModalOpen(true);
  };

  const addStop = () => {
    setFormData({ ...formData, stops: [...formData.stops, { name: '', time: '', fee: 0 }] });
  };

  const updateStop = (index: number, field: string, value: string | number) => {
    const newStops = [...formData.stops];
    newStops[index] = { ...newStops[index], [field]: value };
    setFormData({ ...formData, stops: newStops });
  };

  const removeStop = (index: number) => {
    const newStops = [...formData.stops];
    newStops.splice(index, 1);
    setFormData({ ...formData, stops: newStops });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">Transport Routes</h2>
        <button
          onClick={() => {
            setEditingRoute(null);
            setFormData({ name: '', description: '', vehicleId: '', termlyFee: 0, status: 'active', stops: [] });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-bold text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Route
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading routes...</p>
      ) : routes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Map className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No routes added yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {routes.map(r => (
            <div key={r.id} className="bg-white border text-left border-gray-100 rounded-xl shadow-sm overflow-hidden group">
              <div className="p-4 border-b border-gray-50 flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-50 rounded-lg">
                    <Map className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{r.name}</h3>
                    <p className="text-xs text-gray-500">{r.description || 'No description'}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(r)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(r.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 space-y-3 bg-gray-50">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Assigned Vehicle:</span>
                  <span className="font-semibold text-gray-900">
                    {vehicles.find(v => v.id === r.vehicleId)?.registrationNumber || 'Unassigned'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-gray-200 pt-2">
                  <span className="text-gray-500">Standard Termly Fee:</span>
                  <span className="font-bold text-gray-900 text-lg">{school?.currency} {r.termlyFee.toLocaleString()}</span>
                </div>
              </div>

              {r.stops && r.stops.length > 0 && (
                <div className="p-4 bg-white space-y-2">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Stops</h4>
                  {r.stops.map((stop, i) => (
                    <div key={i} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-700">{stop.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold font-mono text-gray-900">{stop.time}</div>
                        {stop.fee > 0 && <div className="text-[10px] text-gray-500">{school?.currency} {stop.fee.toLocaleString()}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h2 className="text-lg font-black text-gray-900">{editingRoute ? 'Edit Route' : 'Add Route'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <span>✕</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Route Name</label>
                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" placeholder="e.g. Route A - North" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description (Optional)</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Assign Vehicle</label>
                  <select value={formData.vehicleId} onChange={e => setFormData({...formData, vehicleId: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary">
                    <option value="">No Vehicle</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.registrationNumber} ({v.capacity} Seats)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Standard Termly Fee</label>
                  <input required type="number" min="0" value={formData.termlyFee || ''} onChange={e => setFormData({...formData, termlyFee: parseInt(e.target.value) || 0})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" />
                </div>
              </div>
              
              <div className="border-t border-gray-100 pt-4 mt-2">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900">Route Stops</h3>
                  <button type="button" onClick={addStop} className="text-xs font-bold text-primary hover:text-primary/80">+ Add Stop</button>
                </div>
                
                <div className="space-y-3">
                  {formData.stops.map((stop, index) => (
                    <div key={index} className="flex gap-2 items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="flex-1 space-y-2">
                        <input required placeholder="Stop Name" value={stop.name} onChange={e => updateStop(index, 'name', e.target.value)} className="w-full p-2 text-sm border border-gray-200 rounded-lg outline-none" />
                        <div className="flex gap-2">
                          <input type="time" required value={stop.time} onChange={e => updateStop(index, 'time', e.target.value)} className="flex-1 p-2 text-sm border border-gray-200 rounded-lg outline-none" />
                          <input type="number" placeholder="Fee (Opt)" value={stop.fee || ''} onChange={e => updateStop(index, 'fee', parseInt(e.target.value) || 0)} className="flex-1 p-2 text-sm border border-gray-200 rounded-lg outline-none" />
                        </div>
                      </div>
                      <button type="button" onClick={() => removeStop(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {formData.stops.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-2">No stops added. Add stops to create a schedule.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              
              <div className="pt-4 flex gap-4 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 p-3 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 p-3 bg-primary text-white rounded-xl font-bold">Save Route</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
