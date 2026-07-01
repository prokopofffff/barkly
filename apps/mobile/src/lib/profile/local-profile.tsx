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
 * Why local at all? Zero runs local-only until a backend is configured, so the
 * replica is often EMPTY and screens fall back to placeholder data — we can't
 * treat the synced Zero row as the source of truth for "is this person past the
 * onboarding wall". So this device-local store stays the offline SOURCE OF TRUTH
 * for the gate.
 *
 * The `app_user` columns (onboarded, learningLevel, goals, dailyTarget) DO now
 * exist on the user table. When Zero has a real replica, <ProfileSync/> (mounted
 * inside AppZeroProvider) reconciles the synced user row back into this cache via
 * `hydrateFromSync`. That reconciliation is strictly NON-REGRESSING: it never
 * flips `onboarded` back to false and never lowers `quizzesCompleted`, so an
 * empty replica can never wall an already-onboarded user.
 *
 * `prefs` (the onboarding answers) and `linkPromptDismissed` remain device-local
 * by design — prefs sync outward in onboarding.tsx; reading them back is deferred.
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
  level: string; // self-assessment key (only_starting…fluent) -> starting ELO
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
  /**
   * Reconcile the device-local gate from the synced Zero user row. STRICTLY
   * NON-REGRESSING so an empty replica can never wall an onboarded user:
   *  - `onboarded` only ever moves false -> true (union; we never set it false).
   *  - `quizzesCompleted` only ever rises (max; we never lower it).
   * A no-op when nothing changes, to avoid render loops / needless writes.
   */
  hydrateFromSync: (patch: { onboarded?: boolean; quizzesCompleted?: number }) => void;
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

  const hydrateFromSync = useCallback((patch: { onboarded?: boolean; quizzesCompleted?: number }) => {
    setProfile((p) => {
      // Union onboarded (never false), raise quizzesCompleted (never lower).
      const nextOnboarded = p.onboarded || patch.onboarded === true;
      const nextQuizzes =
        patch.quizzesCompleted != null ? Math.max(p.quizzesCompleted, patch.quizzesCompleted) : p.quizzesCompleted;
      // Bail if nothing changed — avoids render loops and needless SecureStore writes.
      if (nextOnboarded === p.onboarded && nextQuizzes === p.quizzesCompleted) return p;
      return { ...p, onboarded: nextOnboarded, quizzesCompleted: nextQuizzes };
    });
  }, []);

  const value = useMemo<LocalProfileValue>(
    () => ({
      ...profile,
      ready,
      completeOnboarding,
      recordQuizCompleted,
      dismissLinkPrompt,
      hydrateFromSync,
    }),
    [profile, ready, completeOnboarding, recordQuizCompleted, dismissLinkPrompt, hydrateFromSync],
  );

  return <LocalProfileContext.Provider value={value}>{children}</LocalProfileContext.Provider>;
}

export function useLocalProfile(): LocalProfileValue {
  const ctx = useContext(LocalProfileContext);
  if (!ctx) throw new Error('useLocalProfile must be used within <LocalProfileProvider>');
  return ctx;
}
