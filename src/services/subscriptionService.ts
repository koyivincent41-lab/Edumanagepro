import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  setDoc, 
  updateDoc, 
  increment,
  limit,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { School, Package } from '../types';
import { getExchangeRates } from './currencyService';

export interface SystemNotification {
  id: string;
  type: 'invoice' | 'receipt' | 'alert';
  title: string;
  message: string;
  amount: number;
  date: string;
  status: 'unread' | 'read';
  content: {
    number: string;
    items: { description: string; amount: number }[];
    subtotal: number;
    total: number;
    currency: string;
    dueDate?: string;
    paymentDate?: string;
  };
}

export const subscriptionService = {
  async generateNotification(schoolId: string, data: Partial<SystemNotification>) {
    const inboxRef = collection(db, 'schools', schoolId, 'inbox');
    const newDocRef = doc(inboxRef);
    
    const notification: SystemNotification = {
      id: newDocRef.id,
      type: data.type || 'alert',
      title: data.title || 'System Notification',
      message: data.message || '',
      amount: data.amount || 0,
      date: new Date().toISOString(),
      status: 'unread',
      content: data.content as any,
    };

    await setDoc(newDocRef, notification);
    return notification;
  },

  async getSystemSettings() {
    const snap = await getDoc(doc(db, 'settings', 'system'));
    return snap.exists() ? snap.data() : null;
  },

  async checkAndGenerateInitialReceipt(school: School) {
    // Check if initial receipt already exists
    const q = query(
      collection(db, 'schools', school.id, 'inbox'), 
      where('type', '==', 'receipt'),
      where('title', '==', 'Trial Activation Receipt'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return;

    const settings = await this.getSystemSettings();
    const receiptNumber = `${settings?.receiptPrefix || 'REC-'}${settings?.nextReceiptNumber || 1000}`;

    await this.generateNotification(school.id, {
      type: 'receipt',
      title: 'Trial Activation Receipt',
      message: 'Welcome to EduManagePro! Your 7-day free trial has been activated.',
      amount: 0,
      content: {
        number: receiptNumber,
        items: [{ description: '7-Day Free Trial Activation', amount: 0 }],
        subtotal: 0,
        total: 0,
        currency: school.currency || 'UGX',
        paymentDate: new Date().toISOString()
      }
    });

    // Increment receipt number in settings
    await updateDoc(doc(db, 'settings', 'system'), {
      nextReceiptNumber: increment(1)
    });
  },

  async checkAndGenerateAutomatedInvoice(school: School) {
    if (!school.subscriptionExpiry) return;

    const expiryDate = new Date(school.subscriptionExpiry);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Generate invoice if within 3 days of expiry
    if (diffDays <= 3 && diffDays >= -2) {
      // Check if an invoice for this expiry date already exists
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const q = query(
        collection(db, 'schools', school.id, 'inbox'),
        where('type', '==', 'invoice'),
        where('date', '>=', sevenDaysAgo.toISOString()), // within last 7 days
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) return;

      const settings = await this.getSystemSettings();
      const invoiceNumber = `${settings?.invoicePrefix || 'INV-'}${settings?.nextInvoiceNumber || 1000}`;

      // Get package price
      const pkgSnap = await getDoc(doc(db, 'packages', school.packageId));
      const pkg = pkgSnap.exists() ? pkgSnap.data() as Package : null;
      
      if (!pkg) return;

      const rates = await getExchangeRates();
      const currency = school.currency || 'UGX';
      const rate = rates[currency] || 1;

      let amount = pkg.monthlyPrice;
      if (school.billingCycle === 'yearly') amount = (pkg.monthlyPrice * 12) * 0.7;
      else if (school.billingCycle === 'six-months') amount = pkg.monthlyPrice * 6;

      const convertedAmount = amount * rate;

      await this.generateNotification(school.id, {
        type: 'invoice',
        title: 'Subscription Renewal Invoice',
        message: `Your ${pkg.name} subscription is set to expire in ${diffDays} days. Please pay your subscription early to avoid interruption.`,
        amount: convertedAmount,
        content: {
          number: invoiceNumber,
          items: [{ description: `${pkg.name} Plan - ${school.billingCycle} Subscription`, amount: convertedAmount }],
          subtotal: convertedAmount,
          total: convertedAmount,
          currency: currency,
          dueDate: expiryDate.toISOString()
        }
      });

      // Increment invoice number
      try {
        await updateDoc(doc(db, 'settings', 'system'), {
          nextInvoiceNumber: increment(1)
        });
      } catch (error) {
        console.warn('Could not increment invoice number. Settings document might not exist or permissions are insufficient.', error);
      }
    }
  },

  async generatePaymentReceipt(school: School, paymentData: { amount: number, method: string, period: string, transactionCode?: string }) {
    const settings = await this.getSystemSettings();
    const receiptNumber = `${settings?.receiptPrefix || 'REC-'}${settings?.nextReceiptNumber || 1000}`;

    const pkgSnap = await getDoc(doc(db, 'packages', school.packageId));
    const pkgName = pkgSnap.exists() ? pkgSnap.data().name : school.packageId;

    await this.generateNotification(school.id, {
      type: 'receipt',
      title: 'Subscription Payment Receipt',
      message: `Thank you for your payment. Your ${pkgName} subscription has been updated.`,
      amount: paymentData.amount,
      content: {
        number: receiptNumber,
        items: [{ description: `Subscription Payment - ${paymentData.period}`, amount: paymentData.amount }],
        subtotal: paymentData.amount,
        total: paymentData.amount,
        currency: school.currency || 'UGX',
        paymentDate: new Date().toISOString(),
        paymentMethod: paymentData.method,
        transactionCode: paymentData.transactionCode
      }
    });

    // Increment receipt number
    try {
      await updateDoc(doc(db, 'settings', 'system'), {
        nextReceiptNumber: increment(1)
      });
    } catch (error) {
      console.warn('Could not increment receipt number. Settings document might not exist or permissions are insufficient.', error);
    }
  }
};
