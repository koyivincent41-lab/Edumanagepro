import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Clock,
  Calendar,
  Loader2,
  History,
  ArrowUpCircle,
  ArrowDownCircle,
  PlusCircle,
  X,
  Trash2,
  Mail,
  Download,
  RefreshCw
} from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, query, where, addDoc, getDocs, orderBy, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { School, Package, SubscriptionHistory, SubscriptionPayment } from '../../types';
import { toast } from 'sonner';
import { getExchangeRates } from '../../services/currencyService';

export default function Subscriptions() {
  const [schools, setSchools] = useState<School[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isPaymentManageModalOpen, setIsPaymentManageModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<SubscriptionPayment | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [history, setHistory] = useState<SubscriptionHistory[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [rates, setRates] = useState<any>(null);

  useEffect(() => {
    // Fetch system settings
    getDoc(doc(db, 'settings', 'system')).then(snap => {
      if (snap.exists()) setSystemSettings(snap.data());
    });

    // Fetch exchange rates
    getExchangeRates().then(setRates);

    const unsubscribeSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      const schoolData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School));
      setSchools(schoolData);
      setLoading(false);
    });

    const unsubscribePackages = onSnapshot(collection(db, 'packages'), (snapshot) => {
      const packageData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Package));
      setPackages(packageData);
    });

    const unsubscribePayments = onSnapshot(collection(db, 'payment_submissions'), (snapshot) => {
      const paymentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubscriptionPayment));
      setPayments(paymentData);
    });

    return () => {
      unsubscribeSchools();
      unsubscribePackages();
      unsubscribePayments();
    };
  }, []);

  const fetchHistory = async (schoolId: string) => {
    const q = query(
      collection(db, 'subscription_history'), 
      where('schoolId', '==', schoolId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubscriptionHistory)));
  };

  const handleSendEmail = async () => {
    if (!selectedSchool || !emailSubject || !emailMessage) return;

    setIsSendingEmail(true);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: selectedSchool.email,
          subject: emailSubject,
          text: emailMessage,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #800000;">Message from EduManagePro Support</h2>
              <p>Hello ${selectedSchool.ownerName},</p>
              <div style="margin: 20px 0; line-height: 1.6; color: #333;">
                ${emailMessage.replace(/\n/g, '<br/>')}
              </div>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 12px; color: #999;">This email was sent from the EduManagePro System Support.</p>
              <p style="font-size: 12px; color: #999;">Reply to: support@edumanagepro.com</p>
            </div>
          `,
        }),
      });

      if (!response.ok) throw new Error('Failed to send email');

      // Save to Outbox
      await addDoc(collection(db, 'system_emails'), {
        from: 'support@edumanagepro.com',
        to: selectedSchool.email,
        subject: emailSubject,
        message: emailMessage,
        type: 'outgoing',
        status: 'sent',
        read: true,
        createdAt: new Date().toISOString(),
        recipientName: selectedSchool.ownerName,
        schoolId: selectedSchool.id
      });

      toast.success('Email sent successfully');
      setIsEmailModalOpen(false);
      setEmailSubject('');
      setEmailMessage('');
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleAction = async (action: SubscriptionHistory['action'], data: any) => {
    if (!selectedSchool) return;

    try {
      const updateData: any = {};
      let notes = '';

      switch (action) {
        case 'assign':
        case 'upgrade':
        case 'downgrade':
          const pkg = packages.find(p => p.id === data.packageId);
          const pkgName = pkg?.name || data.packageId;
          updateData.packageId = data.packageId;
          updateData.subscriptionStatus = 'active';
          notes = `${action === 'assign' ? 'Assigned' : action === 'upgrade' ? 'Upgraded' : 'Downgraded'} to ${pkgName}`;
          break;
        case 'extend':
          const currentExpiry = new Date(selectedSchool.subscriptionExpiry || Date.now());
          const newExpiry = new Date(currentExpiry.getTime() + data.days * 24 * 60 * 60 * 1000);
          updateData.subscriptionExpiry = newExpiry.toISOString();
          notes = `Extended by ${data.days} days`;
          break;
        case 'suspend':
          updateData.subscriptionStatus = 'suspended';
          notes = 'Subscription suspended';
          break;
        case 'activate':
          updateData.subscriptionStatus = 'active';
          notes = 'Subscription activated';
          break;
        case 'expire':
          updateData.subscriptionStatus = 'expired';
          notes = 'Subscription marked as expired';
          break;
        case 'mark_paid':
          updateData.paymentStatus = 'paid';
          notes = 'Subscription marked as paid';
          break;
        case 'mark_unpaid':
          updateData.paymentStatus = 'unpaid';
          notes = 'Subscription marked as unpaid';
          break;
        case 'set_renewal':
          updateData.subscriptionExpiry = data.date;
          notes = `Renewal date set to ${new Date(data.date).toLocaleDateString()}`;
          break;
        case 'delete':
          updateData.packageId = '';
          updateData.subscriptionStatus = 'inactive';
          updateData.subscriptionExpiry = null;
          updateData.paymentStatus = 'unpaid';
          notes = 'Subscription deleted/reset';
          break;
      }

      await updateDoc(doc(db, 'schools', selectedSchool.id), updateData);
      
      await addDoc(collection(db, 'subscription_history'), {
        schoolId: selectedSchool.id,
        packageId: updateData.packageId || selectedSchool.packageId,
        action,
        previousPackageId: selectedSchool.packageId,
        notes,
        createdAt: new Date().toISOString(),
        performedBy: auth.currentUser?.email || 'Admin',
      });

      toast.success('Action completed successfully');
      setIsManageModalOpen(false);
    } catch (error) {
      toast.error('Failed to complete action');
    }
  };

  const filteredSchools = schools.filter(school => 
    (school.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    school.ownerName.toLowerCase().includes(searchTerm.toLowerCase())) &&
    school.subscriptionStatus !== 'inactive'
  );

  const handleDownload = () => {
    const csvContent = [
      ['School Name', 'Owner Name', 'Email', 'Package', 'Status', 'Expiry Date'],
      ...filteredSchools.map(school => [
        `"${school.name}"`,
        `"${school.ownerName}"`,
        `"${school.email}"`,
        `"${packages.find(p => p.id === school.packageId)?.name || school.packageId || 'N/A'}"`,
        `"${school.subscriptionStatus || 'N/A'}"`,
        `"${school.subscriptionStatus === 'trial' 
          ? (school.trialExpiry ? new Date(school.trialExpiry).toLocaleDateString() : 'N/A')
          : (school.subscriptionExpiry ? new Date(school.subscriptionExpiry).toLocaleDateString() : 'N/A')}"`
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `subscriptions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleMigration = async () => {
    if (!window.confirm('This will update all existing subscription history and notifications to show plan names instead of IDs. Continue?')) return;
    
    setIsMigrating(true);
    try {
      // 1. Update Subscription History
      const historySnap = await getDocs(collection(db, 'subscription_history'));
      const historyUpdates = historySnap.docs.map(async (historyDoc) => {
        const data = historyDoc.data();
        if (data.notes && data.notes.includes('to ') && !data.notes.includes('Plan')) {
          const parts = data.notes.split('to ');
          const pkgId = parts[1].trim();
          const pkg = packages.find(p => p.id === pkgId);
          if (pkg) {
            await updateDoc(doc(db, 'subscription_history', historyDoc.id), {
              notes: `${parts[0]}to ${pkg.name}`
            });
          }
        }
      });

      // 2. Update Notifications
      const notificationsSnap = await getDocs(collection(db, 'notifications'));
      const notificationUpdates = notificationsSnap.docs.map(async (notifDoc) => {
        const data = notifDoc.data();
        if (data.message && data.message.includes('Your ') && data.message.includes(' subscription')) {
          const parts = data.message.split('Your ');
          const subParts = parts[1].split(' subscription');
          const pkgId = subParts[0].trim();
          const pkg = packages.find(p => p.id === pkgId);
          if (pkg) {
            await updateDoc(doc(db, 'notifications', notifDoc.id), {
              message: `Your ${pkg.name} subscription${subParts[1]}`
            });
          }
        }
      });

      await Promise.all([...historyUpdates, ...notificationUpdates]);
      toast.success('Migration completed successfully!');
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('Failed to complete migration');
    } finally {
      setIsMigrating(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Subscription Management</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">Manage school subscription plans, extensions, and billing status.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                type="text"
                placeholder="Search schools..."
                className="pl-10 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder:text-white/40 focus:bg-white/20 outline-none w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={handleMigration}
              disabled={isMigrating}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl text-sm font-bold hover:bg-white/20 transition-all disabled:opacity-50"
              title="Update existing records to use plan names"
            >
              {isMigrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Update History Names
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-white text-primary rounded-xl text-sm font-bold hover:bg-white/90 transition-all"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Pending Payment Approvals</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">School</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Package</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.filter(p => p.paymentStatus === 'Pending Approval').map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-900">{payment.schoolName}</p>
                    <p className="text-xs text-gray-500">{payment.schoolEmail}</p>
                    {payment.phoneNumber && <p className="text-xs text-gray-500">{payment.phoneNumber}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-900">{payment.selectedPackageName}</p>
                    <p className="text-xs text-gray-500 capitalize">{payment.billingCycle}</p>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">KES {payment.payableAmountKES.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">{payment.mpesaConfirmationCode}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => {
                        setSelectedPayment(payment);
                        setIsPaymentManageModalOpen(true);
                      }}
                      className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">School</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Expiry Date</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSchools.map((school) => (
                <tr key={school.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-900">{school.name}</p>
                    <p className="text-xs text-gray-500">{school.ownerName}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-primary/5 text-primary rounded-full text-xs font-bold uppercase">
                      {packages.find(p => p.id === school.packageId)?.name || school.packageId || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      school.subscriptionStatus === 'active' ? 'bg-green-100 text-green-600' : 
                      school.subscriptionStatus === 'pending_approval' ? 'bg-blue-100 text-blue-600' :
                      school.subscriptionStatus === 'trial' ? 'bg-yellow-100 text-yellow-600' : 
                      'bg-red-100 text-red-600'
                    }`}>
                      {school.subscriptionStatus === 'pending_approval' ? 'Pending Approval' : school.subscriptionStatus || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {school.subscriptionStatus === 'trial' 
                        ? (school.trialExpiry ? new Date(school.trialExpiry).toLocaleDateString() : 'N/A')
                        : (school.subscriptionExpiry ? new Date(school.subscriptionExpiry).toLocaleDateString() : 'N/A')}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setSelectedSchool(school);
                          setIsManageModalOpen(true);
                        }}
                        className="p-2 text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        title="Manage Subscription"
                      >
                        <CreditCard className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedSchool(school);
                          fetchHistory(school.id);
                          setIsHistoryModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View History"
                      >
                        <History className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedSchool(school);
                          setIsEmailModalOpen(true);
                        }}
                        className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Send Email"
                      >
                        <Mail className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Manage Modal */}
      {isPaymentManageModalOpen && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Verify Payment</h2>
                <p className="text-gray-500 font-medium">{selectedPayment.schoolName}</p>
              </div>
              <button onClick={() => setIsPaymentManageModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="h-6 w-6 text-gray-400" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="p-4 bg-gray-50 rounded-2xl space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payment Details</p>
                <p className="text-sm text-gray-900">Package: {selectedPayment.selectedPackageName}</p>
                <p className="text-sm text-gray-900">Amount: KES {selectedPayment.payableAmountKES.toLocaleString()}</p>
                <p className="text-sm text-gray-900">Code: <span className="font-mono font-bold">{selectedPayment.mpesaConfirmationCode}</span></p>
              </div>

              <input 
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary"
                placeholder="Enter Verification Code"
              />

              <div className="flex flex-col gap-3">
                <button 
                  onClick={async () => {
                    const trimmedCode = verificationCode.trim().toUpperCase();
                    if (trimmedCode.length !== 10) {
                      toast.error("M-PESA confirmation code must be exactly 10 characters.");
                      return;
                    }
                    if (trimmedCode !== selectedPayment.mpesaConfirmationCode.toUpperCase()) {
                      toast.error("Transaction code does not match the one submitted by the school.");
                      return;
                    }
                    
                    try {
                      // Update payment submission
                      await updateDoc(doc(db, 'payment_submissions', selectedPayment.id), {
                        paymentStatus: 'Approved',
                        subscriptionStatus: 'Active',
                        adminVerificationCode: trimmedCode,
                        verifiedAt: new Date().toISOString(),
                        approvedBy: auth.currentUser?.email || 'Admin'
                      });
                      
                      // Update school subscription
                      const schoolRef = doc(db, 'schools', selectedPayment.schoolId);
                      const schoolSnap = await getDoc(schoolRef);
                      if (schoolSnap.exists()) {
                        const schoolData = schoolSnap.data() as School;
                        
                        let baseDate = Date.now();
                        // If they are already active, add to their current expiry (if it's in the future)
                        if (schoolData.subscriptionStatus === 'active' && schoolData.subscriptionExpiry) {
                          const currentExpiryTime = new Date(schoolData.subscriptionExpiry).getTime();
                          if (currentExpiryTime > baseDate) {
                            baseDate = currentExpiryTime;
                          }
                        }
                        
                        let daysToAdd = 30;
                        if (selectedPayment.billingCycle === 'yearly') daysToAdd = 365;
                        else if (selectedPayment.billingCycle === 'six-months') daysToAdd = 180;
                        
                        const newExpiry = new Date(baseDate + daysToAdd * 24 * 60 * 60 * 1000);
                        
                        await updateDoc(schoolRef, {
                          subscriptionStatus: 'active',
                          subscriptionExpiry: newExpiry.toISOString(),
                          packageId: selectedPayment.selectedPackageId,
                          billingCycle: selectedPayment.billingCycle
                        });

                        // Add history entry
                        await addDoc(collection(db, 'subscription_history'), {
                          schoolId: selectedPayment.schoolId,
                          packageId: selectedPayment.selectedPackageId,
                          action: 'activate',
                          notes: `Payment Approved - ${selectedPayment.selectedPackageName} (${selectedPayment.billingCycle})`,
                          createdAt: new Date().toISOString(),
                          performedBy: auth.currentUser?.email || 'Admin',
                        });

                        // Notify school
                        await addDoc(collection(db, 'notifications'), {
                          schoolId: selectedPayment.schoolId,
                          title: 'Payment Approved',
                          message: `Your payment for ${selectedPayment.selectedPackageName} plan has been verified. Your subscription is now active until ${newExpiry.toLocaleDateString()}.`,
                          type: 'payment_approved',
                          read: false,
                          createdAt: new Date().toISOString()
                        });
                      }

                      toast.success("Payment verified and subscription activated!");
                      setIsPaymentManageModalOpen(false);
                      setVerificationCode('');
                    } catch (error) {
                      console.error(error);
                      toast.error("Failed to verify payment");
                    }
                  }}
                  className="w-full py-4 bg-green-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-green-200 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve & Activate
                </button>

                <button 
                  onClick={async () => {
                    if (!window.confirm('Are you sure you want to reject this payment?')) return;
                    
                    try {
                      await updateDoc(doc(db, 'payment_submissions', selectedPayment.id), {
                        paymentStatus: 'Rejected',
                        subscriptionStatus: 'Rejected',
                        verifiedAt: new Date().toISOString(),
                        approvedBy: auth.currentUser?.email || 'Admin'
                      });

                      // Reset school status if it was pending
                      const schoolRef = doc(db, 'schools', selectedPayment.schoolId);
                      const schoolSnap = await getDoc(schoolRef);
                      if (schoolSnap.exists()) {
                        const schoolData = schoolSnap.data() as School;
                        if (schoolData.subscriptionStatus === 'pending_approval') {
                          // Try to determine previous status from history or default to trial/expired
                          await updateDoc(schoolRef, {
                            subscriptionStatus: 'expired' 
                          });
                        }

                        // Notify school
                        await addDoc(collection(db, 'notifications'), {
                          schoolId: selectedPayment.schoolId,
                          title: 'Payment Rejected',
                          message: `Payment could not be verified. Please confirm your transaction code (${selectedPayment.mpesaConfirmationCode}) and try again.`,
                          type: 'payment_declined',
                          read: false,
                          createdAt: new Date().toISOString()
                        });
                      }

                      toast.error("Payment submission rejected");
                      setIsPaymentManageModalOpen(false);
                    } catch (error) {
                      console.error(error);
                      toast.error("Failed to reject payment");
                    }
                  }}
                  className="w-full py-4 bg-red-50 text-red-600 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Reject Submission
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {isEmailModalOpen && selectedSchool && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Send Email</h2>
                <p className="text-gray-500 font-medium">To: {selectedSchool.ownerName} ({selectedSchool.email})</p>
              </div>
              <button onClick={() => setIsEmailModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="h-6 w-6 text-gray-400" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Subject</label>
                <input 
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary"
                  placeholder="Enter email subject..."
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Message</label>
                <textarea 
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary h-48 resize-none"
                  placeholder="Type your message here..."
                />
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsEmailModalOpen(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSendEmail}
                  disabled={isSendingEmail || !emailSubject || !emailMessage}
                  className="flex-1 py-4 bg-school-gradient text-white font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSendingEmail ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
                  Send Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Subscription Modal */}
      {isManageModalOpen && selectedSchool && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Manage Subscription</h2>
                <p className="text-gray-500 font-medium">{selectedSchool.name}</p>
              </div>
              <button onClick={() => setIsManageModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="h-6 w-6 text-gray-400" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Current Plan</p>
                  <p className="text-lg font-bold text-primary">
                    {packages.find(p => p.id === selectedSchool.packageId)?.name || selectedSchool.packageId || 'N/A'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Status</p>
                  <p className="text-lg font-bold text-gray-900 uppercase">{selectedSchool.subscriptionStatus}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900">Change Package</h4>
                <div className="flex gap-2">
                    <select 
                      className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary"
                      onChange={(e) => {
                        const pkg = packages.find(p => p.id === e.target.value);
                        if (pkg) handleAction('upgrade', { packageId: pkg.id });
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Select Package</option>
                      {packages.map(pkg => {
                        const targetCurrency = systemSettings?.currency || 'UGX';
                        const sourceCurrency = 'UGX'; // Assuming base package prices are in UGX
                        let convertedPrice = pkg.monthlyPrice;
                        
                        if (rates && targetCurrency !== sourceCurrency) {
                          const sourceRate = rates[sourceCurrency] || 1;
                          const targetRate = rates[targetCurrency] || 1;
                          convertedPrice = (pkg.monthlyPrice / sourceRate) * targetRate;
                        }

                        return (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.name} - {targetCurrency} {convertedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                          </option>
                        );
                      })}
                    </select>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900">Quick Actions</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleAction('extend', { days: 30 })}
                    className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all text-xs font-bold"
                  >
                    <PlusCircle className="h-4 w-4" /> Extend 30 Days
                  </button>
                  <button 
                    onClick={() => handleAction('extend', { days: 364 })}
                    className="flex items-center gap-2 p-3 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all text-xs font-bold"
                  >
                    <PlusCircle className="h-4 w-4" /> Extend 1 Year
                  </button>
                  {selectedSchool.subscriptionStatus !== 'active' && (
                    <button 
                      onClick={() => handleAction('activate', {})}
                      className="flex items-center gap-2 p-3 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-all text-xs font-bold"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Activate
                    </button>
                  )}
                  {selectedSchool.subscriptionStatus === 'active' && (
                    <button 
                      onClick={() => handleAction('suspend', {})}
                      className="flex items-center gap-2 p-3 rounded-xl bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition-all text-xs font-bold"
                    >
                      <AlertCircle className="h-4 w-4" /> Suspend
                    </button>
                  )}
                  <button 
                    onClick={() => handleAction('expire', {})}
                    className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-all text-xs font-bold"
                  >
                    <XCircle className="h-4 w-4" /> Mark Expired
                  </button>
                  <button 
                    onClick={() => handleAction('mark_paid', {})}
                    className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all text-xs font-bold"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Mark Paid
                  </button>
                  <button 
                    onClick={() => handleAction('mark_unpaid', {})}
                    className="flex items-center gap-2 p-3 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 transition-all text-xs font-bold"
                  >
                    <AlertCircle className="h-4 w-4" /> Mark Unpaid
                  </button>
                  <button 
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="flex items-center gap-2 p-3 rounded-xl bg-red-100 text-red-700 hover:bg-red-200 transition-all text-xs font-bold col-span-2"
                  >
                    <Trash2 className="h-4 w-4" /> Delete Subscription
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900">Set Renewal Date</h4>
                <div className="flex gap-2">
                  <input 
                    type="date"
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary"
                    onChange={(e) => handleAction('set_renewal', { date: new Date(e.target.value).toISOString() })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && selectedSchool && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Subscription History</h2>
                <p className="text-gray-500 font-medium">{selectedSchool.name}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="h-6 w-6 text-gray-400" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto max-h-[60vh]">
              <div className="space-y-6">
                {history.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No history records found</p>
                  </div>
                ) : (
                  history.map((record) => (
                    <div key={record.id} className="flex gap-4">
                      <div className="mt-1">
                        <div className={`p-2 rounded-lg ${
                          record.action === 'upgrade' ? 'bg-green-50 text-green-600' :
                          record.action === 'downgrade' ? 'bg-orange-50 text-orange-600' :
                          record.action === 'extend' ? 'bg-blue-50 text-blue-600' :
                          record.action === 'delete' ? 'bg-red-50 text-red-600' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          {record.action === 'upgrade' ? <ArrowUpCircle className="h-4 w-4" /> :
                           record.action === 'downgrade' ? <ArrowDownCircle className="h-4 w-4" /> :
                           record.action === 'extend' ? <PlusCircle className="h-4 w-4" /> :
                           record.action === 'delete' ? <Trash2 className="h-4 w-4" /> :
                           <Clock className="h-4 w-4" />}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-bold text-gray-900 capitalize">{record.action}</p>
                          <p className="text-xs text-gray-400">{new Date(record.createdAt).toLocaleString()}</p>
                        </div>
                        <p className="text-sm text-gray-600">{record.notes}</p>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">By: {record.performedBy}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && selectedSchool && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Subscription?</h3>
              <p className="text-gray-500 mb-8">
                Are you sure you want to delete the subscription for <span className="font-bold text-gray-900">{selectedSchool.name}</span>? 
                This will reset the school to inactive status.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleAction('delete', {});
                    setIsDeleteConfirmOpen(false);
                  }}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:scale-105 transition-all"
                >
                  Delete Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
