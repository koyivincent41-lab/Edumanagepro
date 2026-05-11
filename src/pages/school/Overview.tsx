import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  GraduationCap, 
  FileText, 
  DollarSign, 
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { School, Student, Parent, Invoice, Payment } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrorHandler';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

export default function SchoolOverview({ school }: { school: School | null }) {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalParents: 0,
    totalReceivable: 0,
    amountCollected: 0,
    overdueAmount: 0,
    arrearsCarriedForward: 0,
    expectedCollection: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    if (!school?.id) return;

    const unsubStudents = onSnapshot(
      collection(db, 'schools', school.id, 'students'), 
      (snap) => {
        const studentDocs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        setStudents(studentDocs);
        setStats(prev => ({ ...prev, totalStudents: snap.docs.length }));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `schools/${school.id}/students`)
    );

    const unsubParents = onSnapshot(
      collection(db, 'schools', school.id, 'parents'), 
      (snap) => {
        setStats(prev => ({ ...prev, totalParents: snap.docs.length }));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `schools/${school.id}/parents`)
    );

    const unsubAllInvoices = onSnapshot(
      collection(db, 'schools', school.id, 'invoices'),
      (snap) => {
        const invs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
        setAllInvoices(invs);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `schools/${school.id}/invoices`)
    );

    const unsubPayments = onSnapshot(
      query(
        collection(db, 'schools', school.id, 'payments'),
        where('academicYear', '==', school.academicYear)
      ),
      (snap) => {
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `schools/${school.id}/payments`)
    );

    return () => {
      unsubStudents();
      unsubParents();
      unsubAllInvoices();
      unsubPayments();
    };
  }, [school?.id, school?.academicYear, school?.currentTerm]);

  useEffect(() => {
    if (!school) return;

    // Filter for current term and year for the main stats
    const currentTermInvs = allInvoices.filter(inv => 
      inv.academicYear === school.academicYear && 
      inv.term === school.currentTerm
    );
    setInvoices(currentTermInvs);
    
    // Current term pending balance
    const currentTermPending = currentTermInvs.reduce((sum, inv) => sum + inv.balanceDue, 0);
    
    // Calculate Arrears Carried Forward
    // Logic: Sum of balances from previous years OR previous terms of current year
    const termOrder: Record<string, number> = { 'Term 1': 1, 'Term 2': 2, 'Term 3': 3 };
    const currentTermOrder = termOrder[school.currentTerm || 'Term 1'] || 1;
    const currentYear = parseInt(school.academicYear || '0');

    const invoiceArrears = allInvoices.reduce((sum, inv) => {
      const invYear = parseInt(inv.academicYear || '0');
      const invTermOrder = termOrder[inv.term || 'Term 1'] || 1;

      const isPreviousYear = invYear < currentYear;
      const isPreviousTermSameYear = invYear === currentYear && invTermOrder < currentTermOrder;

      if (isPreviousYear || isPreviousTermSameYear) {
        return sum + inv.balanceDue;
      }
      return sum;
    }, 0);

    const studentArrears = students.reduce((sum, s) => sum + (s.arrears || 0), 0);
    const arrearsCarriedForward = invoiceArrears + studentArrears;

    // Amount Collected: Only payments made in the current term and year that are 'paid'
    const currentTermCollected = payments
      .filter(p => p.academicYear === school.academicYear && p.term === school.currentTerm && p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);
    
    setStats(prev => ({ 
      ...prev, 
      totalReceivable: currentTermPending,
      amountCollected: currentTermCollected,
      arrearsCarriedForward: arrearsCarriedForward,
      expectedCollection: currentTermPending + arrearsCarriedForward,
    }));

    setRecentInvoices(currentTermInvs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5));
  }, [allInvoices, students, payments, school?.academicYear, school?.currentTerm]);

  const chartData = React.useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const last6Months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last6Months.push({
        name: months[d.getMonth()],
        month: d.getMonth(),
        year: d.getFullYear(),
        collected: 0,
        invoiced: 0,
        arrears: stats.arrearsCarriedForward
      });
    }

    invoices.forEach(inv => {
      const date = new Date(inv.createdAt);
      const monthData = last6Months.find(m => m.month === date.getMonth() && m.year === date.getFullYear());
      if (monthData) {
        monthData.invoiced += inv.totalAmount;
      }
    });

    payments.forEach(pay => {
      if (pay.status !== 'paid') return;
      const date = new Date(pay.paymentDate);
      const monthData = last6Months.find(m => m.month === date.getMonth() && m.year === date.getFullYear());
      if (monthData) {
        monthData.collected += pay.amount;
      }
    });

    return last6Months;
  }, [invoices, payments, stats.arrearsCarriedForward]);

  const cards = [
    { name: 'Total Students', value: stats.totalStudents, icon: GraduationCap, color: 'bg-blue-500' },
    { name: 'Total Receivable', value: `${school?.currency || 'KES'} ${stats.totalReceivable.toLocaleString()}`, icon: FileText, color: 'bg-primary' },
    { name: 'Amount Collected', value: `${school?.currency || 'KES'} ${stats.amountCollected.toLocaleString()}`, icon: DollarSign, color: 'bg-green-500' },
    { name: 'Arrears Carried Forward', value: `${school?.currency || 'KES'} ${stats.arrearsCarriedForward.toLocaleString()}`, icon: Clock, color: 'bg-orange-500' },
    { name: 'Expected Collection', value: `${school?.currency || 'KES'} ${stats.expectedCollection.toLocaleString()}`, icon: BarChart3, color: 'bg-indigo-500' },
  ];

  const isTrial = school?.subscriptionStatus === 'trial';
  const isPendingApproval = school?.subscriptionStatus === 'pending_approval';
  const trialExpiry = school?.trialExpiry ? new Date(school.trialExpiry) : null;
  const subscriptionExpiry = school?.subscriptionExpiry ? new Date(school.subscriptionExpiry) : null;
  const isExpired = (isTrial && trialExpiry && new Date() > trialExpiry) || 
                    (!isTrial && !isPendingApproval && subscriptionExpiry && new Date() > subscriptionExpiry) ||
                    (school?.subscriptionStatus === 'expired');

  const calculateDaysLeft = (expiryDate: Date | null) => {
    if (!expiryDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = isTrial ? calculateDaysLeft(trialExpiry) : calculateDaysLeft(subscriptionExpiry);

  return (
    <div className="space-y-4 lg:space-y-8">
      {/* Subscription Banner */}
      {(isTrial || isExpired || isPendingApproval || school?.subscriptionStatus === 'active') && (
        <div className={`p-4 lg:p-6 rounded-2xl lg:rounded-[2.5rem] border flex flex-col md:flex-row items-center justify-between gap-4 lg:gap-6 shadow-sm ${
          isExpired ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30' : 
          isPendingApproval ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30' :
          'bg-primary/5 dark:bg-primary/10 border-primary/10 dark:border-primary/20'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${
              isExpired ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' : 
              isPendingApproval ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' :
              'bg-primary/10 dark:bg-primary/20 text-primary'
            }`}>
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h3 className={`font-bold ${
                isExpired ? 'text-red-900 dark:text-red-100' : 
                isPendingApproval ? 'text-blue-900 dark:text-blue-100' :
                'text-gray-900 dark:text-white'
              }`}>
                {isExpired ? 'Subscription Expired' : 
                 isPendingApproval ? 'Payment Pending Approval' :
                 isTrial ? 'Free Trial Active' : 'Subscription Active'}
              </h3>
              <p className={`text-sm ${
                isExpired ? 'text-red-700 dark:text-red-300' : 
                isPendingApproval ? 'text-blue-700 dark:text-blue-300' :
                'text-gray-500 dark:text-gray-400'
              }`}>
                {isExpired 
                  ? 'Your access has been restricted. Please renew your subscription to continue.' 
                  : isPendingApproval
                  ? 'Your payment is currently being verified by the administrator. Full access will be restored shortly.'
                  : `You have ${daysLeft} days remaining ${isTrial ? 'in your free trial' : 'before your next billing date'}.`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-school-gradient p-4 lg:p-4 md:p-6 rounded-2xl lg:rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-xl lg:text-xl md:text-2xl font-black text-white">Welcome back, {school?.name}</h1>
            <p className="text-xs lg:text-sm text-white/80 font-medium tracking-wide">Here's what's happening with your school today.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 lg:gap-3">
            <span className="px-3 py-1.5 lg:px-4 lg:py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-[10px] lg:text-sm font-black text-white uppercase tracking-widest">
              {school?.academicYear} Academic Year
            </span>
            {school?.currentTerm && (
              <span className="px-3 py-1.5 lg:px-4 lg:py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-[10px] lg:text-sm font-black text-white uppercase tracking-widest">
                {school.currentTerm}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4 md:gap-6">
        {cards.map((card) => (
          <div key={card.name} className="bg-white dark:bg-gray-900 p-4 lg:p-4 md:p-6 rounded-2xl lg:rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-2 lg:mb-4">
              <div className={`p-2 lg:p-3 ${card.color === 'bg-primary' ? 'bg-school-gradient' : card.color} rounded-xl lg:rounded-2xl`}>
                <card.icon className="h-4 w-4 lg:h-6 lg:w-6 text-white" />
              </div>
              <TrendingUp className="h-3 w-3 lg:h-5 lg:w-5 text-green-500" />
            </div>
            <p className="text-[10px] lg:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{card.name}</p>
            <p className="text-sm lg:text-xl md:text-2xl font-extrabold text-gray-900 dark:text-white truncate">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-4 md:gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl lg:rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="bg-school-gradient px-4 lg:px-4 md:px-8 py-3 lg:py-4">
            <h3 className="font-black text-white uppercase tracking-[0.2em] text-[10px] lg:text-xs">Financial Performance</h3>
          </div>
          <div className="p-4 lg:p-4 md:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-4 lg:mb-8">
              <div className="flex flex-wrap gap-2 lg:gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary rounded-full"></div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Invoiced</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Collected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Arrears</span>
                </div>
              </div>
            </div>
            <div className="h-60 lg:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorInvoiced" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={school?.primaryColor || "#800000"} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={school?.secondaryColor || school?.primaryColor || "#800000"} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorArrears" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" className="dark:opacity-10" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 500, fill: '#9ca3af'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 500, fill: '#9ca3af'}} />
                <Tooltip 
                  contentStyle={{
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-foreground)'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="invoiced" 
                  stroke={school?.primaryColor || "#800000"} 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorInvoiced)" 
                />
                <Area type="monotone" dataKey="collected" stroke="#22c55e" strokeWidth={3} fill="transparent" />
                <Area 
                  type="monotone" 
                  dataKey="arrears" 
                  stroke="#f97316" 
                  strokeWidth={3} 
                  fillOpacity={1}
                  fill="url(#colorArrears)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl lg:rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="bg-school-gradient px-4 lg:px-4 md:px-8 py-3 lg:py-4">
            <h3 className="font-black text-white uppercase tracking-[0.2em] text-[10px] lg:text-xs">Recent Invoices</h3>
          </div>
          <div className="p-4 lg:p-4 md:p-8">
            <div className="space-y-4 lg:space-y-6">
            {recentInvoices.map((inv) => (
              <div key={inv.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{inv.invoiceNumber}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(inv.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-gray-900 dark:text-white">{school?.currency} {inv.totalAmount.toLocaleString()}</p>
                  <span className={`text-[10px] font-bold uppercase ${
                    inv.status === 'paid' ? 'text-green-500' : 'text-yellow-500'
                  }`}>
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
            {recentInvoices.length === 0 && (
              <div className="text-center py-10">
                <p className="text-sm text-gray-400 dark:text-gray-500">No recent invoices found.</p>
              </div>
            )}
          </div>
          <button className="w-full mt-8 py-3 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-bold rounded-xl hover:bg-school-gradient hover:text-white transition-all">
            View All Invoices
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
