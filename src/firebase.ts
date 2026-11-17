import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  type User 
} from 'firebase/auth';
import { 
  getFirestore,
  setLogLevel,
  doc, 
  getDoc,
  getDocFromServer,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  setDoc,
  addDoc,
  deleteDoc,
  type Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Suppress noisy WebChannel transport reconnect messages
try {
  setLogLevel('silent');
} catch (_) {}

// Initialize Firestore using dedicated database ID when configured, else (default)
const configuredDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
export const db = configuredDatabaseId ? getFirestore(app, configuredDatabaseId) : getFirestore(app);

// Validate Connection to Firestore as specified in firebase-integration-rpc
export async function testFirestoreConnection() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }
  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 3000));
    await Promise.race([getDocFromServer(doc(db, 'test', 'connection')), timeoutPromise]);
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client is offline or reconnecting.");
    }
  }
}
testFirestoreConnection().catch(() => {});

/**
 * Measure live round-trip latency to Cloud Firestore in milliseconds
 */
export async function measureFirestoreLatency(): Promise<{ connected: boolean; latencyMs: number; error?: string }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { connected: false, latencyMs: 0, error: 'Device Offline' };
  }
  
  const start = performance.now();
  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 3000));
    await Promise.race([getDocFromServer(doc(db, 'test', 'connection')), timeoutPromise]);
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    return { connected: true, latencyMs };
  } catch (error: any) {
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    return { connected: false, latencyMs, error: error?.message || 'Connecting' };
  }
}

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
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
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  type User,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  setDoc,
  addDoc,
  deleteDoc,
  doc
};
