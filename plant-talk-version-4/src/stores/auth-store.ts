import { create } from 'zustand';
import { 
  User, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  AuthError
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../services/firebase';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  error: string | null;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
  initializeAuth: () => () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticating: false,
  error: null,
  isAuthenticated: false,

  clearError: () => set({ error: null }),

  initializeAuth: () => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        });
      },
      (error) => {
        console.error('Firebase Auth state error:', error);
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: error.message,
        });
      }
    );

    return unsubscribe;
  },

  signInWithGoogle: async () => {
    set({ isAuthenticating: true, error: null });
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      set({
        user: result.user,
        isAuthenticated: true,
        isAuthenticating: false,
        error: null,
      });
      return true;
    } catch (err: unknown) {
      const authError = err as AuthError;
      console.warn('Google sign-in error:', authError);

      let friendlyMessage = 'Failed to sign in with Google. Please try again.';

      if (authError.code === 'auth/popup-closed-by-user') {
        friendlyMessage = 'Sign-in cancelled. Please click sign-in again when ready.';
      } else if (authError.code === 'auth/popup-blocked') {
        friendlyMessage = 'Popup was blocked by your browser. Please allow popups for this site and try again.';
      } else if (authError.code === 'auth/cancelled-popup-request') {
        friendlyMessage = 'Sign-in popup was cancelled.';
      } else if (authError.code === 'auth/network-request-failed') {
        friendlyMessage = 'Network connection issue. Please check your internet connection.';
      } else if (authError.message) {
        friendlyMessage = authError.message;
      }

      set({
        isAuthenticating: false,
        error: friendlyMessage,
      });
      return false;
    }
  },

  signOut: async () => {
    try {
      await firebaseSignOut(auth);
      set({
        user: null,
        isAuthenticated: false,
        error: null,
      });
    } catch (err: unknown) {
      const authError = err as AuthError;
      set({ error: authError.message || 'Error signing out' });
    }
  },
}));
