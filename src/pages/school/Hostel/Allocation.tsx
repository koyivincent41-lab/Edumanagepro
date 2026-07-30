import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Hostel, HostelRoom, HostelAllocation, Student } from '../../../types';
import { Users, UserPlus, Trash2, Search, X } from 'lucide-react';
import { toast } from 'sonner';

export default function Allocation({ schoolId }: { schoolId: string }) {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [allocations, setAllocations] = useState<HostelAllocation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    studentId: '',
    hostelId: '',
    roomId: ''
  });

  const [allocationToDelete, setAllocationToDelete] = useState<string | null>(null);
  const [allocationToVacate, setAllocationToVacate] = useState<string | null>(null);

  useEffect(() => {
    const unsubHostels = onSnapshot(query(collection(db, 'schools', schoolId, 'hostels')), snap => {
      setHostels(snap.docs.map(d => ({ id: d.id, ...d.data() } as Hostel)));
    });

    const unsubRooms = onSnapshot(query(collection(db, 'schools', schoolId, 'hostelRooms')), snap => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as HostelRoom)));
    });

    const unsubAllocations = onSnapshot(query(collection(db, 'schools', schoolId, 'hostelAllocations')), snap => {
      setAllocations(snap.docs.map(d => ({ id: d.id, ...d.data() } as HostelAllocation)));
    });

    const unsubStudents = onSnapshot(query(collection(db, 'schools', schoolId, 'students')), snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
      setLoading(false);
    });

    return () => {
      unsubHostels();
      unsubRooms();
      unsubAllocations();
      unsubStudents();
    };
  }, [schoolId]);

  const activeAllocations = useMemo(() => allocations.filter(a => a.status === 'allocated'), [allocations]);

  const filteredAllocations = useMemo(() => {
    return activeAllocations.filter(alloc => {
      const student = students.find(s => s.id === alloc.studentId);
      const searchLower = searchQuery.toLowerCase();
      if (!student) return false;
      return student.fullName.toLowerCase().includes(searchLower) || 
             student.admissionNumber.toLowerCase().includes(searchLower);
    });
  }, [activeAllocations, students, searchQuery]);

  const getHostel = (id: string) => hostels.find(h => h.id === id);
  const getRoom = (id: string) => rooms.find(r => r.id === id);
  const getStudent = (id: string) => students.find(s => s.id === id);

  const availableRooms = useMemo(() => {
    if (!formData.hostelId) return [];
    const hostelRooms = rooms.filter(r => r.hostelId === formData.hostelId);
    return hostelRooms.map(room => {
      const occupants = activeAllocations.filter(a => a.roomId === room.id).length;
      return { ...room, occupants, available: room.capacity - occupants };
    }).filter(r => r.available > 0);
  }, [formData.hostelId, rooms, activeAllocations]);

  const availableStudents = useMemo(() => {
    const allocatedStudentIds = new Set(activeAllocations.map(a => a.studentId));
    return students.filter(s => !allocatedStudentIds.has(s.id));
  }, [students, activeAllocations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.hostelId || !formData.roomId) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      await addDoc(collection(db, 'schools', schoolId, 'hostelAllocations'), {
        schoolId,
        studentId: formData.studentId,
        hostelId: formData.hostelId,
        roomId: formData.roomId,
        status: 'allocated',
        allocatedDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success("Student allocated successfully");
      setIsModalOpen(false);
      setFormData({ studentId: '', hostelId: '', roomId: '' });
    } catch (err) {
      toast.error('Failed to allocate student');
    }
  };

  const handleVacate = async () => {
    if (allocationToVacate) {
      try {
        await updateDoc(doc(db, 'schools', schoolId, 'hostelAllocations', allocationToVacate), {
          status: 'vacated',
          vacatedDate: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        toast.success('Student vacated successfully');
        setAllocationToVacate(null);
      } catch (err) {
        toast.error('Failed to vacate student');
      }
    }
  };

  const handleDelete = async () => {
    if (allocationToDelete) {
      try {
        await deleteDoc(doc(db, 'schools', schoolId, 'hostelAllocations', allocationToDelete));
        toast.success('Allocation deleted successfully');
        setAllocationToDelete(null);
      } catch (err) {
        toast.error('Failed to delete allocation');
      }
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-lg font-bold text-gray-900">Bed Allocation</h2>
        
        <div className="flex w-full sm:w-auto items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search student..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <button
            onClick={() => {
              setFormData({ studentId: '', hostelId: '', roomId: '' });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-semibold shrink-0"
          >
            <UserPlus className="w-5 h-5" />
            Allocate
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[700px] w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 md:px-6 py-4 font-semibold text-gray-900">Student Name</th>
                <th className="px-4 md:px-6 py-4 font-semibold text-gray-900">Admission No.</th>
                <th className="px-4 md:px-6 py-4 font-semibold text-gray-900">Hostel</th>
                <th className="px-4 md:px-6 py-4 font-semibold text-gray-900">Room No.</th>
                <th className="px-4 md:px-6 py-4 font-semibold text-gray-900 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAllocations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 md:px-6 py-4 md:py-8 text-center text-gray-500">
                    No active allocations found.
                  </td>
                </tr>
              ) : (
                filteredAllocations.map(alloc => {
                  const student = getStudent(alloc.studentId);
                  const hostel = getHostel(alloc.hostelId);
                  const room = getRoom(alloc.roomId);
                  
                  if (!student) return null;

                  return (
                    <tr key={alloc.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 md:px-6 py-4 font-medium text-gray-900">
                        {student.fullName}
                      </td>
                      <td className="px-4 md:px-6 py-4 text-gray-500">
                        {student.admissionNumber}
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-medium text-xs">
                          {hostel?.name || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 font-medium text-xs">
                          {room?.roomNumber || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right flex justify-end gap-2">
                        <button
                          onClick={() => setAllocationToVacate(alloc.id)}
                          className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold hover:bg-orange-100 transition-colors"
                        >
                          Vacate
                        </button>
                        <button
                          onClick={() => setAllocationToDelete(alloc.id)}
                          className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-[calc(100%-2rem)] md:w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">Allocate Bed</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Select Student</label>
                <select 
                  required 
                  value={formData.studentId} 
                  onChange={e => setFormData({...formData, studentId: e.target.value})} 
                  className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary"
                >
                  <option value="">Choose a student...</option>
                  {availableStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.fullName} ({s.admissionNumber})</option>
                  ))}
                </select>
                {availableStudents.length === 0 && <p className="text-xs text-orange-500 mt-1">All registered students are allocated.</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Select Hostel</label>
                <select 
                  required 
                  value={formData.hostelId} 
                  onChange={e => setFormData({...formData, hostelId: e.target.value, roomId: ''})} 
                  className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary"
                >
                  <option value="">Choose a hostel...</option>
                  {hostels.map(h => (
                    <option key={h.id} value={h.id}>{h.name} ({h.type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Select Room</label>
                <select 
                  required 
                  value={formData.roomId} 
                  onChange={e => setFormData({...formData, roomId: e.target.value})} 
                  className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary disabled:opacity-50"
                  disabled={!formData.hostelId}
                >
                  <option value="">Choose a room...</option>
                  {availableRooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.roomNumber} - {r.available} bed(s) available
                    </option>
                  ))}
                </select>
                {formData.hostelId && availableRooms.length === 0 && (
                  <p className="text-xs text-orange-500 mt-1">No rooms available in this hostel.</p>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-600 font-semibold hover:bg-gray-50 rounded-xl">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!formData.studentId || !formData.hostelId || !formData.roomId}
                  className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50"
                >
                  Allocate Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {allocationToVacate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-[calc(100%-2rem)] md:w-full max-w-md overflow-hidden p-4 md:p-6 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Vacate Student</h3>
            <p className="text-gray-500 mb-6">Are you sure you want to vacate this student from the room? Their history will be preserved.</p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setAllocationToVacate(null)}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200"
              >
                Cancel
              </button>
              <button 
                onClick={handleVacate}
                className="px-5 py-2.5 bg-orange-600 text-white font-semibold rounded-xl hover:bg-orange-700"
              >
                Yes, Vacate
              </button>
            </div>
          </div>
        </div>
      )}

      {allocationToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-[calc(100%-2rem)] md:w-full max-w-md overflow-hidden p-4 md:p-6 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Allocation</h3>
            <p className="text-gray-500 mb-6">Are you sure you want to permanently delete this allocation? This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setAllocationToDelete(null)}
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
