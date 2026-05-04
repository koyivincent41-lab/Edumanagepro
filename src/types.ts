export type SchoolStatus = 'pending' | 'active' | 'suspended' | 'inactive';
export type UserRole = 'super-admin' | 'owner' | 'admin' | 'accountant' | 'clerk' | 'teacher' | 'parent' | 'employee';
export type UserStatus = 'pending' | 'active' | 'suspended' | 'inactive' | 'incomplete';
export type PackagePlan = 'Silver' | 'Gold' | 'Diamond' | string;
export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'suspended' | 'inactive' | 'pending_approval';
export type Term = 'Term 1' | 'Term 2' | 'Term 3';
export type BillingCycle = 'monthly' | 'six-months' | 'yearly';
export type SubscriptionPaymentStatus = 'Pending Approval' | 'Verified' | 'Approved' | 'Rejected';

export interface SubscriptionPayment {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolEmail: string;
  phoneNumber?: string;
  selectedPackageId: string;
  selectedPackageName: string;
  billingCycle: BillingCycle;
  originalPrice: number;
  payableAmountKES: number;
  paymentMethod: 'MPESA';
  mpesaConfirmationCode: string;
  paymentStatus: SubscriptionPaymentStatus;
  subscriptionStatus: SubscriptionStatus | 'Pending Approval' | 'Rejected';
  submittedAt: string;
  expiryDate?: string;
  adminVerificationCode?: string;
  verifiedAt?: string;
  approvedBy?: string;
  notes?: string;
}
export interface Package {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  studentLimit: number;
  userLimit: number;
  trialDays: number;
  features: string[];
  isFeatured: boolean;
  order: number;
  status: 'active' | 'inactive';
  description?: string;
  highlights?: string[];
  buttonLabel?: string;
  stripePriceId?: string;
  stripeProductId?: string;
}

