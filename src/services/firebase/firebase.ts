import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported, Analytics } from "firebase/analytics";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  Auth,
} from "firebase/auth";

// Firebase configuration for talkingplant-app (the project owning talkingplant.web.app)
const firebaseConfig = {
  apiKey: "AIzaSyDOB5qLNwk-58nJW_PE5gXXAJrZjxdPPzA",
  authDomain: "talkingplant-app.firebaseapp.com",
  projectId: "talkingplant-app",
  storageBucket: "talkingplant-app.firebasestorage.app",
  messagingSenderId: "622733280855",
  appId: "1:622733280855:web:52411e9331da2106480512",
  measurementId: "G-83WMQXK71M"
};

// Initialize Firebase App singleton safely
export const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

let analyticsInstance: Analytics | null = null;
export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  if (!analyticsInstance && (await isAnalyticsSupported())) {
    analyticsInstance = getAnalytics(app);
  }
  return analyticsInstance;
}

// Sign in with Google using popup
export async function signInWithGoogle(): Promise<{ user: User | null; error?: string }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user };
  } catch (error: any) {
    console.warn("[Firebase Auth] Google Sign-In notice:", error?.message || error);
    return {
      user: null,
      error: error?.message || "Google authentication could not be completed.",
    };
  }
}

// Sign out
export async function signOutUser(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    console.error("[Firebase Auth] Sign out error:", err);
  }
}

import { useState, useEffect } from "react";

export interface AuthSession {
  user: User | null;
  authLoading: boolean;
  isAuthenticated: boolean;
}

export function useFirebaseAuthSession(): AuthSession {
  const [session, setSession] = useState<AuthSession>({
    user: auth.currentUser,
    authLoading: true,
    isAuthenticated: !!auth.currentUser,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setSession({
        user,
        authLoading: false,
        isAuthenticated: !!user,
      });
    });

    return () => unsubscribe();
  }, []);

  return session;
}

export { onAuthStateChanged };
export type { User };
