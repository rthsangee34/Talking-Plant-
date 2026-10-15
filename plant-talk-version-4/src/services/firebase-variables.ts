/**
 * Firebase Variables & Configuration Sync Service
 * Persists detected Gemini model version, available models, and user preferences into Firebase Firestore.
 */

import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { app } from './firebase';

export interface FirebaseAiVariables {
  geminiVersion: string;
  availableModels: string[];
  userId?: string;
  userEmail?: string;
  apiKeyConfigured: boolean;
}

/** Max time to wait for Firestore to acknowledge a write before giving up. */
const FIRESTORE_WRITE_TIMEOUT_MS = 5000;

/**
 * Firestore's `setDoc` only resolves once the backend acknowledges the write.
 * If the Firestore API is disabled, the database does not exist, or the network
 * is blocked, the SDK silently retries forever and the promise NEVER settles.
 * This helper guarantees the caller always gets control back.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms (Firestore unreachable or not enabled)`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function setFirebaseVariables(variables: FirebaseAiVariables): Promise<{ success: boolean; message?: string }> {
  const timestamp = new Date().toISOString();

  // 1. Always persist locally
  try {
    localStorage.setItem('planttalk_gemini_version', variables.geminiVersion);
    localStorage.setItem('planttalk_available_models', JSON.stringify(variables.availableModels));
    localStorage.setItem('planttalk_config_updated_at', timestamp);
  } catch (err) {
    console.warn('LocalStorage save warning:', err);
  }

  // 2. Persist to Firebase Firestore
  try {
    const db = getFirestore(app);
    const docId = variables.userId || 'anonymous_user';

    const payload = {
      geminiVersion: variables.geminiVersion,
      availableModels: variables.availableModels,
      userId: variables.userId || null,
      userEmail: variables.userEmail || null,
      apiKeyConfigured: variables.apiKeyConfigured,
      updatedAt: timestamp,
      clientPlatform: typeof navigator !== 'undefined' ? navigator.userAgent : 'web',
    };

    // Store in user_ai_configs collection
    const userDocRef = doc(db, 'user_ai_configs', docId);
    // Store in global active configuration document
    const globalDocRef = doc(db, 'system_configs', 'current_ai_model');

    await withTimeout(
      Promise.all([
        setDoc(userDocRef, payload, { merge: true }),
        setDoc(globalDocRef, {
          activeGeminiVersion: variables.geminiVersion,
          lastUpdated: timestamp,
          updatedBy: variables.userEmail || docId,
        }, { merge: true }),
      ]),
      FIRESTORE_WRITE_TIMEOUT_MS,
      'Firestore write'
    );

    console.log('✓ Firebase variables updated successfully:', payload);
    return { success: true };
  } catch (firebaseErr: unknown) {
    console.warn('Firebase Firestore write note (continuing with local cache):', firebaseErr);
    // Graceful fallback: local cache is already set
    return {
      success: false,
      message: 'Saved locally (Firebase offline / permissions mode)',
    };
  }
}
