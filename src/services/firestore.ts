import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { School, UserProfile, Package } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Registration logic with transaction
export async function registerSchool(data: {
  schoolName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  currency: string;
  academicYear: string;
  packageId: string;
}) {
  try {
    const schoolId = doc(collection(db, 'schools')).id;
    const userId = doc(collection(db, 'users')).id; // This is a placeholder until actual auth user is created

    await runTransaction(db, async (transaction) => {
      // Check for existing school with same email
      const schoolQuery = query(collection(db, 'schools'), where('email', '==', data.email));
      const schoolSnap = await getDocs(schoolQuery);
      if (!schoolSnap.empty) {
        throw new Error('A school with this email already exists.');
      }

      const schoolRef = doc(db, 'schools', schoolId);
      const schoolData: School = {
        id: schoolId,
        name: data.schoolName,
        ownerName: data.ownerName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        country: data.country,
        currency: data.currency,
        academicYear: data.academicYear,
        packageId: data.packageId,
        status: 'pending',
        subscriptionStatus: 'trial',
        subscriptionExpiry: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days trial
        studentCount: 0,
        userCount: 0,
        createdAt: new Date().toISOString(),
      };
      transaction.set(schoolRef, schoolData);

      // We don't create the user yet because we need Firebase Auth UID
      // Instead, we'll store a pending registration record or handle it after auth
    });

    return { schoolId };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'schools');
  }
}
