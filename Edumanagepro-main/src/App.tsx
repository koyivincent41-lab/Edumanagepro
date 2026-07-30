import { useState, useEffect } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useLocation 
} from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, getDocFromServer, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from './types';
import { Toaster } from 'sonner';
import ErrorBoundary from './components/ErrorBoundary';

// Pages (to be created)
import Home from './pages/public/Home';
import Pricing from './pages/public/Pricing';
import About from './pages/public/About';
import Contact from './pages/public/Contact';
import Register from './pages/public/Register';
import RegistrationComplete from './pages/public/RegistrationComplete';
import Login from './pages/public/Login';
import MobileLogin from './pages/mobile/Login';
import AttendanceHome from './pages/mobile/AttendanceHome';
import PrivacyPolicy from './pages/public/PrivacyPolicy';
import TermsOfService from './pages/public/TermsOfService';
import PublicSchoolWebsite from './pages/public/PublicSchoolWebsite';
import EmployeePaySlip from './pages/public/EmployeePaySlip';
import SuperAdminLogin from './pages/super-admin/Login';
import SuperAdminDashboard from './pages/super-admin/Dashboard';
import ParentLogin from './pages/parent-portal/Login';
import StudentLogin from './pages/public/StudentLogin';
import StudentPortalLayout from './pages/student-portal/Layout';
import ParentDashboard from './pages/parent-portal/Dashboard';
import MyChildren from './pages/parent-portal/MyChildren';
import Invoices from './pages/parent-portal/Invoices';
import Receipts from './pages/parent-portal/Receipts';
import ParentInbox from './pages/parent-portal/Inbox';
import PaymentHistory from './pages/parent-portal/PaymentHistory';
import AccountSettings from './pages/parent-portal/AccountSettings';
import LearnerAttendanceParent from './pages/parent-portal/LearnerAttendanceParent';
import TransportTracking from './pages/parent-portal/TransportTracking';
import ExaminationResults from './pages/parent-portal/ExaminationResults';
import LiveClassesParent from './pages/parent-portal/LiveClasses';

import ParentProtectedRoute from './components/ParentProtectedRoute';
import SuperAdminProtectedRoute from './components/SuperAdminProtectedRoute';
import SchoolProtectedRoute from './components/SchoolProtectedRoute';

import SchoolDashboard from './pages/school/Dashboard';
import ParentsModule from './pages/school/Parents';
import StudentsModule from './pages/school/Students';
import InvoicesModule from './pages/school/Invoices';
import SettingsModule from './pages/school/Settings';

import TeacherExamsLogin from './pages/teacher-portal/Login';
import TeacherExamsDashboard from './pages/teacher-portal/Dashboard';

