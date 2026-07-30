import { doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export async function bootstrapSystem() {
  try {
    // 1. Create default packages
    const packages = [
      {
        id: 'silver',
        name: 'Silver',
        monthlyPrice: 1000,
        yearlyPrice: 700,
        studentLimit: 100,
        features: ['Fee Invoicing', 'Parent Portal', 'Basic Reports', 'Email Support'],
      },
      {
        id: 'gold',
        name: 'Gold',
        monthlyPrice: 2000,
        yearlyPrice: 600,
        studentLimit: 400,
        features: ['Everything in Silver', 'Advanced Reports', 'Expense Tracking', 'Priority Support'],
      },
      {
        id: 'diamond',
        name: 'Diamond',
        monthlyPrice: 3000,
        yearlyPrice: 1000,
        studentLimit: 999999,
        features: ['Everything in Gold', 'Custom Branding', 'Bulk SMS Integration', '24/7 Dedicated Support'],
      },
    ];

    for (const pkg of packages) {
      await setDoc(doc(db, 'packages', pkg.id), pkg);
    }

    console.log('System bootstrapped successfully!');
  } catch (error) {
    console.error('Bootstrap error:', error);
  }
}
