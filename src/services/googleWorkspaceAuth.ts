import { getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { COMBINED_WORKSPACE_SCOPES } from './gmailLogic';

/**
 * Shared Firebase Auth instance for Google Workspace OAuth (Gmail + Google Chat).
 * Reuses any existing Firebase app instance and caches the OAuth access token strictly in memory.
 */
const firebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

const workspaceProvider = new GoogleAuthProvider();
for (const scope of COMBINED_WORKSPACE_SCOPES) {
  workspaceProvider.addScope(scope);
}
workspaceProvider.setCustomParameters({
  prompt: 'consent'
});

let isSigningIn = false;
// Access token is strictly cached in memory only (never stored in localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

type WorkspaceAuthListener = (state: {
  user: User | null;
  accessToken: string | null;
  needsAuth: boolean;
}) => void;

const listeners = new Set<WorkspaceAuthListener>();
let authListenerInitialized = false;

function notifyWorkspaceListeners(user: User | null) {
  const hasToken = Boolean(user && cachedAccessToken);
  const payload = {
    user,
    accessToken: hasToken ? cachedAccessToken : null,
    needsAuth: !hasToken
  };
  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      // Ignore individual listener errors
    }
  });
}

function ensureGlobalAuthObserver() {
  if (authListenerInitialized) return;
  authListenerInitialized = true;

  onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        notifyWorkspaceListeners(user);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        notifyWorkspaceListeners(user);
      }
    } else {
      cachedAccessToken = null;
      notifyWorkspaceListeners(null);
    }
  });
}

export function subscribeWorkspaceAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthRequired?: (user: User | null) => void
): () => void {
  ensureGlobalAuthObserver();

  const wrapper: WorkspaceAuthListener = ({ user, accessToken, needsAuth }) => {
    if (!needsAuth && user && accessToken) {
      onAuthSuccess?.(user, accessToken);
    } else {
      onAuthRequired?.(user);
    }
  };

  listeners.add(wrapper);

  // Emit current snapshot immediately
  const currentUser = auth.currentUser;
  if (currentUser && cachedAccessToken) {
    onAuthSuccess?.(currentUser, cachedAccessToken);
  } else if (!isSigningIn) {
    onAuthRequired?.(currentUser);
  }

  return () => {
    listeners.delete(wrapper);
  };
}

export async function signInWithGoogleWorkspace(): Promise<{ user: User; accessToken: string }> {
  ensureGlobalAuthObserver();
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, workspaceProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve Google Workspace OAuth access token from Google Sign-In.');
    }
    cachedAccessToken = credential.accessToken;
    notifyWorkspaceListeners(result.user);
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export function getWorkspaceAccessToken(): string | null {
  return cachedAccessToken;
}

export function getWorkspaceCurrentUser(): User | null {
  return auth.currentUser;
}

export async function getWorkspaceIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export function invalidateWorkspaceAccessToken(): void {
  cachedAccessToken = null;
  notifyWorkspaceListeners(auth.currentUser);
}

export async function signOutGoogleWorkspace(): Promise<void> {
  cachedAccessToken = null;
  await auth.signOut();
  notifyWorkspaceListeners(null);
}
