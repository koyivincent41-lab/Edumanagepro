import React, { useState, useEffect } from 'react';
import ParentLayout from '../../components/ParentLayout';
import { UserProfile } from '../../types';
import { Users, DollarSign, FileText, Receipt, Lock, ArrowRight, Loader2, History, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, onSnapshot } from 'firebase/firestore';

export default function ParentDashboard({ profile }: { profile: UserProfile }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    childrenCount: 0,
    outstandingBalance: 0,
    invoiceCount: 0,
    receiptCount: 0,
    recentPayments: [] as any[],
    currency: 'USD',
    schoolName: 'EduManagePro',
    primaryColor: '#800000',
    secondaryColor: '#800000',
    isGradient: false
  });

  useEffect(() => {
    if (!profile || !profile.schoolId) return;

    let unsubSchool: () => void;
    let unsubParents: () => void;
    let unsubChildren: () => void;
    let unsubTotalPayments: () => void;
    let unsubPayments: () => void;
    let unsubInvoices: () => void;

    const setupListeners = async () => {
      try {
        // Fetch school data for currency and theme
        unsubSchool = onSnapshot(doc(db, 'schools', profile.schoolId!), (docSnap) => {
          const schoolData = docSnap.data();
          setData(prev => ({
            ...prev,
            currency: schoolData?.currency || 'USD',
            schoolName: schoolData?.name || 'EduManagePro',
            primaryColor: schoolData?.primaryColor || '#800000',
            secondaryColor: schoolData?.secondaryColor || '#800000',
            isGradient: schoolData?.isGradient || false
          }));
        });

        // Find the parent document
        const parentsQuery = query(
          collection(db, 'schools', profile.schoolId!, 'parents'), 
          where('uid', '==', profile.uid)
        );
        
        const parentsSnapshot = await getDocs(parentsQuery);
        if (parentsSnapshot.empty) {
          setLoading(false);
          return;
        }
        
        const parentId = parentsSnapshot.docs[0].id;

        // Listen to children
        const childrenQuery = query(
          collection(db, 'schools', profile.schoolId!, 'students'), 
          where('parentId', '==', parentId)
        );
        unsubChildren = onSnapshot(childrenQuery, (snap) => {
          setData(prev => ({ ...prev, childrenCount: snap.size }));
        });

        // Listen to all paid payments for total count
        const totalPaymentsQuery = query(
          collection(db, 'schools', profile.schoolId!, 'payments'), 
          where('parentId', '==', parentId),
          where('status', '==', 'paid')
        );
        const unsubTotalPayments = onSnapshot(totalPaymentsQuery, (snap) => {
          setData(prev => ({ ...prev, receiptCount: snap.size }));
        });

        // Listen to recent payments
        const recentPaymentsQuery = query(
          collection(db, 'schools', profile.schoolId!, 'payments'), 
          where('parentId', '==', parentId),
          orderBy('paymentDate', 'desc'),
          limit(5)
        );
        unsubPayments = onSnapshot(recentPaymentsQuery, (snap) => {
          const recentPayments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setData(prev => ({ 
            ...prev, 
            recentPayments
          }));
        });

        // Listen to all invoices for balance and total count
        const invoicesQuery = query(
          collection(db, 'schools', profile.schoolId!, 'invoices'),
          where('parentId', '==', parentId)
        );
        unsubInvoices = onSnapshot(invoicesQuery, (snap) => {
          let balance = 0;
          snap.forEach(d => {
            const inv = d.data();
            if (inv.status !== 'paid' && inv.status !== 'Paid' && inv.status !== 'cancelled') {
              balance += (inv.balanceDue || 0);
            }
          });
          setData(prev => ({
            ...prev,
            outstandingBalance: balance,
            invoiceCount: snap.size
          }));
          setLoading(false);
        });

      } catch (error) {
        console.error("Error setting up listeners:", error);
        setLoading(false);
      }
    };

    setupListeners();

    return () => {
      if (unsubSchool) unsubSchool();
      if (unsubChildren) unsubChildren();
      if (unsubTotalPayments) unsubTotalPayments();
      if (unsubPayments) unsubPayments();
      if (unsubInvoices) unsubInvoices();
    };
  }, [profile]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: data.currency
    }).format(amount);
  };

  const summaryCards = [
    { title: 'Linked Children', value: data.childrenCount.toString(), icon: Users, color: 'text-blue-600' },
    { title: 'Outstanding Balance', value: formatCurrency(data.outstandingBalance), icon: DollarSign, color: 'text-red-600' },
    { title: 'Total Invoices', value: data.invoiceCount.toString(), icon: FileText, color: 'text-gray-900 dark:text-white' },
    { title: 'Total Receipts', value: data.receiptCount.toString(), icon: Receipt, color: 'text-green-600' },
  ];

  const quickActions = [
    { name: 'Inbox', path: '/parent-portal/inbox', icon: Bell },
    { name: 'View My Children', path: '/parent-portal/children', icon: Users },
    { name: 'View Invoices', path: '/parent-portal/invoices', icon: FileText },
    { name: 'View Receipts', path: '/parent-portal/receipts', icon: Receipt },
    { name: 'Payment History', path: '/parent-portal/payment-history', icon: History },
    { name: 'Change Password', path: '/parent-portal/settings', icon: Lock },
  ];

  if (loading) {
    return (
      <ParentLayout profile={profile}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ParentLayout>
    );
  }

  const gradientStyle = data.isGradient 
    ? `linear-gradient(135deg, ${data.primaryColor}, ${data.secondaryColor})` 
    : data.primaryColor;

  return (
    <ParentLayout profile={profile}>
      <div 
        className="mb-8 p-6 rounded-[2.5rem] shadow-lg"
        style={{ background: gradientStyle }}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Welcome back, {profile.fullName}</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide mt-1">Here is a summary of your account activity at {data.schoolName}.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {summaryCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
              <div className={`p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 ${card.color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">{card.title}</h3>
                <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-10">
        <div className="lg:col-span-2">
          <h2 className="text-lg font-black text-gray-900 dark:text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Link
                  key={index}
                  to={action.path}
                  className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center gap-3 text-center hover:border-primary hover:shadow-lg hover:shadow-primary/10 transition-all group"
                >
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl group-hover:bg-primary group-hover:text-white transition-all">
                    <Icon className="h-6 w-6 text-gray-600 dark:text-gray-400 group-hover:text-white" />
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white text-sm">{action.name}</span>
                  <ArrowRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-primary transition-all" />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <h2 className="text-lg font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Recent Payments
          </h2>
          {data.recentPayments.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No recent payments.</p>
          ) : (
            <div className="space-y-4">
              {data.recentPayments.map((payment: any) => (
                <div key={payment.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(payment.amount)}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">{payment.studentName}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{new Date(payment.paymentDate).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${payment.status === 'Confirmed' || payment.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                    {payment.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ParentLayout>
  );
}
