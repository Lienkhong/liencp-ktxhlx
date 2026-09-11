import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
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
import { compressImageBase64 } from '../utils/helpers';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with ignoreUndefinedProperties
export const db: Firestore = (() => {
  const dbId = (firebaseConfig as any).firestoreDatabaseId;
  try {
    return initializeFirestore(
      app,
      {
        ignoreUndefinedProperties: true,
      },
      dbId || undefined
    );
  } catch {
    return dbId ? getFirestore(app, dbId) : getFirestore(app);
  }
})();

/**
 * Hàm loại bỏ triệt để các giá trị undefined trước khi ghi lên Firestore
 */
export function cleanFirestoreDoc<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return '' as any;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanFirestoreDoc(item)) as any;
  }
  if (typeof obj === 'object') {
    const res: any = {};
    for (const [key, value] of Object.entries(obj as any)) {
      if (value !== undefined) {
        res[key] = cleanFirestoreDoc(value);
      }
    }
    return res;
  }
  return obj;
}

export const FIRESTORE_CONSOLE_URL = `https://console.firebase.google.com/project/${(firebaseConfig as any).projectId}/firestore/databases/${(firebaseConfig as any).firestoreDatabaseId}/data?openUpgradeDialog=true`;

export interface FirestoreTestResult {
  connected: boolean;
  isQuotaExceeded: boolean;
  errorMessage?: string;
}

// Test connection to Firestore
export async function testFirestoreConnection(): Promise<FirestoreTestResult> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { connected: true, isQuotaExceeded: false };
  } catch (error: any) {
    const msg = error?.message || String(error);
    const code = error?.code || '';
    const isQuota =
      msg.includes('Quota limit exceeded') ||
      msg.includes('Quota exceeded') ||
      msg.includes('resource-exhausted') ||
      code === 'resource-exhausted';
    console.log('Firestore connection check:', { isQuota, code, message: msg });
    return {
      connected: false,
      isQuotaExceeded: isQuota,
      errorMessage: msg,
    };
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

    // Nén ảnh bảo đảm kích thước an toàn < 200KB cho Cloud Firestore
    let compressedFront = frontImage || '';
    let compressedBack = backImage || '';

    if (compressedFront && compressedFront.startsWith('data:image')) {
      compressedFront = await compressImageBase64(compressedFront, 1200, 0.75);
    }
    if (compressedBack && compressedBack.startsWith('data:image')) {
      compressedBack = await compressImageBase64(compressedBack, 1200, 0.75);
    }

    const docData: SecureWorkerDocument = {
      workerId,
      frontImage: compressedFront,
      backImage: compressedBack,
      storagePath: `worker_documents/${workerId}/`,
      updatedAt: nowIso,
      updatedBy: operatorName,
    };
    await setDoc(doc(db, 'worker_documents', workerId), cleanFirestoreDoc(docData));
    return true;
  } catch (err) {
    console.warn('Error saving secure worker document:', err);
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
