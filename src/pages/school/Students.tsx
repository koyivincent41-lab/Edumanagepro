import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  GraduationCap, 
  Calendar, 
  User, 
  Loader2, 
  Edit2,
  Trash2,
  X,
  Link as LinkIcon,
  AlertCircle,
  Upload,
  Download,
  FileSpreadsheet,
  CreditCard,
  IdCard
} from 'lucide-react';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, where, getDoc, getDocs, writeBatch, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Student, Parent, Class, Stream, School, Package, Vehicle, Route } from '../../types';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Papa from 'papaparse';
import { useBranch } from '../../context/BranchContext';
import IDCardModal from '../../components/IDCardModal';

const studentSchema = z.object({
  admissionNumber: z.string().optional(),
  fullName: z.string().min(3, 'Full name must be at least 3 characters'),
  gender: z.enum(['male', 'female', 'other']),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  classId: z.string().min(1, 'Please select a class'),
  streamId: z.string().min(1, 'Please select a stream'),
  parentId: z.string().min(1, 'Please link a parent'),
  arrears: z.number().min(0, 'Arrears must be positive'),
  usesTransport: z.boolean().optional(),
  vehicleId: z.string().optional(),
  routeId: z.string().optional(),
  photoUrl: z.string().optional(),
});

type StudentForm = z.infer<typeof studentSchema>;

