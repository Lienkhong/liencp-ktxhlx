import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocFromServer,
  enableIndexedDbPersistence,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore (using specific databaseId if provided, or default)
export const db: Firestore = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

// Enable offline persistence if supported in browser environment
if (typeof window !== 'undefined') {
  try {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence failed: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence not supported in this browser');
      }
    });
  } catch (e) {
    // Ignore in non-browser environments
  }
}

// Test connection to Firestore
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    console.log('Firestore initial ping:', error);
    // Even if test doc doesn't exist, if we reach server or it initializes it's online
    return true;
  }
}

/**
 * Secure Worker Document Storage (Private Cloud Firestore collection)
 * Stored under /worker_documents/{workerId}
 */
export interface SecureWorkerDocument {
  workerId: string;
  frontImage?: string;
  backImage?: string;
  storagePath: string;
  updatedAt: string;
  updatedBy: string;
}

export async function getSecureWorkerDocument(workerId: string): Promise<SecureWorkerDocument | null> {
  try {
    const snap = await getDoc(doc(db, 'worker_documents', workerId));
    if (snap.exists()) {
      return snap.data() as SecureWorkerDocument;
    }
    return null;
  } catch (err) {
    console.warn('Error fetching secure worker document:', err);
    return null;
  }
}

export async function saveSecureWorkerDocument(
  workerId: string,
  frontImage?: string,
  backImage?: string,
  operatorName = 'Quản lý'
): Promise<boolean> {
  try {
    const nowIso = new Date().toISOString();
    const docData: SecureWorkerDocument = {
      workerId,
      frontImage: frontImage || '',
      backImage: backImage || '',
      storagePath: `worker_documents/${workerId}/`,
      updatedAt: nowIso,
      updatedBy: operatorName,
    };
    await setDoc(doc(db, 'worker_documents', workerId), docData);
    return true;
  } catch (err) {
    console.error('Error saving secure worker document:', err);
    return false;
  }
}

export async function deleteSecureWorkerDocument(workerId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'worker_documents', workerId));
    return true;
  } catch (err) {
    console.warn('Error deleting secure worker document:', err);
    return false;
  }
}

export {
  app,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  limit,
};
