// Firebase configuration and initialization
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyDOB5qLNwk-58nJW_PE5gXXAJrZjxdPPzA",
  authDomain: "talkingplant-app.firebaseapp.com",
  projectId: "talkingplant-app",
  storageBucket: "talkingplant-app.firebasestorage.app",
  messagingSenderId: "622733280855",
  appId: "1:622733280855:web:52411e9331da2106480512"
};

// Initialize Firebase
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({
  prompt: 'select_account'
});
