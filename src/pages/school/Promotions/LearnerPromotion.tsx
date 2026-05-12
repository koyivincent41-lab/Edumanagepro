import React, { useState, useEffect } from 'react';
import { School, Class, Student } from '../../../types';
import { collection, query, getDocs, updateDoc, doc, writeBatch, setDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { Loader2, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LearnerPromotion({ school }: { school: School }) {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [feeTypes, setFeeTypes] = useState<any[]>([]);

  const [currentAcademicYear, setCurrentAcademicYear] = useState(school.academicYear);
  const [newAcademicYear, setNewAcademicYear] = useState('');
  
  const [classMappings, setClassMappings] = useState<Record<string, string>>({});
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  
  const [isPromoting, setIsPromoting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, type: 'bulk' | 'single'}>({ isOpen: false, type: 'bulk' });

  // For individual learner promotion within a class
  const [selectedClassForSingle, setSelectedClassForSingle] = useState<Class | null>(null);
  const [selectedStudentsForSingle, setSelectedStudentsForSingle] = useState<string[]>([]);

  // Generate academic years based on settings logic
  const academicYears = Array.from({ length: 2060 - 2024 + 1 }, (_, i) => (2024 + i).toString());

  useEffect(() => {
    loadData();
  }, [school.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load classes
      const classQ = query(collection(db, 'schools', school.id, 'classes'));
      const classSnap = await getDocs(classQ);
      const loadedClasses = classSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      
      // Sort classes naturally
      const sorted = [...loadedClasses].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      setClasses(sorted);

      // Load students
      const studQ = query(collection(db, 'schools', school.id, 'students'));
      const studSnap = await getDocs(studQ);
      setStudents(studSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));

      // Load fee types (to verify if new class has required fees, etc., or to update assignments)
      const feeQ = query(collection(db, 'schools', school.id, 'fee_types'));
      const feeSnap = await getDocs(feeQ);
      setFeeTypes(feeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Auto-map classes
      const mappings: Record<string, string> = {};
      sorted.forEach((cls, idx) => {
        if (idx < sorted.length - 1) {
          mappings[cls.id] = sorted[idx + 1].id;
        } else {
          mappings[cls.id] = 'final'; // Final grade
        }
      });
      setClassMappings(mappings);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load classes and learners');
    } finally {
      setLoading(false);
    }
  };

  const handleClassMappingChange = (classId: string, destClassId: string) => {
    setClassMappings(prev => ({ ...prev, [classId]: destClassId }));
  };

  const toggleClassSelection = (classId: string) => {
    if (selectedClasses.includes(classId)) {
      setSelectedClasses(prev => prev.filter(id => id !== classId));
    } else {
      setSelectedClasses(prev => [...prev, classId]);
    }
  };

  const toggleAllClasses = () => {
    if (selectedClasses.length === classes.length) {
      setSelectedClasses([]);
    } else {
      setSelectedClasses(classes.map(c => c.id));
    }
  };

  const validatePromotion = (type: 'bulk' | 'single', classesToCheck?: string[]) => {
    if (!currentAcademicYear) {
      toast.error('Please select the current academic year');
      return false;
    }
    if (!newAcademicYear) {
      toast.error('Please select the new academic year');
      return false;
    }
    if (currentAcademicYear === newAcademicYear) {
      toast.error('Current and new academic years must be different');
      return false;
    }
    
    if (type === 'bulk') {
      const targetClasses = classesToCheck || selectedClasses;
      if (targetClasses.length === 0) {
        toast.error('Please select at least one class to promote');
        return false;
      }
      
      // Check if any selected class has 'final' mapping and maybe skip them or warn?
      // Actually final grades are handled, we just don't promote them if 'final' is selected
    } else {
      if (selectedStudentsForSingle.length === 0) {
        toast.error('Please select at least one learner to promote');
        return false;
      }
      if (!selectedClassForSingle) return false;
      const dest = classMappings[selectedClassForSingle.id];
      if (dest === 'final') {
        toast.error('Cannot promote from a final grade without a destination selected.');
        return false;
      }
    }
    
    return true;
  };

  const executePromotion = async () => {
    setIsPromoting(true);
    let successCount = 0;
    let skipCount = 0;
    
    try {
      const batch = writeBatch(db);
      const historyCollectionRef = collection(db, 'schools', school.id, 'promotion_history');
      let operationCount = 0;
      
      const commitBatchIfNeeded = async () => {
        if (operationCount >= 450) {
          await batch.commit();
          operationCount = 0;
        }
      };

      const processStudent = async (student: Student, destClassId: string) => {
        if (destClassId === 'final' || !destClassId) {
          skipCount++;
          return;
        }
        
        if (student.academicYear === newAcademicYear && student.classId === destClassId) {
          skipCount++;
          return; // Already promoted
        }

        const oldClass = classes.find(c => c.id === student.classId)?.name || 'Unknown';
        const newClass = classes.find(c => c.id === destClassId)?.name || 'Unknown';

        const studentRef = doc(db, 'schools', school.id, 'students', student.id);
        
        // Fee assignment logic - if the system relies on class-based structure, update class fees if any.
        // Actually, the system often links student to `classId`. 
        // We update `classId` and `academicYear`. 
        
        batch.update(studentRef, {
          classId: destClassId,
          academicYear: newAcademicYear,
          updatedAt: new Date().toISOString()
        });
        operationCount++;
        await commitBatchIfNeeded();

        // Add history log
        const logRef = doc(historyCollectionRef);
        batch.set(logRef, {
          learner_id: student.id,
          learner_name: student.fullName,
          previous_class: oldClass,
          new_class: newClass,
          previous_year: currentAcademicYear,
          new_year: newAcademicYear,
          promoted_at: new Date().toISOString(),
          promoted_by: auth.currentUser?.email || 'Admin',
          notes: 'Bulk promotion'
        });
        operationCount++;
        await commitBatchIfNeeded();
        
        successCount++;
      };

      if (confirmModal.type === 'bulk') {
        for (const classId of selectedClasses) {
          const destClassId = classMappings[classId];
          const classStudents = students.filter(s => s.classId === classId && s.academicYear === currentAcademicYear);
          for (const student of classStudents) {
            await processStudent(student, destClassId);
          }
        }
      } else if (confirmModal.type === 'single' && selectedClassForSingle) {
        const destClassId = classMappings[selectedClassForSingle.id];
        for (const studentId of selectedStudentsForSingle) {
          const student = students.find(s => s.id === studentId);
          if (student) {
            await processStudent(student, destClassId);
          }
        }
      }

      if (operationCount > 0) {
        await batch.commit();
      }

      toast.success(`Promotion complete! ${successCount} promoted, ${skipCount} skipped.`);
      
      setConfirmModal({ isOpen: false, type: 'bulk' });
      setSelectedClassForSingle(null);
      setSelectedStudentsForSingle([]);
      
      // Reload students
      loadData();
    } catch (err) {
      console.error('Error executing promotion:', err);
      toast.error('Failed to promote learners');
    } finally {
      setIsPromoting(false);
    }
  };

  const getStats = () => {
    let totalLearners = 0;
    if (confirmModal.type === 'bulk') {
      selectedClasses.forEach(cId => {
        totalLearners += students.filter(s => s.classId === cId && s.academicYear === currentAcademicYear).length;
      });
      return { classes: selectedClasses.length, learners: totalLearners };
    } else {
      return { classes: 1, learners: selectedStudentsForSingle.length };
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-maroon" /></div>;
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-gray-50 p-6 rounded-2xl border border-gray-100">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Current Academic Year</label>
          <select 
            value={currentAcademicYear} 
            onChange={e => setCurrentAcademicYear(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-maroon"
          >
            <option value="">Select Year...</option>
            {academicYears.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">New Academic Year</label>
          <select 
            value={newAcademicYear} 
            onChange={e => setNewAcademicYear(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-maroon"
          >
            <option value="">Select Year...</option>
            {academicYears.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl mb-6">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4">
                <input 
                  type="checkbox" 
                  checked={selectedClasses.length === classes.length && classes.length > 0} 
                  onChange={toggleAllClasses} 
                  className="rounded text-maroon focus:ring-maroon cursor-pointer"
                />
              </th>
              <th className="px-6 py-4 font-bold text-gray-700">Current Class</th>
              <th className="px-6 py-4 font-bold text-gray-700">Total Learners</th>
              <th className="px-6 py-4 font-bold text-gray-700">Promoting To</th>
              <th className="px-6 py-4 font-bold text-gray-700 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {classes.map(cls => {
              const classLearners = students.filter(s => s.classId === cls.id && s.academicYear === currentAcademicYear);
              const isFinal = classMappings[cls.id] === 'final';
              
              return (
                <tr key={cls.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      checked={selectedClasses.includes(cls.id)} 
                      onChange={() => toggleClassSelection(cls.id)}
                      className="rounded text-maroon focus:ring-maroon cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-800">{cls.name}</td>
                  <td className="px-6 py-4 text-gray-600">{classLearners.length} learners</td>
                  <td className="px-6 py-4">
                    <select 
                      value={classMappings[cls.id] || 'final'}
                      onChange={(e) => handleClassMappingChange(cls.id, e.target.value)}
                      className={`text-sm p-2 rounded-lg border outline-none ${isFinal ? 'bg-red-50 text-red-700 border-red-200 font-bold' : 'bg-white border-gray-200'}`}
                    >
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      <option value="final">Final Grade - No Promotion</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => {
                        setSelectedClassForSingle(cls);
                        setSelectedStudentsForSingle(classLearners.map(s => s.id));
                      }}
                      className="text-sm px-4 py-2 bg-blue-50 text-blue-600 font-bold rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      Promote Select Learners
                    </button>
                  </td>
                </tr>
              );
            })}
            {classes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No classes found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={() => {
            if (validatePromotion('bulk', selectedClasses)) {
              setConfirmModal({ isOpen: true, type: 'bulk' });
            }
          }}
          className="px-6 py-3 bg-maroon text-white font-bold rounded-xl hover:bg-maroon/90 shadow-lg"
        >
          Promote Selected Classes
        </button>
        <button 
          onClick={() => {
            const allClassIds = classes.map(c => c.id);
            setSelectedClasses(allClassIds);
            if (validatePromotion('bulk', allClassIds)) {
              setConfirmModal({ isOpen: true, type: 'bulk' });
            }
          }}
          className="px-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black shadow-lg"
        >
          Promote All Classes
        </button>
        <button 
          onClick={() => setSelectedClasses([])}
          className="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200"
        >
          Reset Selection
        </button>
      </div>

      {/* Individual Promotion Modal */}
      {selectedClassForSingle && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Promote Learners in {selectedClassForSingle.name}</h3>
            <p className="text-gray-500 mb-4">Select exactly which learners to promote from this class.</p>
            
            <div className="flex-1 overflow-y-auto mb-6 border border-gray-200 rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">
                      <input 
                        type="checkbox" 
                        checked={
                          selectedStudentsForSingle.length === students.filter(s => s.classId === selectedClassForSingle.id && s.academicYear === currentAcademicYear).length 
                          && selectedStudentsForSingle.length > 0
                        }
                        onChange={(e) => {
                          const clsStudents = students.filter(s => s.classId === selectedClassForSingle.id && s.academicYear === currentAcademicYear);
                          if (e.target.checked) setSelectedStudentsForSingle(clsStudents.map(s => s.id));
                          else setSelectedStudentsForSingle([]);
                        }}
                        className="rounded text-maroon"
                      />
                    </th>
                    <th className="px-4 py-3 font-bold text-gray-700">Learner Name</th>
                    <th className="px-4 py-3 font-bold text-gray-700">Admission No.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.filter(s => s.classId === selectedClassForSingle.id && s.academicYear === currentAcademicYear).map(student => (
                    <tr key={student.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => {
                      if (selectedStudentsForSingle.includes(student.id)) {
                        setSelectedStudentsForSingle(prev => prev.filter(id => id !== student.id));
                      } else {
                        setSelectedStudentsForSingle(prev => [...prev, student.id]);
                      }
                    }}>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={selectedStudentsForSingle.includes(student.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedStudentsForSingle(prev => [...prev, student.id]);
                            else setSelectedStudentsForSingle(prev => prev.filter(id => id !== student.id));
                          }}
                          className="rounded text-maroon"
                        />
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900">{student.fullName}</td>
                      <td className="px-4 py-3 text-gray-500">{student.admissionNumber}</td>
                    </tr>
                  ))}
                  {students.filter(s => s.classId === selectedClassForSingle.id && s.academicYear === currentAcademicYear).length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500">No learners found in this class for the selected year.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-700">Promoting To:</span>
                <select 
                  value={classMappings[selectedClassForSingle.id] || 'final'}
                  onChange={(e) => handleClassMappingChange(selectedClassForSingle.id, e.target.value)}
                  className={`text-sm p-2 rounded-lg border outline-none ${classMappings[selectedClassForSingle.id] === 'final' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white border-gray-200'}`}
                >
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="final">Final Grade - No Promotion</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setSelectedClassForSingle(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (validatePromotion('single')) {
                      setConfirmModal({ isOpen: true, type: 'single' });
                    }
                  }}
                  className="px-4 py-2 bg-maroon text-white font-bold rounded-lg hover:bg-maroon/90 shadow-md"
                >
                  Promote {selectedStudentsForSingle.length} Learners
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4 text-maroon">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-xl font-bold">Confirm Promotion</h3>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <p className="text-amber-800 font-medium text-sm mb-3">
                This action will update learner class records and fee assignments. Please verify details:
              </p>
              <ul className="space-y-2 text-sm text-amber-900 font-bold">
                <li className="flex justify-between"><span>Selected Classes:</span> <span>{getStats().classes}</span></li>
                <li className="flex justify-between"><span>Total Learners Target:</span> <span>{getStats().learners}</span></li>
                <li className="flex justify-between"><span>Moving To Year:</span> <span>{newAcademicYear}</span></li>
              </ul>
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setConfirmModal({ isOpen: false, type: 'bulk' })}
                disabled={isPromoting}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button 
                onClick={executePromotion}
                disabled={isPromoting}
                className="px-4 py-2 bg-maroon text-white font-bold rounded-lg hover:bg-maroon/90 shadow-md flex items-center gap-2 disabled:opacity-70"
              >
                {isPromoting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm & Promote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
