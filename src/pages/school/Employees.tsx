import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, where, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { School } from '../../types';
import { Loader2, Plus, Shield, Trash2, UserCog, AlertTriangle, X, RefreshCw, Edit2, IdCard } from 'lucide-react';
import EmployeeRegistrationForm from '../../components/EmployeeRegistrationForm';
import EmployeeAccessModal from '../../components/EmployeeAccessModal';
import IDCardModal from '../../components/IDCardModal';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrorHandler';
import { useBranch } from '../../context/BranchContext';

export default function Employees({ school }: { school: School | null }) {
  const { currentBranch } = useBranch();
  const [employees, setEmployees] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<any | null>(null);
  const [employeeToEdit, setEmployeeToEdit] = useState<any | null>(null);
  const [viewingIdEmployee, setViewingIdEmployee] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);

  const handleBackfillStaffIds = async () => {
    if (!school || employees.length === 0) return;
    
    const missingIds = employees.filter(emp => !emp.staffNumber);
    if (missingIds.length === 0) {
      toast.info('All employees already have Staff IDs.');
      return;
    }

    setIsBackfilling(true);
    try {
      const batch = writeBatch(db);
      
      const generateStaffNumber = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      missingIds.forEach(emp => {
        const ref = doc(db, 'employees', emp.id);
        batch.update(ref, { staffNumber: generateStaffNumber() });
      });

      await batch.commit();
      toast.success(`Successfully generated Staff IDs for ${missingIds.length} employees.`);
    } catch (error) {
      console.error('Error backfilling staff IDs:', error);
      toast.error('Failed to generate staff IDs.');
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    setIsDeleting(employeeToDelete.id);
    try {
      // 1. Delete all attendance records for this employee
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('employeeId', '==', employeeToDelete.id)
      );
      const attendanceSnap = await getDocs(attendanceQuery);
      
      const batch = writeBatch(db);
      attendanceSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      // 2. Delete the employee document
      batch.delete(doc(db, 'employees', employeeToDelete.id));
      
      await batch.commit();
      toast.success('Employee and all related data deleted successfully');
      setEmployeeToDelete(null);
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Failed to delete employee');
    } finally {
      setIsDeleting(null);
    }
  };

  useEffect(() => {
    if (!school) return;
    
    // Fetch Employees
    let q = query(collection(db, 'employees'), where('schoolId', '==', school.id));
    if (currentBranch) {
      q = query(q, where('branchId', '==', currentBranch.id));
    }
    const unsubEmployees = onSnapshot(
      q, 
      (snapshot) => {
        setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'employees')
    );

    // Fetch Classes for mapping
    let classesQ = query(collection(db, 'schools', school.id, 'classes'));
    if (currentBranch) {
      classesQ = query(classesQ, where('branchId', '==', currentBranch.id));
    }
    const unsubClasses = onSnapshot(
      classesQ,
      (snapshot) => {
        setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    return () => {
      unsubEmployees();
      unsubClasses();
    };
  }, [school, currentBranch]);

  const getClassName = (classId: string) => {
    return classes.find(c => c.id === classId)?.name || 'Unknown Class';
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-xl lg:text-xl md:text-2xl font-bold text-gray-900">Employees</h1>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button 
            onClick={handleBackfillStaffIds}
            disabled={isBackfilling}
            className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-bold shadow-sm disabled:opacity-50"
          >
            {isBackfilling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Generate Missing IDs
          </button>
          <button 
            onClick={() => {
              setEmployeeToEdit(null);
              setShowForm(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-bold"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Employee
          </button>
        </div>
      </div>
      
      {(showForm || employeeToEdit) && school && (
        <EmployeeRegistrationForm 
          school={school} 
          employee={employeeToEdit}
          onClose={() => {
            setShowForm(false);
            setEmployeeToEdit(null);
          }} 
          onAdded={() => {
            setShowForm(false);
            setEmployeeToEdit(null);
          }} 
        />
      )}

      {selectedEmployee && (
        <EmployeeAccessModal 
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          onUpdated={() => setSelectedEmployee(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {employeeToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-[calc(100%-2rem)] md:w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 md:p-6 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Delete Employee?</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to permanently delete <span className="font-bold text-gray-900">{employeeToDelete.fullName}</span>? 
                This action will also remove all their attendance history and <span className="font-bold text-red-600 underline">cannot be undone</span>.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setEmployeeToDelete(null)}
                  disabled={!!isDeleting}
                  className="flex-1 py-3 border border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteEmployee}
                  disabled={!!isDeleting}
                  className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center p-4 md:p-8"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="text-gray-400 text-[10px] lg:text-xs uppercase">
                  <th className="p-3 lg:p-4">Name</th>
                  <th className="p-3 lg:p-4">Staff Number</th>
                  <th className="p-3 lg:p-4">Role</th>
                  <th className="p-3 lg:p-4">Class Teacher</th>
                  <th className="p-3 lg:p-4">Status</th>
                  <th className="p-3 lg:p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="p-3 lg:p-4 text-sm font-medium text-gray-900">{emp.fullName}</td>
                    <td className="p-3 lg:p-4 text-sm text-gray-600 font-mono">{emp.staffNumber}</td>
                    <td className="p-3 lg:p-4 text-sm text-gray-600">{emp.jobTitle}</td>
                    <td className="p-3 lg:p-4 text-sm text-gray-600">
                      {emp.isClassTeacher ? (
                        <div className="flex flex-col">
                          <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold border border-blue-100 w-fit">
                            Yes
                          </span>
                          {emp.classTeacherAssignment && (
                            <span className="text-[10px] text-gray-500 font-medium mt-1">
                              {getClassName(emp.classTeacherAssignment)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">No</span>
                      )}
                    </td>
                    <td className="p-3 lg:p-4">
                      <span className={`px-2 py-1 rounded-full text-[9px] lg:text-[10px] font-bold uppercase ${
                        emp.status === 'active' ? 'bg-green-100 text-green-600' : 
                        emp.status === 'suspended' ? 'bg-orange-100 text-orange-600' : 
                        'bg-red-100 text-red-600'
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="p-3 lg:p-4 text-right space-x-2">
                      <button 
                        onClick={() => setViewingIdEmployee(emp)}
                        className="inline-flex items-center gap-1 px-2 lg:px-3 py-1 lg:py-1.5 text-[10px] lg:text-xs font-bold text-purple-600 hover:bg-purple-50 rounded-lg transition-colors border border-purple-200"
                        title="View ID Card"
                      >
                        <IdCard className="w-3 h-3" /> ID
                      </button>
                      <button 
                        onClick={() => setEmployeeToEdit(emp)}
                        className="inline-flex items-center gap-1 px-2 lg:px-3 py-1 lg:py-1.5 text-[10px] lg:text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      <button 
                        onClick={() => setSelectedEmployee(emp)}
                        className="inline-flex items-center gap-1 px-2 lg:px-3 py-1 lg:py-1.5 text-[10px] lg:text-xs font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors border border-primary/20"
                      >
                        <Shield className="w-3 h-3" /> Access
                      </button>
                      <button 
                        onClick={() => setEmployeeToDelete(emp)}
                        disabled={isDeleting === emp.id}
                        className="inline-flex items-center gap-1 px-2 lg:px-3 py-1 lg:py-1.5 text-[10px] lg:text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200 disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewingIdEmployee && school && (
        <IDCardModal
          school={school}
          type="employee"
          person={viewingIdEmployee}
          onClose={() => setViewingIdEmployee(null)}
        />
      )}
    </div>
  );
}