export default function Students({ schoolId, school }: { schoolId: string; school: School | null }) {
  const navigate = useNavigate();
  const { currentBranch } = useBranch();
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingIdStudent, setViewingIdStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activePackage, setActivePackage] = useState<Package | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      admissionNumber: '',
      fullName: '',
      gender: 'male',
      dateOfBirth: '',
      classId: '',
      streamId: '',
      parentId: '',
      arrears: 0,
      usesTransport: false,
      vehicleId: '',
      routeId: '',
    }
  });

  const selectedClassId = watch('classId');
  const usesTransportValue = watch('usesTransport');

  useEffect(() => {
    if (!schoolId) return;
    
    // Fetch active package details
    if (school?.packageId) {
      getDoc(doc(db, 'packages', school.packageId)).then(snap => {
        if (snap.exists()) setActivePackage({ id: snap.id, ...snap.data() } as Package);
      });
    }

    // Subscriptions
    let studentsQuery = query(
      collection(db, 'schools', schoolId, 'students'),
      where('academicYear', '==', school?.academicYear || '')
    );
    if (currentBranch) {
      studentsQuery = query(studentsQuery, where('branchId', '==', currentBranch.id));
    }

    const unsubStudents = onSnapshot(
      studentsQuery, 
      (snap) => {
        setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
        setLoading(false);
      }
    );

    let parentsQuery = query(collection(db, 'schools', schoolId, 'parents'));
    if (currentBranch) parentsQuery = query(parentsQuery, where('branchId', '==', currentBranch.id));
    const unsubParents = onSnapshot(parentsQuery, (snap) => {
      setParents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Parent)));
    });

    let classesQuery = query(collection(db, 'schools', schoolId, 'classes'));
    if (currentBranch) classesQuery = query(classesQuery, where('branchId', '==', currentBranch.id));
    const unsubClasses = onSnapshot(classesQuery, (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
    });

    let streamsQuery = query(collection(db, 'schools', schoolId, 'streams'));
    if (currentBranch) streamsQuery = query(streamsQuery, where('branchId', '==', currentBranch.id));
    const unsubStreams = onSnapshot(streamsQuery, (snap) => {
      setStreams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Stream)));
    });

    let invoicesQuery = query(collection(db, 'schools', schoolId, 'invoices'));
    if (currentBranch) invoicesQuery = query(invoicesQuery, where('branchId', '==', currentBranch.id));
    const unsubInvoices = onSnapshot(
      invoicesQuery,
      (snap) => {
        setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      }
    );

    let vehiclesQuery = query(collection(db, 'schools', schoolId, 'vehicles'));
    if (currentBranch) vehiclesQuery = query(vehiclesQuery, where('branchId', '==', currentBranch.id));
    const unsubVehicles = onSnapshot(vehiclesQuery, (snap) => {
      setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
    });

    let routesQuery = query(collection(db, 'schools', schoolId, 'routes'));
    if (currentBranch) routesQuery = query(routesQuery, where('branchId', '==', currentBranch.id));
    const unsubRoutes = onSnapshot(routesQuery, (snap) => {
      setRoutes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Route)));
    });

    return () => {
      unsubStudents();
      unsubParents();
      unsubClasses();
      unsubStreams();
      unsubInvoices();
      unsubVehicles();
      unsubRoutes();
    };
  }, [schoolId]);

  useEffect(() => {
    if (editingStudent) {
      reset({
        admissionNumber: editingStudent.admissionNumber,
        fullName: editingStudent.fullName,
        gender: editingStudent.gender,
        dateOfBirth: editingStudent.dateOfBirth,
        classId: editingStudent.classId,
        streamId: editingStudent.streamId,
        parentId: editingStudent.parentId,
        arrears: editingStudent.arrears || 0,
        usesTransport: editingStudent.usesTransport || false,
        vehicleId: editingStudent.vehicleId || '',
        routeId: editingStudent.routeId || '',
        photoUrl: editingStudent.photoUrl || '',
      });
    } else {
      reset({
        admissionNumber: '',
        fullName: '',
        gender: 'male',
        dateOfBirth: '',
        classId: '',
        streamId: '',
        parentId: '',
        arrears: 0,
        usesTransport: false,
        vehicleId: '',
        routeId: '',
        photoUrl: '',
      });
    }
  }, [editingStudent, reset]);

  const onSubmit = async (data: StudentForm) => {
    try {
      // Package Enforcement
      if (!editingStudent && activePackage) {
        if (students.length >= activePackage.studentLimit) {
          toast.error(`Student limit reached for ${activePackage.name} plan (${activePackage.studentLimit}). Please upgrade.`);
          return;
        }
      }

      // Fetch subjects for the selected class to automatically assign them
      const subjectsQuery = query(
        collection(db, 'class_subjects'),
        where('classId', '==', data.classId)
      );
      const subjectsSnap = await getDocs(subjectsQuery);
      const assignedSubjects = subjectsSnap.docs.map(d => d.data().subjectId);

      if (editingStudent) {
        await updateDoc(doc(db, 'schools', schoolId, 'students', editingStudent.id), {
          ...data,
          assignedSubjects,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          updatedAt: new Date().toISOString(),
        });
        toast.success('Student updated successfully');
      } else {
        if (!data.admissionNumber) {
          data.admissionNumber = `ADM-${(school?.studentCount || 0) + 1}`;
        }
        await addDoc(collection(db, 'schools', schoolId, 'students'), {
          ...data,
          assignedSubjects,
          schoolId,
          ...(currentBranch ? { branchId: currentBranch.id } : {}),
          academicYear: school?.academicYear || '',
          status: 'active',
          createdAt: new Date().toISOString(),
        });
        
        // Update school student count
        await setDoc(doc(db, 'schools', schoolId), {
          studentCount: (school?.studentCount || 0) + 1
        }, { merge: true });

        toast.success('Student added successfully');
      }
      setIsModalOpen(false);
      setEditingStudent(null);
      reset();
    } catch (error) {
      console.error('Error saving student:', error);
      toast.error('Failed to save student');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schools', schoolId, 'students', id));
      
      // Update school student count
      await setDoc(doc(db, 'schools', schoolId), {
        studentCount: Math.max(0, students.length - 1)
      }, { merge: true });

      toast.success('Student deleted successfully');
      setIsDeleteConfirmOpen(false);
      setStudentToDelete(null);
    } catch (error) {
      toast.error('Failed to delete student');
    }
  };

  const getStudentBalance = (studentId: string, initialArrears: number = 0) => {
    const studentInvoices = invoices.filter(inv => inv.studentId === studentId);
    const invoiceBalance = studentInvoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
    return initialArrears + invoiceBalance;
  };

  const filteredStudents = students.filter(s => 
    s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.admissionNumber.includes(searchTerm)
  );

  const filteredStreams = streams.filter(s => s.classId === selectedClassId);

  const downloadTemplate = () => {
    const headers = [
      'Admission Number',
      'Full Name',
      'Gender (male/female)',
      'Date of Birth (YYYY-MM-DD)',
      'Class Name',
      'Stream Name',
      'Initial Arrears',
      'Parent Full Name',
      'Parent Phone',
      'Parent Email',
      'Parent Address'
    ];
    const csv = Papa.unparse([headers]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'student_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const processBulkUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a CSV file first');
      return;
    }

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];
        if (data.length === 0) {
          toast.error('The CSV file is empty');
          return;
        }

        setLoading(true);
        let successCount = 0;
        let errorCount = 0;

        try {
          const newlyCreatedParents: Record<string, string> = {};
          
          for (const row of data) {
            try {
              // 1. Find or Create Parent
              let parentId = '';
              const parentPhone = row['Parent Phone']?.trim();
              
              if (!parentPhone) {
                console.error('Missing parent phone for row:', row);
                errorCount++;
                continue;
              }

              const existingParent = parents.find(p => p.phone === parentPhone);
              const newlyCreatedParentId = newlyCreatedParents[parentPhone];

              if (newlyCreatedParentId) {
                parentId = newlyCreatedParentId;
              } else if (existingParent) {
                parentId = existingParent.id;
              } else {
                const parentDoc = await addDoc(collection(db, 'schools', schoolId, 'parents'), {
                  fullName: row['Parent Full Name'] || 'Unknown Parent',
                  phone: parentPhone,
                  email: row['Parent Email'] || '',
                  address: row['Parent Address'] || '',
                  schoolId,
                  ...(currentBranch ? { branchId: currentBranch.id } : {}),
                  status: 'active',
                  createdAt: new Date().toISOString(),
                });
                parentId = parentDoc.id;
                newlyCreatedParents[parentPhone] = parentId;
              }

              // 2. Find Class and Stream
              const className = row['Class Name']?.trim();
              const streamName = row['Stream Name']?.trim();
              const cls = classes.find(c => c.name.toLowerCase() === className?.toLowerCase());
              const strm = streams.find(s => s.name.toLowerCase() === streamName?.toLowerCase() && s.classId === cls?.id);

              if (!cls || !strm || !parentId) {
                console.error('Missing required info for row:', row);
                errorCount++;
                continue;
              }

              // 3. Create Student
              // Fetch subjects for the class to automatically assign them
              const subjectsQuery = query(
                collection(db, 'class_subjects'),
                where('classId', '==', cls.id)
              );
              const subjectsSnap = await getDocs(subjectsQuery);
              const assignedSubjects = subjectsSnap.docs.map(d => d.data().subjectId);

              await addDoc(collection(db, 'schools', schoolId, 'students'), {
                admissionNumber: row['Admission Number'] || `ADM-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                fullName: row['Full Name'],
                gender: (row['Gender (male/female)']?.toLowerCase() === 'female' ? 'female' : 'male') as 'male' | 'female',
                dateOfBirth: row['Date of Birth (YYYY-MM-DD)'] || '',
                classId: cls.id,
                streamId: strm.id,
                parentId: parentId,
                arrears: parseFloat(row['Initial Arrears']) || 0,
                assignedSubjects,
                schoolId,
                ...(currentBranch ? { branchId: currentBranch.id } : {}),
                academicYear: school?.academicYear || '',
                status: 'active',
                createdAt: new Date().toISOString(),
              });
              successCount++;
            } catch (err) {
              console.error('Error processing row:', err);
              errorCount++;
            }
          }

          // Update school student count
          await setDoc(doc(db, 'schools', schoolId), {
            studentCount: students.length + successCount
          }, { merge: true });

          toast.success(`Import complete: ${successCount} added, ${errorCount} failed`);
          setIsBulkModalOpen(false);
          setSelectedFile(null);
        } catch (err) {
          console.error('Bulk import failed:', err);
          toast.error('Bulk import failed');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-4 md:p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white">Students Management</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Manage student enrollment and records.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                type="text"
                placeholder="Search students..."
                className="pl-10 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder:text-white/40 focus:bg-white/20 outline-none w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => {
                setEditingStudent(null);
                setIsModalOpen(true);
              }}
              className="px-4 md:px-6 py-2.5 bg-white text-maroon font-black uppercase tracking-widest text-[10px] rounded-xl shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Student
            </button>
            <button 
              onClick={() => {
                setIsBulkModalOpen(true);
                setSelectedFile(null);
              }}
              className="px-4 md:px-6 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-white/20 transition-all flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Bulk Import
            </button>
          </div>
        </div>
      </div>

      {/* Limit Info Card */}
      {activePackage && (
        <div className="bg-primary/5 border border-primary/10 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-school-gradient/10 rounded-lg">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{activePackage.name} Plan Limits</p>
              <p className="text-xs text-gray-500">Your plan allows up to {activePackage.studentLimit} students and {activePackage.userLimit} users.</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900">{students.length} / {activePackage.studentLimit} Students</p>
            <div className="w-32 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
              <div 
                className={`h-full transition-all ${students.length >= activePackage.studentLimit ? 'bg-red-500' : 'bg-school-gradient'}`}
                style={{ width: `${Math.min(100, (students.length / activePackage.studentLimit) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[700px] w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Student</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Adm No.</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Class / Stream</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Outstanding Balance</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Parent</th>
                <th className="px-4 md:px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.map((student) => {
                const parent = parents.find(p => p.id === student.parentId);
                const cls = classes.find(c => c.id === student.classId);
                const strm = streams.find(s => s.id === student.streamId);
                return (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-school-gradient/10 rounded-xl flex items-center justify-center text-primary font-bold">
                          {student.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{student.fullName}</p>
                          <p className="text-xs text-gray-500 uppercase tracking-widest">{student.gender}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm font-medium text-gray-600">{student.admissionNumber}</td>
                    <td className="px-4 md:px-6 py-4">
                      <p className="text-sm font-bold text-gray-900">{cls?.name || 'N/A'}</p>
                      <p className="text-xs text-gray-500">{strm?.name || 'N/A'}</p>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        getStudentBalance(student.id, student.arrears) > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {school?.currency} {getStudentBalance(student.id, student.arrears).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{parent?.fullName || 'N/A'}</p>
                      <p className="text-xs text-gray-500">{parent?.phone || ''}</p>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setViewingIdStudent(student)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
                          title="View ID Card"
                        >
                          <IdCard className="h-5 w-5" />
                          <span className="text-[10px] font-bold uppercase">ID</span>
                        </button>
                        <button 
                          onClick={() => navigate(`/dashboard/payments?studentId=${student.id}`)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-1"
                          title="Receive Payment"
                        >
                          <CreditCard className="h-5 w-5" />
                          <span className="text-[10px] font-bold uppercase">Pay</span>
                        </button>
                        <button 
                          onClick={() => {
                            setEditingStudent(student);
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => {
                            setStudentToDelete(student);
                            setIsDeleteConfirmOpen(true);
                          }}
                          className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-[calc(100%-2rem)] md:w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 shrink-0">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">{editingStudent ? 'Edit Student' : 'Add New Student'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-4 md:p-8 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {editingStudent && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Admission Number</label>
                    <input
                      {...register('admissionNumber')}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                      placeholder="e.g. ADM-001"
                    />
                    {errors.admissionNumber && <p className="mt-1 text-xs text-red-500">{errors.admissionNumber.message}</p>}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                  <input
                    {...register('fullName')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                    placeholder="Student's full name"
                  />
                  {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Student Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setValue('photoUrl', reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  />
                  {watch('photoUrl') && (
                    <div className="mt-2">
                       <img src={watch('photoUrl')} alt="Student Preview" className="w-24 h-24 object-cover rounded-xl border border-gray-200 shadow-sm" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Gender</label>
                  <select
                    {...register('gender')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all bg-white"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Date of Birth</label>
                  <input
                    {...register('dateOfBirth')}
                    type="date"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  />
                  {errors.dateOfBirth && <p className="mt-1 text-xs text-red-500">{errors.dateOfBirth.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Class</label>
                  <select
                    {...register('classId')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all bg-white"
                  >
                    <option value="">Select Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {errors.classId && <p className="mt-1 text-xs text-red-500">{errors.classId.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Stream</label>
                  <select
                    {...register('streamId')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all bg-white"
                  >
                    <option value="">Select Stream</option>
                    {filteredStreams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {errors.streamId && <p className="mt-1 text-xs text-red-500">{errors.streamId.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Parent / Guardian</label>
                  <select
                    {...register('parentId')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all bg-white"
                  >
                    <option value="">Select Parent</option>
                    {parents.map(p => <option key={p.id} value={p.id}>{p.fullName} ({p.phone})</option>)}
                  </select>
                  {errors.parentId && <p className="mt-1 text-xs text-red-500">{errors.parentId.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Previous Balance / Arrears ({school?.currency})</label>
                  <input
                    {...register('arrears', { valueAsNumber: true })}
                    type="number"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                    placeholder="0.00"
                  />
                  <p className="mt-1 text-[10px] text-gray-400 italic">This is the opening balance before any invoices were created.</p>
                  {errors.arrears && <p className="mt-1 text-xs text-red-500">{errors.arrears.message}</p>}
                </div>
              </div>

              {/* Transport Module Section */}
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Transport Information</h3>
                
                <div className="space-y-4">
                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('usesTransport')}
                      className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                    />
                    <div>
                      <p className="font-bold text-gray-900">Student Uses School Transport</p>
                      <p className="text-xs text-gray-500">Enable this to assign the student to a transport route.</p>
                    </div>
                  </label>

                  {usesTransportValue && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Transport Route</label>
                        <select
                          {...register('routeId')}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                        >
                          <option value="">Select Route</option>
                          {routes.map(r => (
                            <option key={r.id} value={r.id}>{r.name} - {school?.currency} {r.termlyFee}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Assigned Vehicle</label>
                        <select
                          {...register('vehicleId')}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                        >
                          <option value="">Select Vehicle</option>
                          {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.registrationNumber} ({v.make} {v.model})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex gap-4 mt-6 shrink-0 sticky -bottom-8 bg-white pb-8 z-10 w-[calc(100%+4rem)] -ml-8 px-4 md:px-8 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-school-gradient text-white font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
                  {editingStudent ? 'Update Student' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Bulk Import Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-[calc(100%-2rem)] md:w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">Bulk Import Students</h2>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 md:p-8 space-y-6">
              <div className="p-4 md:p-6 bg-primary/5 rounded-2xl border border-primary/10">
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  Step 1: Download Template
                </h3>
                <p className="text-sm text-gray-500 mb-4">Download the CSV template and fill in the student and parent details.</p>
                <button 
                  onClick={downloadTemplate}
                  className="w-full py-3 bg-white border border-primary/20 text-primary font-bold rounded-xl hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="h-5 w-5" />
                  Download CSV Template
                </button>
              </div>

              <div className="p-4 md:p-6 bg-gray-50 rounded-2xl border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Upload className="h-4 w-4 text-gray-400" />
                  Step 2: Upload Filled CSV
                </h3>
                <p className="text-sm text-gray-500 mb-4">Upload the completed CSV file to import students and link parents.</p>
                <label className="block">
                  <span className="sr-only">Choose CSV file</span>
                  <input 
                    type="file" 
                    accept=".csv"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2.5 file:px-4
                      file:rounded-xl file:border-0
                      file:text-sm file:font-bold
                      file:bg-primary file:text-white
                      hover:file:bg-primary/90
                      cursor-pointer"
                  />
                </label>

                {selectedFile && (
                  <div className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/10 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FileSpreadsheet className="h-4 w-4 text-primary" />
                      <span className="font-medium truncate">{selectedFile.name}</span>
                    </div>
                    <button
                      onClick={processBulkUpload}
                      disabled={loading}
                      className="w-full py-3 bg-school-gradient text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Upload className="h-5 w-5" />
                      )}
                      UPLOAD NOW
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Ensure Class and Stream names match exactly with existing ones in the system. 
                  Parents will be automatically created if they don't exist (matched by phone number).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && studentToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-[calc(100%-2rem)] md:w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 md:p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Student?</h3>
              <p className="text-gray-500 mb-8">
                Are you sure you want to delete <span className="font-bold text-gray-900">{studentToDelete.fullName}</span>? 
                This action cannot be undone and will remove all student records.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setStudentToDelete(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(studentToDelete.id)}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:scale-105 transition-all"
                >
                  Delete Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingIdStudent && school && (
        <IDCardModal
          school={school}
          type="student"
          person={viewingIdStudent}
          onClose={() => setViewingIdStudent(null)}
        />
      )}
    </div>
  );
}
