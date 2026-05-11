import React, { useState, useEffect } from 'react';
import { School, Employee, SalaryStructure } from '../../../types';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, X, Download } from 'lucide-react';
import { exportToCSV } from '../../../lib/reportUtils';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreErrorHandler';

interface Props {
  schoolId: string;
  school: School | null;
}

export default function Employees({ schoolId, school }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<Employee>>({
    fullName: '',
    designation: '',
    department: '',
    employmentType: 'full_time',
    dateOfEmployment: new Date().toISOString().split('T')[0],
    payrollStatus: 'active',
    paymentMethod: 'bank',
    bankName: '',
    bankAccountNumber: '',
    taxNumber: '',
    basicSalary: 0,
    salaryStructureId: ''
  });

  useEffect(() => {
    const unsubEmployees = onSnapshot(
      query(collection(db, 'employees'), where('schoolId', '==', schoolId)), 
      (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        setEmployees(data);
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'employees')
    );

    const unsubStructures = onSnapshot(
      collection(db, 'schools', schoolId, 'salary_structures'), 
      (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalaryStructure));
        setStructures(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `schools/${schoolId}/salary_structures`)
    );

    return () => {
      unsubEmployees();
      unsubStructures();
    };
  }, [schoolId]);

  const generateUniqueId = (prefix: string, length: number) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = prefix;
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'employees', editingId), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        toast.success('Employee updated successfully');
      } else {
        const schoolPrefix = school?.name ? school.name.substring(0, 2).toUpperCase() : 'XX';
        const staffNumber = generateStaffNumber(); // Use the same 4-digit format

        await addDoc(collection(db, 'employees'), {
          ...formData,
          staffNumber,
          schoolId,
          status: 'active', // Default status for root collection
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        toast.success('Employee added successfully');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error('Failed to save employee');
    }
  };

  const generateStaffNumber = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'employees', id));
      toast.success('Employee deleted successfully');
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Failed to delete employee');
    }
  };

  const editEmployee = (emp: Employee) => {
    setFormData(emp);
    setEditingId(emp.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      designation: '',
      department: '',
      employmentType: 'full_time',
      dateOfEmployment: new Date().toISOString().split('T')[0],
      payrollStatus: 'active',
      paymentMethod: 'bank',
      bankName: '',
      bankAccountNumber: '',
      taxNumber: '',
      basicSalary: 0,
      salaryStructureId: ''
    });
    setEditingId(null);
  };

  const handleStructureChange = (structureId: string) => {
    const structure = structures.find(s => s.id === structureId);
    if (structure) {
      setFormData({
        ...formData,
        salaryStructureId: structureId,
        basicSalary: structure.baseSalary
      });
    } else {
      setFormData({
        ...formData,
        salaryStructureId: ''
      });
    }
  };

  const handleExport = () => {
    const exportData = filteredEmployees.map(emp => ({
      'Staff ID': emp.staffNumber,
      'Full Name': emp.fullName,
      'Department': emp.department,
      'Designation': emp.designation,
      'Employment Type': emp.employmentType.replace('_', ' '),
      'Date of Employment': emp.dateOfEmployment,
      'Basic Salary': emp.basicSalary,
      'Payment Method': emp.paymentMethod.replace('_', ' '),
      'Bank Name': emp.bankName || 'N/A',
      'Bank Account Number': emp.bankAccountNumber || 'N/A',
      'Tax Number': emp.taxNumber || 'N/A',
      'Status': emp.payrollStatus
    }));
    exportToCSV(exportData, 'Employees_List');
  };

  const filteredEmployees = employees.filter(emp => 
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.staffNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-bold text-sm"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[700px] w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50">
            <tr>
              <th className="px-4 md:px-6 py-3 rounded-tl-xl">Staff ID</th>
              <th className="px-4 md:px-6 py-3">Name</th>
              <th className="px-4 md:px-6 py-3">Department</th>
              <th className="px-4 md:px-6 py-3">Designation</th>
              <th className="px-4 md:px-6 py-3">Structure</th>
              <th className="px-4 md:px-6 py-3">Basic Salary</th>
              <th className="px-4 md:px-6 py-3">Status</th>
              <th className="px-4 md:px-6 py-3 rounded-tr-xl text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 md:px-6 py-4 md:py-8 text-center text-gray-500">
                  No employees found.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => (
                <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 md:px-6 py-4 font-medium text-gray-900">{emp.staffNumber}</td>
                  <td className="px-4 md:px-6 py-4 font-bold text-gray-900">{emp.fullName}</td>
                  <td className="px-4 md:px-6 py-4 text-gray-600">{emp.department}</td>
                  <td className="px-4 md:px-6 py-4 text-gray-600">{emp.designation}</td>
                  <td className="px-4 md:px-6 py-4 text-gray-600">
                    {structures.find(s => s.id === emp.salaryStructureId)?.name || 'Manual'}
                  </td>
                  <td className="px-4 md:px-6 py-4 font-medium text-gray-900">{school?.currency} {(emp.basicSalary || 0).toLocaleString()}</td>
                  <td className="px-4 md:px-6 py-4">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                      emp.payrollStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {(emp.payrollStatus || 'inactive').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => editEmployee(emp)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(emp.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-[calc(100%-2rem)] md:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 p-4 md:p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-black text-gray-900">
                Edit Payroll Details
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    readOnly
                    value={formData.fullName || ''}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Staff ID</label>
                  <input
                    type="text"
                    readOnly
                    value={formData.staffNumber || ''}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Department</label>
                  <input
                    type="text"
                    readOnly
                    value={formData.department || ''}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Designation</label>
                  <input
                    type="text"
                    readOnly
                    value={formData.designation || ''}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Employment Type</label>
                  <input
                    type="text"
                    readOnly
                    value={formData.employmentType?.replace('_', ' ')?.toUpperCase() || ''}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Date of Employment</label>
                  <input
                    type="text"
                    readOnly
                    value={formData.dateOfEmployment || ''}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Salary Structure</label>
                  <select
                    required
                    value={formData.salaryStructureId || ''}
                    onChange={(e) => handleStructureChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Select Salary Structure</option>
                    {structures.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({school?.currency} {(s.baseSalary || 0).toLocaleString()})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Payroll Status</label>
                  <select
                    value={formData.payrollStatus || 'active'}
                    onChange={(e) => setFormData({...formData, payrollStatus: e.target.value as any})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={formData.paymentMethod || 'bank'}
                    onChange={(e) => setFormData({...formData, paymentMethod: e.target.value as any})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="bank">Bank Transfer</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>

                {formData.paymentMethod === 'bank' && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Bank Name</label>
                      <select
                        value={formData.bankName || ''}
                        onChange={(e) => setFormData({...formData, bankName: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="">Select Bank</option>
                        <option value="KCB Bank Kenya Limited">KCB Bank Kenya Limited</option>
                        <option value="Equity Bank Kenya Limited">Equity Bank Kenya Limited</option>
                        <option value="Co-operative Bank of Kenya">Co-operative Bank of Kenya</option>
                        <option value="NCBA Bank Kenya PLC">NCBA Bank Kenya PLC</option>
                        <option value="Absa Bank Kenya PLC">Absa Bank Kenya PLC</option>
                        <option value="Standard Chartered Bank Kenya">Standard Chartered Bank Kenya</option>
                        <option value="Access Bank (Kenya) PLC">Access Bank (Kenya) PLC</option>
                        <option value="African Banking Corporation Ltd (ABC Bank)">African Banking Corporation Ltd (ABC Bank)</option>
                        <option value="Bank of Africa Kenya Ltd">Bank of Africa Kenya Ltd</option>
                        <option value="Bank of Baroda (Kenya) Ltd">Bank of Baroda (Kenya) Ltd</option>
                        <option value="Bank of India">Bank of India</option>
                        <option value="Citibank N.A. Kenya">Citibank N.A. Kenya</option>
                        <option value="Commercial International Bank Kenya Ltd (CIB)">Commercial International Bank Kenya Ltd (CIB)</option>
                        <option value="Consolidated Bank of Kenya Ltd">Consolidated Bank of Kenya Ltd</option>
                        <option value="Credit Bank PLC">Credit Bank PLC</option>
                        <option value="Development Bank of Kenya Ltd">Development Bank of Kenya Ltd</option>
                        <option value="Diamond Trust Bank Kenya Ltd (DTB)">Diamond Trust Bank Kenya Ltd (DTB)</option>
                        <option value="DIB Bank Kenya Ltd (Dubai Islamic Bank)">DIB Bank Kenya Ltd (Dubai Islamic Bank)</option>
                        <option value="Ecobank Kenya Ltd">Ecobank Kenya Ltd</option>
                        <option value="Family Bank Ltd">Family Bank Ltd</option>
                        <option value="Guardian Bank Ltd">Guardian Bank Ltd</option>
                        <option value="Gulf African Bank Ltd">Gulf African Bank Ltd</option>
                        <option value="Habib Bank AG Zurich">Habib Bank AG Zurich</option>
                        <option value="I&M Bank Ltd">I&M Bank Ltd</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Bank Account Number</label>
                      <input
                        type="text"
                        value={formData.bankAccountNumber || ''}
                        onChange={(e) => setFormData({...formData, bankAccountNumber: e.target.value})}
                        placeholder="Enter account number"
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Tax/Statutory Number</label>
                  <input
                    type="text"
                    value={formData.taxNumber || ''}
                    onChange={(e) => setFormData({...formData, taxNumber: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 md:px-6 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 md:px-6 py-2 bg-school-gradient text-white rounded-xl hover:shadow-lg hover:shadow-primary/20 font-bold transition-all"
                >
                  {editingId ? 'Update Employee' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
