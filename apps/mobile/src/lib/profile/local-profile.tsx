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
 * Device-local app profile — the bits of "where is this person in the journey"
 * that gate the UI but don't (yet) live in a synced Zero row.
 *
 * Why local and not Zero? Two reasons hold today:
 *  1. Zero runs local-only until a backend is configured, and screens fall back
 *     to placeholder data — so we can't reliably read `app_user.onboarded` back
 *     to decide whether to show the onboarding wall.
 *  2. The onboarding answers (CEFR level / goals / daily target) have no columns
 *     on `app_user` yet (adding them needs a Postgres migration — see
 *     docs/BACKEND_PLAN.md §6). Until then they're kept here.
 *
 * When the backend lands, `onboarded` should come from the synced user row and
 * this store becomes a cache; the answers move into new user columns.
 *
 * Persisted with expo-secure-store (same store family as auth-context) so it
 * survives relaunches. NOTE: this is intentionally NOT reset on signOut — a
 * person who has seen onboarding shouldn't be walled again just because they
 * dropped back to a fresh anonymous session.
 */

const STORE_KEY = 'barkly.profile.v1';

/** Completed-quiz count that trips the "save your progress" link nudge. */
export const LINK_PROMPT_QUIZ_THRESHOLD = 5;

export type OnboardingPrefs = {
  level: string; // CEFR self-rating: A1 / A2 / B1 / B2
  goals: string[]; // why they're learning (travel, work, …)
  target: number; // daily-minutes goal
};

type LocalProfile = {
  onboarded: boolean;
  prefs: OnboardingPrefs | null;
  quizzesCompleted: number;
  linkPromptDismissed: boolean;
};

const EMPTY: LocalProfile = {
  onboarded: false,
  prefs: null,
  quizzesCompleted: 0,
  linkPromptDismissed: false,
};

type LocalProfileValue = LocalProfile & {
  ready: boolean; // false until we've loaded the persisted profile
  completeOnboarding: (prefs: OnboardingPrefs) => void;
  recordQuizCompleted: () => void;
  dismissLinkPrompt: () => void;
};

const LocalProfileContext = createContext<LocalProfileValue | null>(null);

export function LocalProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<LocalProfile>(EMPTY);
  const [ready, setReady] = useState(false);

  // Load the persisted profile on first mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORE_KEY);
        if (raw && !cancelled) setProfile({ ...EMPTY, ...(JSON.parse(raw) as Partial<LocalProfile>) });
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist any change once we're past the initial load (best-effort).
  useEffect(() => {
    if (!ready) return;
    SecureStore.setItemAsync(STORE_KEY, JSON.stringify(profile)).catch(() => {});
  }, [profile, ready]);

  const completeOnboarding = useCallback((prefs: OnboardingPrefs) => {
    setProfile((p) => ({ ...p, onboarded: true, prefs }));
  }, []);

  const recordQuizCompleted = useCallback(() => {
    setProfile((p) => ({ ...p, quizzesCompleted: p.quizzesCompleted + 1 }));
  }, []);

  const dismissLinkPrompt = useCallback(() => {
    setProfile((p) => ({ ...p, linkPromptDismissed: true }));
  }, []);

  const value = useMemo<LocalProfileValue>(
    () => ({ ...profile, ready, completeOnboarding, recordQuizCompleted, dismissLinkPrompt }),
    [profile, ready, completeOnboarding, recordQuizCompleted, dismissLinkPrompt],
  );

  return <LocalProfileContext.Provider value={value}>{children}</LocalProfileContext.Provider>;
}

export function useLocalProfile(): LocalProfileValue {
  const ctx = useContext(LocalProfileContext);
  if (!ctx) throw new Error('useLocalProfile must be used within <LocalProfileProvider>');
  return ctx;
}