export interface Branch {
  id: string;
  schoolId: string; // This acts as the organization_id
  name: string;
  code?: string;
  type?: string;
  country?: string;
  region?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
  motto?: string;
  principalName?: string;
  academicYear?: string;
  currency?: string;
  timezone?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface School {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  currency: string;
  schoolNumber?: string;
  academicYear: string;
  currentTerm?: Term;
  packageId: string;
  billingCycle?: BillingCycle;
  status: SchoolStatus;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiry: string;
  trialExpiry?: string;
  paymentStatus?: 'paid' | 'unpaid';
  activationDate?: string;
  studentCount: number;
  userCount: number;
  createdAt: string;
  logo?: string;
  signature?: string;
  motto?: string;
  primaryColor?: string;
  secondaryColor?: string;
  isGradient?: boolean;
  invoiceFooter?: string;
  receiptFooter?: string;
  attendanceSettings?: AttendanceSettings;
  totalPaid?: number;
}

export interface SubscriptionHistory {
  id: string;
  schoolId: string;
  packageId: string;
  action: 'assign' | 'upgrade' | 'downgrade' | 'extend' | 'suspend' | 'activate' | 'expire' | 'mark_paid' | 'mark_unpaid' | 'set_renewal' | 'delete';
  previousPackageId?: string;
  amount?: number;
  notes?: string;
  createdAt: string;
  performedBy: string;
}

export interface UserProfile {
  uid: string;
  schoolId: string | null;
  branchId?: string | null;
  fullName: string;
  email: string;
  role: UserRole | 'branch-admin';
  status: UserStatus;
  createdAt: string;
  employeeId?: string;
  staffNumber?: string;
  classTeacherAssignment?: string | null;
}

export interface Student {
  id: string;
  schoolId: string;
  branchId?: string;
  admissionNumber: string;
  fullName: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  classId: string;
  streamId: string;
  parentId: string;
  academicYear: string;
  term?: Term;
  arrears: number;
  status: 'active' | 'inactive' | 'graduated' | 'transferred';
  createdAt: string;
}

export interface Parent {
  id: string;
  parentId?: string;
  uid?: string;
  schoolId: string;
  branchId?: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  username: string;
  passwordHash: string;
  status: 'active' | 'inactive';
  mustChangePassword: boolean;
  createdAt: string;
}

export interface ParentStudentLink {
  id: string;
  schoolId: string;
  branchId?: string;
  parentId: string;
  studentId: string;
  relationshipType: string;
}

export interface Class {
  id: string;
  schoolId: string;
  branchId?: string;
  name: string;
  classTeacherId?: string;
  classTeacherName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FeeType {
  id: string;
  schoolId: string;
  branchId?: string;
  name: string;
  description?: string;
  amount: number;
  frequency: 'once' | 'termly' | 'yearly' | 'monthly';
  isOptional: boolean;
  status: 'active' | 'inactive';
}

export interface Stream {
  id: string;
  schoolId: string;
  branchId?: string;
  classId: string;
  name: string;
}

export interface Invoice {
  id: string;
  schoolId: string;
  branchId?: string;
  invoiceNumber: string;
  parentId: string;
  studentId: string;
  studentName?: string;
  admissionNumber?: string;
  totalAmount: number;
  balanceDue: number;
  amountPaid?: number;
  status: InvoiceStatus;
  dueDate: string;
  notes?: string;
  items?: { name: string; amount: number }[];
  academicYear: string;
  term?: Term;
  createdAt: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  schoolId: string;
  branchId?: string;
  invoiceId: string;
  invoiceNumber?: string;
  studentId: string;
  studentName?: string;
  admissionNumber?: string;
  parentId: string;
  amount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'mobile_money' | 'cheque';
  reference: string;
  paymentDate: string;
  receiptNumber: string;
  status?: 'paid' | 'awaiting_approval' | 'rejected' | 'declined';
  isOnline?: boolean;
  academicYear: string;
  term?: Term;
  createdAt: string;
}

export interface Notification {
  id: string;
  schoolId: string;
  branchId?: string;
  parentId: string;
  title: string;
  message: string;
  type: 'payment_approved' | 'payment_declined' | 'general' | 'new_invoice' | 'new_receipt';
  read: boolean;
  createdAt: string;
}

export interface SystemEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  message: string;
  html?: string;
  status: 'received' | 'sent' | 'draft' | 'archived';
  read: boolean;
  createdAt: string;
  type: 'incoming' | 'outgoing';
  schoolId?: string; // Optional, if linked to a school
  branchId?: string;
  senderName?: string;
  recipientName?: string;
  attachment?: { name: string, data: string } | null;
}

export interface SalaryStructure {
  id: string;
  schoolId: string;
  branchId?: string;
  name: string;
  description: string;
  baseSalary: number;
  allowanceIds: string[];
  deductionIds: string[];
  createdAt: string;
}

export interface Employee {
  id: string;
  schoolId: string;
  branchId?: string;
  fullName: string;
  staffNumber: string;
  designation: string;
  department: string;
  jobTitle: string;
  employmentType: 'full_time' | 'part_time' | 'contract';
  dateOfEmployment: string;
  payrollStatus: 'active' | 'inactive';
  paymentMethod: 'bank' | 'mobile_money' | 'cash';
  bankName?: string;
  bankAccountNumber?: string;
  taxNumber?: string;
  basicSalary: number;
  salaryStructureId?: string;
  isClassTeacher?: boolean;
  classTeacherAssignment?: string;
  phone: string;
  email: string;
  nationalId: string;
  gender: 'male' | 'female' | 'other';
  status: 'active' | 'inactive' | 'suspended';
  username: string;
  passwordHash: string;
  profilePhoto?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollAllowance {
  id: string;
  schoolId: string;
  branchId?: string;
  name: string;
  type: 'fixed' | 'percentage';
  amount: number; // or percentage value
  isRecurring: boolean;
  isTaxable: boolean;
  assignedTo: 'all' | 'specific';
  employeeIds?: string[];
}

export interface PayrollDeduction {
  id: string;
  schoolId: string;
  branchId?: string;
  name: string;
  type: 'fixed' | 'percentage';
  amount: number;
  isRecurring: boolean;
  isStatutory: boolean;
  assignedTo: 'all' | 'specific';
  employeeIds?: string[];
}

export interface PayrollPeriod {
  id: string;
  schoolId: string;
  branchId?: string;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  paymentDate: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'paid' | 'cancelled';
  totalGross?: number;
  totalDeductions?: number;
  totalNetPay?: number;
  createdAt: string;
}

export interface PayrollEntry {
  id: string;
  schoolId: string;
  branchId?: string;
  periodId: string;
  employeeId: string;
  employeeName: string;
  staffNumber?: string;
  payslipNumber?: string;
  basicSalary: number;
  allowances: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
  grossPay: number;
  netPay: number;
  status: 'draft' | 'approved' | 'paid';
}

export interface Loan {
  id: string;
  schoolId: string;
  branchId?: string;
  employeeId: string;
  type: 'loan' | 'advance';
  amount: number;
  interestRate: number;
  repaymentMonths: number;
  monthlyDeduction: number;
  balance: number;
  remainingBalance?: number;
  amountPaid?: number;
  repaymentStartMonth?: number;
  repaymentStartYear?: number;
  repayments?: {
    month: number;
    year: number;
    amount: number;
    date: string;
    payrollEntryId: string;
  }[];
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'paid';
  requestDate: string;
  dateRequested?: string;
  dateApproved?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalaryAdvance {
  id: string;
  schoolId: string;
  branchId?: string;
  employeeId: string;
  amount: number;
  dateIssued: string;
  recoveryMethod: 'one-time' | 'installments';
  recoveryStartMonth: number;
  recoveryStartYear: number;
  numberOfInstallments: number;
  installmentAmount: number;
  remainingBalance: number;
  repayments?: {
    month: number;
    year: number;
    amount: number;
    date: string;
    payrollEntryId: string;
  }[];
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'paid';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AttendanceSettings {
  schoolId: string;
  branchId?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  clockInStart: string; // HH:mm
  clockInEnd: string;   // HH:mm
  clockOutStart: string; // HH:mm
  clockOutEnd: string;   // HH:mm
  lateThresholdMinutes: number;
  earlyDepartureThresholdMinutes: number;
  requireGPS: boolean;
  requireFingerprint: boolean;
  requireSelfie: boolean;
  oncePerSession: boolean;
  updatedAt: string;
}

export interface ExamSession {
  id: string;
  schoolId: string;
  branchId?: string;
  academicYear: string;
  term: Term;
  examType: 'Openar' | 'Opener' | 'Midterm' | 'End Term';
  examName: string;
  startDate: string;
  endDate: string;
  applicableClasses: string[];
  applicableSubjects: string[];
  maximumScore: number;
  status: 'Draft' | 'Open' | 'Closed' | 'Published';
  createdAt: string;
  updatedAt: string;
}

export interface GradingBand {
  id: string;
  gradeName: string;
  minScore: number;
  maxScore: number;
  remarks: string;
}

export interface GradingSystem {
  id: string;
  schoolId: string;
  branchId?: string;
  bands: GradingBand[];
  updatedAt: string;
}

export interface ExamResult {
  id: string;
  schoolId: string;
  branchId?: string;
  academicYear: string;
  term: Term | string;
  examSessionId: string;
  examType: 'Openar' | 'Midterm' | 'End Term' | string;
  examsCategory?: 'Openar Exams' | 'Open Exams' | 'Midterm Exams' | 'End Term Exams';
  teacherId?: string;
  teacherUserId?: string;
  classId: string;
  studentId: string;
  subjectId: string;
  scoreObtained: number;
  maximumScore: number;
  gradeGenerated?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  schoolId: string;
  branchId?: string;
  name: string;
  code: string;
  category?: string;
  description?: string;
  status: 'active' | 'inactive';
  classes?: string[]; // Kept for backwards compatibility if needed, but we'll use ClassSubject for linking
  createdAt: string;
  updatedAt: string;
}

export interface ClassSubject {
  id: string;
  schoolId: string;
  branchId?: string;
  classId: string;
  subjectId: string;
  teacherId?: string;
  teacherName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentSubject {
  id: string;
  schoolId: string;
  branchId?: string;
  studentId: string;
  subjectId: string;
  classId: string;
  academicYear: string;
  term: Term;
  status: 'active' | 'dropped';
  createdAt: string;
  updatedAt: string;
}
