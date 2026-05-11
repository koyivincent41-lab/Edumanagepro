import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDoc,
  addDoc,
  orderBy 
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { School } from '../../types';
import { toast } from 'sonner';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  CreditCard, 
  School as SchoolIcon, 
  Calendar,
  ExternalLink,
  Search,
  Filter,
  Loader2,
  Check,
  X as XIcon
} from 'lucide-react';

interface PaymentSubmission {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolEmail: string;
  phoneNumber: string;
  selectedPackageId: string;
  selectedPackageName: string;
  billingCycle: string;
  payableAmountKES: number;
  mpesaConfirmationCode: string;
  paymentStatus: 'Pending Approval' | 'Approved' | 'Rejected';
  submittedAt: string;
  notes?: string;
}

export default function PaymentsInbox() {
  const [payments, setPayments] = useState<PaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('Pending Approval');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'payment_submissions'),
      orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const paymentData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PaymentSubmission));
      setPayments(paymentData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (payment: PaymentSubmission) => {
    if (!window.confirm('Are you sure you want to approve this payment? This will active the school\'s subscription.')) return;
    
    setVerifyingId(payment.id);
    try {
      // 1. Update payment submission
      await updateDoc(doc(db, 'payment_submissions', payment.id), {
        paymentStatus: 'Approved',
        verifiedAt: new Date().toISOString(),
        verifiedBy: auth.currentUser?.email || 'Admin'
      });

      // 2. Update school subscription
      const schoolRef = doc(db, 'schools', payment.schoolId);
      const schoolSnap = await getDoc(schoolRef);
      
      if (schoolSnap.exists()) {
        const schoolData = schoolSnap.data() as School;
        
        let baseDate = Date.now();
        // If current subscription is active and not expired, extend from expiry
        if (schoolData.subscriptionStatus === 'active' && schoolData.subscriptionExpiry) {
          const expiry = new Date(schoolData.subscriptionExpiry).getTime();
          if (expiry > baseDate) {
            baseDate = expiry;
          }
        }

        const daysToAdd = payment.billingCycle === 'yearly' ? 365 : 
                         payment.billingCycle === 'six-months' ? 180 : 30;
        const newExpiry = new Date(baseDate + daysToAdd * 24 * 60 * 60 * 1000);

        await updateDoc(schoolRef, {
          subscriptionStatus: 'active',
          subscriptionExpiry: newExpiry.toISOString(),
          packageId: payment.selectedPackageId,
          billingCycle: payment.billingCycle,
          totalPaid: (schoolData.totalPaid || 0) + payment.payableAmountKES,
          updatedAt: new Date().toISOString()
        });

        // 3. Add to subscription history
        await addDoc(collection(db, 'subscription_history'), {
          schoolId: payment.schoolId,
          packageId: payment.selectedPackageId,
          action: 'activate',
          notes: `Payment Approved: ${payment.mpesaConfirmationCode} (${payment.billingCycle})`,
          createdAt: new Date().toISOString(),
          performedBy: auth.currentUser?.email || 'Admin'
        });

        // 4. Notify School
        await addDoc(collection(db, 'notifications'), {
          schoolId: payment.schoolId,
          title: 'Subscription Activated',
          message: `Your payment was verified. Your ${payment.selectedPackageName} plan is now active until ${newExpiry.toLocaleDateString()}.`,
          type: 'payment_approved',
          read: false,
          createdAt: new Date().toISOString()
        });

        toast.success(`Payment from ${payment.schoolName} approved and plan activated!`);
      }
    } catch (error) {
      console.error('Error approving payment:', error);
      toast.error('Failed to approve payment');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleReject = async (payment: PaymentSubmission) => {
    const reason = window.prompt('Please enter a reason for rejection (optional):');
    if (reason === null) return;

    setVerifyingId(payment.id);
    try {
      await updateDoc(doc(db, 'payment_submissions', payment.id), {
        paymentStatus: 'Rejected',
        rejectionReason: reason,
        verifiedAt: new Date().toISOString(),
        verifiedBy: auth.currentUser?.email || 'Admin'
      });

      // Notify school
      await addDoc(collection(db, 'notifications'), {
        schoolId: payment.schoolId,
        title: 'Payment Rejected',
        message: `Your payment verification failed. Reason: ${reason || 'Incorrect transaction code'}. Please confirm your transaction code and resubmit.`,
        type: 'payment_rejected',
        read: false,
        createdAt: new Date().toISOString()
      });

      toast.error(`Payment from ${payment.schoolName} rejected`);
    } catch (error) {
      console.error('Error rejecting payment:', error);
      toast.error('Failed to reject payment');
    } finally {
      setVerifyingId(null);
    }
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.schoolName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.mpesaConfirmationCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || p.paymentStatus === filterStatus;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-4 md:p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white">Payments Inbox</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Review and verify manual M-Pesa payment submissions</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search school name or transaction code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl outline-none focus:border-primary shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 bg-white border border-gray-100 rounded-2xl outline-none focus:border-primary shadow-sm font-bold text-sm min-w-[180px]"
          >
            <option value="all">All Submissions</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[700px] w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-4 md:px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">School / Date</th>
                <th className="px-4 md:px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Plan Details</th>
                <th className="px-4 md:px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Transaction Info</th>
                <th className="px-4 md:px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-4 md:px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredPayments.length > 0 ? (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center text-primary">
                          <SchoolIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors">{payment.schoolName}</p>
                          <p className="text-[10px] text-gray-400 flex items-center gap-1 font-medium mt-0.5">
                            <Calendar className="h-3 w-3" />
                            {new Date(payment.submittedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{payment.selectedPackageName}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded inline-block mt-1">
                          {payment.billingCycle}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-maroon font-mono bg-maroon/5 px-2 py-1 rounded tracking-[0.1em]">
                            {payment.mpesaConfirmationCode}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          KES {payment.payableAmountKES.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-400">{payment.phoneNumber}</p>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-fit ${
                        payment.paymentStatus === 'Approved' ? 'bg-green-100 text-green-600' :
                        payment.paymentStatus === 'Rejected' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {payment.paymentStatus === 'Pending Approval' ? <Clock className="h-3 w-3" /> : 
                         payment.paymentStatus === 'Approved' ? <CheckCircle2 className="h-3 w-3" /> : 
                         <XCircle className="h-3 w-3" />}
                        {payment.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-right">
                      {payment.paymentStatus === 'Pending Approval' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleReject(payment)}
                            disabled={!!verifyingId}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Reject Payment"
                          >
                            <XIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleApprove(payment)}
                            disabled={!!verifyingId}
                            className="p-2 bg-green-600 text-white rounded-xl shadow-lg shadow-green-200 hover:scale-105 transition-all"
                            title="Approve & Activate"
                          >
                            {verifyingId === payment.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400">Processed</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 md:px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <CreditCard className="h-12 w-12 opacity-20" />
                      <p className="font-bold">No payments found in this category.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
