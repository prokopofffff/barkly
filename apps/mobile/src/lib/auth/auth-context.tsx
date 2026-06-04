import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Anonymous-first auth, Duolingo style ("deferred registration").
 *
 * On first launch we mint an ANONYMOUS user so the person can start watching
 * and earning progress immediately — no signup wall. Later they "link" a real
 * identity (Apple / Google / email) and the SAME `userID` is upgraded in place,
 * so all their Zero-synced progress carries over.
 *
 * The network calls here are stubbed. In production each method should hit the
 * TypeScript/Hono backend, which owns identity + issues the JWT that Zero uses
 * as `auth` (see docs/BACKEND_PLAN.md):
 *   POST /auth/anonymous            -> { userID, token }
 *   POST /auth/link/email           -> { userID, token }   (same userID)
 *   POST /auth/link/apple|google    -> { userID, token }
 */

// Backend base URL for the real implementation: process.env.EXPO_PUBLIC_API_URL
const STORE_KEY = 'barkly.auth.v1';

export type AuthUser = {
  userID: string;
  token: string | null; // JWT passed to Zero as `auth`
  isAnonymous: boolean;
  email?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean; // false until we've loaded/created the session
  linkWithEmail: (email: string, password: string) => Promise<void>;
  linkWithApple: () => Promise<void>;
  linkWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Lightweight random id; the real anonymous id comes from the backend.
function randomId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

async function persist(user: AuthUser): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(user));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  // Load an existing session or create an anonymous one on first launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORE_KEY);
        if (raw) {
          if (!cancelled) setUser(JSON.parse(raw) as AuthUser);
          return;
        }
        // TODO: const { userID, token } = await fetch(`${API_URL}/auth/anonymous`, {method:'POST'}).then(r=>r.json());
        const anon: AuthUser = {
          userID: randomId('anon'),
          token: null, // dev: no backend yet → Zero runs local-only
          isAnonymous: true,
        };
        await persist(anon);
        if (!cancelled) setUser(anon);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const linkWithEmail = useCallback(
    async (email: string, _password: string) => {
      if (!user) return;
      // TODO: POST `${API_URL}/auth/link/email` with current token; backend keeps the same userID.
      const linked: AuthUser = { ...user, isAnonymous: false, email };
      await persist(linked);
      setUser(linked);
    },
    [user],
  );

  const linkWithApple = useCallback(async () => {
    if (!user) return;
    // TODO: use expo-apple-authentication, send identityToken to `${API_URL}/auth/link/apple`.
    const linked: AuthUser = { ...user, isAnonymous: false };
    await persist(linked);
    setUser(linked);
  }, [user]);

  const linkWithGoogle = useCallback(async () => {
    if (!user) return;
    // TODO: use expo-auth-session/Google, send idToken to `${API_URL}/auth/link/google`.
    const linked: AuthUser = { ...user, isAnonymous: false };
    await persist(linked);
    setUser(linked);
  }, [user]);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(STORE_KEY);
    // Drop straight back to a fresh anonymous session — never a dead-end login wall.
    const anon: AuthUser = { userID: randomId('anon'), token: null, isAnonymous: true };
    await persist(anon);
    setUser(anon);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, ready, linkWithEmail, linkWithApple, linkWithGoogle, signOut }),
    [user, ready, linkWithEmail, linkWithApple, linkWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
