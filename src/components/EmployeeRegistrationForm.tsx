import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, doc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { School, SalaryStructure, Class, Employee } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { useBranch } from '../context/BranchContext';

const employeeSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().min(10, 'Phone number is required'),
  email: z.string().email('Invalid email address'),
  nationalId: z.string().min(1, 'National ID is required'),
  gender: z.enum(['male', 'female', 'other']),
  jobTitle: z.string().min(1, 'Job title is required'),
  department: z.string().min(1, 'Department is required'),
  employmentDate: z.string().min(1, 'Employment date is required'),
  status: z.enum(['active', 'inactive', 'suspended']),
  username: z.string().min(4, 'Username must be at least 4 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  profilePhoto: z.string().optional(),
  isClassTeacher: z.boolean().optional(),
  classTeacherAssignment: z.string().optional(),
  // Payroll Fields
  employmentType: z.enum(['full_time', 'part_time', 'contract']),
  paymentMethod: z.enum(['bank', 'mobile_money', 'cash']),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  taxNumber: z.string().optional(),
  salaryStructureId: z.string().min(1, 'Salary structure is required'),
  basicSalary: z.number().min(0, 'Basic salary must be at least 0'),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;

export default function EmployeeRegistrationForm({ school, employee, onClose, onAdded }: { school: School, employee?: Employee | null, onClose: () => void, onAdded: () => void }) {
  const { currentBranch } = useBranch();
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [existingClassTeachers, setExistingClassTeachers] = useState<Record<string, string>>({});

  const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: employee ? {
      fullName: employee.fullName,
      phone: employee.phone,
      email: employee.email,
      nationalId: employee.nationalId,
      gender: employee.gender,
      jobTitle: employee.jobTitle,
      department: employee.department,
      employmentDate: employee.dateOfEmployment,
      status: employee.status,
      username: employee.username,
      password: '', // Password not editable here for security
      isClassTeacher: employee.isClassTeacher || false,
      classTeacherAssignment: employee.classTeacherAssignment || '',
      employmentType: employee.employmentType,
      paymentMethod: employee.paymentMethod,
      bankName: employee.bankName || '',
      bankAccountNumber: employee.bankAccountNumber || '',
      taxNumber: employee.taxNumber || '',
      salaryStructureId: employee.salaryStructureId || '',
      basicSalary: employee.basicSalary || 0,
    } : {
      status: 'active',
      employmentType: 'full_time',
      paymentMethod: 'bank',
      basicSalary: 0,
      salaryStructureId: '',
      isClassTeacher: false,
      classTeacherAssignment: '',
    }
  });

  useEffect(() => {
    if (employee?.profilePhoto) {
      setPhotoPreview(employee.profilePhoto);
    }
  }, [employee]);

  useEffect(() => {
    let q = query(collection(db, 'schools', school.id, 'salary_structures'));
    if (currentBranch) {
      q = query(q, where('branchId', '==', currentBranch.id));
    }
    const unsubStructures = onSnapshot(
      q, 
      (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalaryStructure));
        setStructures(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `schools/${school.id}/salary_structures`)
    );

    let classesQuery = query(collection(db, 'schools', school.id, 'classes'));
    if (currentBranch) {
      classesQuery = query(classesQuery, where('branchId', '==', currentBranch.id));
    }
    const unsubClasses = onSnapshot(
      classesQuery,
      (snap) => {
        setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `schools/${school.id}/classes`)
    );

    // Fetch existing class teachers to show warnings
    let teachersQuery = query(
      collection(db, 'employees'), 
      where('schoolId', '==', school.id),
      where('isClassTeacher', '==', true)
    );
    if (currentBranch) {
      teachersQuery = query(teachersQuery, where('branchId', '==', currentBranch.id));
    }
    const unsubTeachers = onSnapshot(
      teachersQuery,
      (snap) => {
        const mapping: Record<string, string> = {};
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (data.classTeacherAssignment) {
            mapping[data.classTeacherAssignment] = data.fullName;
          }
        });
        setExistingClassTeachers(mapping);
      }
    );

    return () => {
      unsubStructures();
      unsubClasses();
      unsubTeachers();
    };
  }, [school.id, currentBranch]);

  const selectedPaymentMethod = watch('paymentMethod');
  const selectedStructureId = watch('salaryStructureId');
  const isClassTeacher = watch('isClassTeacher');
  const selectedClassId = watch('classTeacherAssignment');
  const jobTitle = watch('jobTitle');

  useEffect(() => {
    const structure = structures.find(s => s.id === selectedStructureId);
    if (structure) {
      setValue('basicSalary', structure.baseSalary);
    }
  }, [selectedStructureId, structures, setValue]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPhotoPreview(base64String);
        setValue('profilePhoto', base64String);
      };
      reader.readAsDataURL(file);
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

  const onSubmit = async (data: EmployeeFormValues) => {
    // Validation: Only teachers can be class teachers
    const isTeacher = jobTitle.toLowerCase().includes('teacher') || data.department.toLowerCase().includes('academic');
    if (data.isClassTeacher && !isTeacher) {
      toast.error('Only teaching staff can be assigned as class teachers');
      return;
    }

    if (data.isClassTeacher && !data.classTeacherAssignment) {
      toast.error('Please select a class for the class teacher');
      return;
    }

    setLoading(true);
    try {
      const bcrypt = await import('bcryptjs');
      let passwordHash = employee?.passwordHash;
      if (data.password) {
        passwordHash = await bcrypt.hash(data.password, 10);
      }
      
      const { password, employmentDate, ...employeeData } = data;
      const staffNumber = employee?.staffNumber || generateStaffNumber();
      
      const employeePayload = {
        ...employeeData,
        dateOfEmployment: employmentDate,
        designation: data.jobTitle, 
        passwordHash,
        staffNumber,
        schoolId: school.id,
        ...(currentBranch ? { branchId: currentBranch.id } : {}),
        payrollStatus: 'active',
        updatedAt: new Date().toISOString(),
      };

      let employeeId = employee?.id;

      if (employee) {
        await updateDoc(doc(db, 'employees', employee.id), employeePayload);
        toast.success('Employee updated successfully');
      } else {
        const docRef = await addDoc(collection(db, 'employees'), {
          ...employeePayload,
          createdAt: new Date().toISOString(),
        });
        employeeId = docRef.id;
        toast.success(`Employee registered successfully with ID: ${staffNumber}`);
      }

      // Handle Class Teacher Assignment Reflection
      if (data.isClassTeacher && data.classTeacherAssignment) {
        // 1. Unassign this teacher from any other class they might have been assigned to
        const otherClassesQuery = query(
          collection(db, 'schools', school.id, 'classes'),
          where('classTeacherId', '==', employeeId)
        );
        const otherClassesSnap = await getDocs(otherClassesQuery);
        const batch = writeBatch(db);
        otherClassesSnap.docs.forEach(d => {
          if (d.id !== data.classTeacherAssignment) {
            batch.update(d.ref, {
              classTeacherId: null,
              classTeacherName: null,
              updatedAt: new Date().toISOString()
            });
          }
        });

        // 2. Unassign any other teacher from the target class
        const targetClassRef = doc(db, 'schools', school.id, 'classes', data.classTeacherAssignment);
        batch.update(targetClassRef, {
          classTeacherId: employeeId,
          classTeacherName: data.fullName,
          updatedAt: new Date().toISOString()
        });

        // 3. If this teacher was previously assigned to a different class, we already handled it in step 1.
        // But we should also ensure any other employee who was marked as class teacher for THIS class is updated.
        const otherTeachersQuery = query(
          collection(db, 'employees'),
          where('schoolId', '==', school.id),
          where('classTeacherAssignment', '==', data.classTeacherAssignment)
        );
        const otherTeachersSnap = await getDocs(otherTeachersQuery);
        otherTeachersSnap.docs.forEach(d => {
          if (d.id !== employeeId) {
            batch.update(d.ref, {
              isClassTeacher: false,
              classTeacherAssignment: null,
              updatedAt: new Date().toISOString()
            });
          }
        });

        await batch.commit();
      } else if (employee?.isClassTeacher && !data.isClassTeacher) {
        // If they were a class teacher but are no longer
        if (employee.classTeacherAssignment) {
          await updateDoc(doc(db, 'schools', school.id, 'classes', employee.classTeacherAssignment), {
            classTeacherId: null,
            classTeacherName: null,
            updatedAt: new Date().toISOString()
          });
        }
      }

      onAdded();
      onClose();
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error('Failed to save employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Register New Employee</h2>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Full Name</label>
            <input {...register('fullName')} placeholder="Full Name" className="w-full p-2 border rounded" />
            {errors.fullName && <p className="text-red-500 text-xs">{errors.fullName.message}</p>}
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Phone Number</label>
            <input {...register('phone')} placeholder="Phone Number" className="w-full p-2 border rounded" />
            {errors.phone && <p className="text-red-500 text-xs">{errors.phone.message}</p>}
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Email Address</label>
            <input {...register('email')} placeholder="Email" className="w-full p-2 border rounded" />
            {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">National ID</label>
            <input {...register('nationalId')} placeholder="National ID" className="w-full p-2 border rounded" />
            {errors.nationalId && <p className="text-red-500 text-xs">{errors.nationalId.message}</p>}
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Gender</label>
            <select {...register('gender')} className="w-full p-2 border rounded">
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Job Title</label>
            <input {...register('jobTitle')} placeholder="e.g. Teacher, Accountant" className="w-full p-2 border rounded" />
            {errors.jobTitle && <p className="text-red-500 text-xs">{errors.jobTitle.message}</p>}
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Department</label>
            <input {...register('department')} placeholder="e.g. Academic, Finance" className="w-full p-2 border rounded" />
            {errors.department && <p className="text-red-500 text-xs">{errors.department.message}</p>}
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Employment Date</label>
            <input type="date" {...register('employmentDate')} className="w-full p-2 border rounded" />
            {errors.employmentDate && <p className="text-red-500 text-xs">{errors.employmentDate.message}</p>}
          </div>

          <div className="col-span-2 border-t pt-4 mt-2">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Class Teacher Assignment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-2 border rounded-xl bg-gray-50">
                <input 
                  type="checkbox" 
                  {...register('isClassTeacher')} 
                  id="isClassTeacher"
                  className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="isClassTeacher" className="text-sm font-bold text-gray-700 cursor-pointer">
                  Is this employee a class teacher?
                </label>
              </div>

              {isClassTeacher && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Select Class</label>
                  <select {...register('classTeacherAssignment')} className="w-full p-2 border rounded">
                    <option value="">Select Class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {selectedClassId && existingClassTeachers[selectedClassId] && (
                    <p className="text-amber-600 text-[10px] font-bold mt-1">
                      ⚠️ Warning: {existingClassTeachers[selectedClassId]} is already assigned to this class.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="col-span-2 border-t pt-4 mt-2">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Payroll & Employment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Employment Type</label>
                <select {...register('employmentType')} className="w-full p-2 border rounded">
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Salary Structure</label>
                <select {...register('salaryStructureId')} className="w-full p-2 border rounded">
                  <option value="">Select Salary Structure</option>
                  {structures.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({school.currency} {(s.baseSalary || 0).toLocaleString()})</option>
                  ))}
                </select>
                {errors.salaryStructureId && <p className="text-red-500 text-xs">{errors.salaryStructureId.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Payment Method</label>
                <select {...register('paymentMethod')} className="w-full p-2 border rounded">
                  <option value="bank">Bank Transfer</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Tax/Statutory Number</label>
                <input {...register('taxNumber')} placeholder="Tax Number" className="w-full p-2 border rounded" />
              </div>

              {selectedPaymentMethod === 'bank' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Bank Name</label>
                    <select {...register('bankName')} className="w-full p-2 border rounded">
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
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Account Number</label>
                    <input {...register('bankAccountNumber')} placeholder="Account Number" className="w-full p-2 border rounded" />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="col-span-2 border-t pt-4 mt-2">
            <h3 className="text-sm font-bold text-gray-900 mb-4">App Access Credentials</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Username</label>
                <input {...register('username')} placeholder="Username" className="w-full p-2 border rounded" />
                {errors.username && <p className="text-red-500 text-xs">{errors.username.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Password</label>
                <input type="password" {...register('password')} placeholder="Password" className="w-full p-2 border rounded" />
                {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
              </div>
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
            <select {...register('status')} className="w-full p-2 border rounded">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
            <div className="flex items-center gap-4">
              {photoPreview && (
                <img src={photoPreview} alt="Preview" className="w-16 h-16 rounded-full object-cover border" />
              )}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handlePhotoChange}
                className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="col-span-2 py-3 bg-primary text-white rounded-lg font-bold">
            {loading ? <Loader2 className="animate-spin mx-auto" /> : employee ? 'Update Employee' : 'Register Employee'}
          </button>
        </form>
      </div>
    </div>
  );
}