import { BranchProvider } from './context/BranchContext';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous profile listener if it exists
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Listen to user profile
        profileUnsubscribe = onSnapshot(doc(db, 'users', firebaseUser.uid), (snapshot) => {
          if (snapshot.exists()) {
            setProfile({ uid: snapshot.id, ...snapshot.data() } as UserProfile);
          } else {
            // Fallback for super admins or legacy users if they don't have a profile doc yet
            const adminEmails = ['koyivincent41@gmail.com', 'crownhillacademy@gmail.com'];
            const isSuperAdmin = adminEmails.includes(firebaseUser.email?.toLowerCase() || '');
            
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              fullName: isSuperAdmin ? 'Super Admin' : 'Incomplete Profile',
              role: isSuperAdmin ? 'super-admin' : 'owner',
              status: isSuperAdmin ? 'active' : 'incomplete',
              schoolId: isSuperAdmin ? null : 'demo-school-id',
              createdAt: new Date().toISOString()
            });
          }
          setLoading(false);
          setIsInitialLoad(false);
        }, (error) => {
          console.error("Profile listener error:", error);
          setLoading(false);
          setIsInitialLoad(false);
        });
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
        setIsInitialLoad(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <Toaster position="top-right" richColors />
        <Routes>
        <Route path="/mobile/login" element={<MobileLogin />} />
        <Route path="/mobile/attendance" element={<AttendanceHome />} />
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/s/:slug/*" element={<PublicSchoolWebsite />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/register" element={<Register />} />
        <Route path="/registration-complete" element={<RegistrationComplete />} />
        <Route path="/login" element={<Login profile={profile} />} />
        <Route path="/payslip" element={<EmployeePaySlip />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/super-admin/login" element={<SuperAdminLogin profile={profile} />} />
        <Route path="/parent-portal/login" element={<ParentLogin profile={profile} />} />
        <Route path="/student-login" element={<StudentLogin />} />
        <Route path="/student-portal/*" element={<StudentPortalLayout />} />
        <Route path="/teacher-portal/login" element={<TeacherExamsLogin />} />
        <Route path="/teacher-portal/dashboard/*" element={<TeacherExamsDashboard />} />

        <Route 
          path="/super-admin/*" 
          element={
            <SuperAdminProtectedRoute profile={profile} loading={loading}>
              <SuperAdminDashboard profile={profile!} />
            </SuperAdminProtectedRoute>
          } 
        />

        <Route 
          path="/parent-portal/dashboard" 
          element={
            <ParentProtectedRoute profile={profile} user={user} loading={loading}>
              <ParentDashboard profile={profile!} />
            </ParentProtectedRoute>
          } 
        />
        <Route 
          path="/parent-portal/inbox" 
          element={
            <ParentProtectedRoute profile={profile} user={user} loading={loading}>
              <ParentInbox profile={profile!} />
            </ParentProtectedRoute>
          } 
        />
        <Route 
          path="/parent-portal/children" 
          element={
            <ParentProtectedRoute profile={profile} user={user} loading={loading}>
              <MyChildren profile={profile!} />
            </ParentProtectedRoute>
          } 
        />
        <Route 
          path="/parent-portal/attendance" 
          element={
            <ParentProtectedRoute profile={profile} user={user} loading={loading}>
              <LearnerAttendanceParent profile={profile!} />
            </ParentProtectedRoute>
          } 
        />
        <Route 
          path="/parent-portal/transport" 
          element={
            <ParentProtectedRoute profile={profile} user={user} loading={loading}>
              <TransportTracking profile={profile!} />
            </ParentProtectedRoute>
          } 
        />
        <Route 
          path="/parent-portal/examination-results" 
          element={
            <ParentProtectedRoute profile={profile} user={user} loading={loading}>
              <ExaminationResults profile={profile!} />
            </ParentProtectedRoute>
          } 
        />
        <Route 
          path="/parent-portal/invoices" 
          element={
            <ParentProtectedRoute profile={profile} user={user} loading={loading}>
              <Invoices profile={profile!} />
            </ParentProtectedRoute>
          } 
        />
        <Route 
          path="/parent-portal/receipts" 
          element={
            <ParentProtectedRoute profile={profile} user={user} loading={loading}>
              <Receipts profile={profile!} />
            </ParentProtectedRoute>
          } 
        />
        <Route 
          path="/parent-portal/payment-history" 
          element={
            <ParentProtectedRoute profile={profile} user={user} loading={loading}>
              <PaymentHistory profile={profile!} />
            </ParentProtectedRoute>
          } 
        />
        <Route 
          path="/parent-portal/settings" 
          element={
            <ParentProtectedRoute profile={profile} user={user} loading={loading}>
              <AccountSettings profile={profile!} />
            </ParentProtectedRoute>
          } 
        />
        <Route 
          path="/parent-portal/live-classes" 
          element={
            <ParentProtectedRoute profile={profile} user={user} loading={loading}>
              <LiveClassesParent profile={profile!} />
            </ParentProtectedRoute>
          } 
        />

        {/* School Routes */}
        <Route 
          path="/dashboard/*" 
          element={
            <SchoolProtectedRoute profile={profile} loading={loading}>
              <BranchProvider profile={profile}>
                <SchoolDashboard profile={profile!} />
              </BranchProvider>
            </SchoolProtectedRoute>
          } 
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
    </ErrorBoundary>
  );
}
