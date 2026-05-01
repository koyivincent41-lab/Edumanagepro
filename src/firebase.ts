import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Log config for diagnostics (Project ID is safe to show)
const ACTIVE_PROJECT_ID = firebaseConfig.projectId;
console.log("-----------------------------------------");
console.log("FIREBASE DIAGNOSTIC INFO:");
console.log("Project ID:", ACTIVE_PROJECT_ID);
console.log("Auth Domain:", firebaseConfig.authDomain);
console.log("If you see 'auth/operation-not-allowed', enable Email/Password at:");
console.log(`https://console.firebase.google.com/project/${ACTIVE_PROJECT_ID}/authentication/providers`);
console.log("-----------------------------------------");

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

async function testConnection() {
  try {
    // Attempt local read first to check if unreachable
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection check successful.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firebase Alert: The client is offline or the database is unreachable. Check your network or Firebase configuration.");
    } else {
      // Ignore if it's just a permission error (no 'test' collection)
      if (!(error instanceof Error && error.message.includes('permission-denied'))) {
        console.warn("Firestore diagnostic check (non-critical):", error);
      }
    }
  }
}

testConnection();
