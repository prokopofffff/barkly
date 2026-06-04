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
 * Wiring: when EXPO_PUBLIC_API_URL is set we hit the TypeScript/Hono backend,
 * which owns identity + issues the JWT that Zero uses as `auth` (BACKEND_PLAN §6):
 *   POST /auth/anonymous            -> { userID, token, refreshToken }
 *   POST /auth/link/email           -> { userID, token, ... }   (same userID)
 *   POST /auth/link/apple|google    -> { userID, token, ... }
 * With no API URL (early dev), we fall back to a purely local anonymous session
 * so the app still runs offline; Zero then runs local-only.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const STORE_KEY = 'barkly.auth.v1';

export type AuthUser = {
  userID: string;
  token: string | null; // JWT passed to Zero as `auth`
  refreshToken?: string;
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

/** Backend session payload (mirrors the server's auth Session). */
type Session = {
  userID: string;
  token: string;
  refreshToken?: string;
  isAnonymous: boolean;
  email?: string;
};

async function api<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`auth ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

// Lightweight random id used only for the offline (no-backend) fallback.
function randomId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

function sessionToUser(s: Session): AuthUser {
  return {
    userID: s.userID,
    token: s.token,
    refreshToken: s.refreshToken,
    isAnonymous: s.isAnonymous,
    email: s.email,
  };
}

async function persist(user: AuthUser): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(user));
}

/** A fresh anonymous session — from the backend if configured, else local. */
async function freshAnonymous(): Promise<AuthUser> {
  if (API_URL) {
    try {
      return sessionToUser(await api<Session>('/auth/anonymous', {}));
    } catch {
      // Backend unreachable — degrade to a local session so the app still opens.
    }
  }
  return { userID: randomId('anon'), token: null, isAnonymous: true };
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
        const anon = await freshAnonymous();
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
    async (email: string, password: string) => {
      if (!user) return;
      let linked: AuthUser;
      if (API_URL) {
        // Same userID kept server-side; backend rotates the JWT. Throws on a
        // bad password / taken email so the UI can surface the error.
        linked = sessionToUser(
          await api<Session>('/auth/link/email', { email, password }, user.token),
        );
      } else {
        linked = { ...user, isAnonymous: false, email };
      }
      await persist(linked);
      setUser(linked);
    },
    [user],
  );

  // Apple/Google need a verified native id-token (expo-apple-authentication /
  // expo-auth-session) before we can call /auth/link/* — that lands in a
  // follow-up (bk-jaz.4). Until then both just flip the local session, so they
  // share one implementation.
  const linkOAuth = useCallback(async () => {
    if (!user) return;
    const linked: AuthUser = { ...user, isAnonymous: false };
    await persist(linked);
    setUser(linked);
  }, [user]);
  const linkWithApple = linkOAuth;
  const linkWithGoogle = linkOAuth;

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(STORE_KEY);
    // Drop straight back to a fresh anonymous session — never a dead-end login wall.
    const anon = await freshAnonymous();
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
