import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@rocicorp/zero/react';

import type { SavedWord } from '@/components/feed-video';
import { INITIAL_VOCABULARY, type VocabWord } from '@/lib/feed/app-data';
import { INITIAL_USER_STATE, type FeedUserState } from '@/lib/feed/sample-videos';
import { useAuth } from '@/lib/auth/auth-context';
import { ZERO_ENABLED, useZeroApp } from '@/lib/zero/provider';
import { useCurrentUserQuery, useVocabularyQuery } from '@/lib/zero/queries';

type GameContextValue = {
  state: FeedUserState;
  savedWords: VocabWord[];
  /** Equipped mascot cosmetic id, or null for none. */
  cosmetic: string | null;
  /** Add XP (and gems); `combo` carries the current answer streak. */
  earn: (amount: number, combo: number) => void;
  /** Save a word/phrase to the vocabulary (deduped by `en`). */
  saveWord: (word: SavedWord) => void;
  /** Bump a word's spaced-repetition mastery (capped at 3). */
  masterWord: (en: string) => void;
  setCosmetic: (id: string | null) => void;
};

const GameContext = createContext<GameContextValue | null>(null);

/** Swallow optimistic-mutator promises (server is authoritative; see mutators.ts). */
function fire(result: { client: Promise<unknown>; server: Promise<unknown> }) {
  result.client.catch(() => {});
  result.server.catch(() => {});
}

/**
 * App-wide gamification state (XP / streak / gems / combo, saved vocabulary,
 * equipped mascot cosmetic). Lives above the tab navigator so every screen
 * shares one source of truth.
 *
 * Local state is the optimistic layer (instant UI, works fully offline). When a
 * zero-cache backend is configured (ZERO_ENABLED), each action ALSO dispatches
 * the matching Zero custom mutator so the write persists and syncs; the server
 * recomputes the authoritative values (docs/BACKEND_PLAN.md). Until then the
 * dispatches are skipped, so behaviour is identical to a pure local prototype.
 */
export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const z = useZeroApp();
  const [state, setState] = useState<FeedUserState>({ ...INITIAL_USER_STATE });
  const [savedWords, setSavedWords] = useState<VocabWord[]>(INITIAL_VOCABULARY);
  const [cosmetic, setCosmeticState] = useState<string | null>('cap');

  // Read-hydration from Zero (cj6.7 user counters/cosmetic, cj6.10 vocabulary).
  // Reads sync reactively from the local replica; until a backend is configured
  // the replica is empty, so we keep INITIAL_* as the fallback. The local state
  // above is the optimistic layer that mutators write through — we only sync FROM
  // Zero, never the other way (the mutators already persist writes).
  const userID = user?.userID ?? '';
  const [me] = useQuery(useCurrentUserQuery(userID));
  const [vocabRows] = useQuery(useVocabularyQuery(userID));

  // cj6.7: mirror the persisted user row into the optimistic counters + cosmetic
  // whenever it changes. `combo` has no column, so it's client-only and left as-is.
  useEffect(() => {
    if (!me) return;
    // Sync FROM the Zero replica (an external system) into the optimistic layer;
    // the mutators own the write path, so this never loops. See use-color-scheme.web.ts
    // for the same intentional external-sync escape hatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({
      ...s,
      xp: me.xp ?? s.xp,
      xpToday: me.xpToday ?? s.xpToday,
      streak: me.streak ?? s.streak,
      gems: me.gems ?? s.gems,
    }));
    setCosmeticState(me.mascotCosmetic || null);
  }, [me]);

  // cj6.10: mirror the persisted vocabulary (newest first) into local state when
  // the replica has rows; otherwise keep INITIAL_VOCABULARY as the fallback.
  useEffect(() => {
    if (vocabRows.length === 0) return;
    // One-way sync from the Zero replica into the optimistic vocabulary list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedWords(
      vocabRows.map((w) => ({
        en: w.en,
        ru: w.ru,
        type: w.type,
        source: w.source,
        example: w.example,
        mastery: w.mastery ?? 0,
      })),
    );
  }, [vocabRows]);

  const earn = useCallback(
    (amount: number, combo: number) => {
      const next = {
        xp: state.xp + amount,
        xpToday: state.xpToday + amount,
        gems: state.gems + Math.round(amount / 2),
      };
      setState((s) => ({ ...s, ...next, combo }));
      if (ZERO_ENABLED && user?.userID) {
        // `amount` lets the server recompute authoritatively; `next` is the
        // client's optimistic total (see mutators.ts earnXp).
        fire(z.mutate.earnXp({ userID: user.userID, amount, ...next, streak: state.streak }));
      }
    },
    [z, user, state],
  );

  const saveWord = useCallback(
    (word: SavedWord) => {
      setSavedWords((prev) =>
        prev.some((w) => w.en === word.en) ? prev : [{ ...word, mastery: 0, isNew: true }, ...prev],
      );
      if (ZERO_ENABLED && user?.userID) {
        fire(
          z.mutate.saveWord({
            userID: user.userID,
            en: word.en,
            ru: word.ru,
            type: word.type,
            source: word.source,
            example: word.example,
          }),
        );
      }
    },
    [z, user],
  );

  const masterWord = useCallback(
    (en: string) => {
      const current = savedWords.find((w) => w.en === en);
      const mastery = Math.min(3, (current?.mastery ?? 0) + 1);
      setSavedWords((prev) => prev.map((w) => (w.en === en ? { ...w, mastery } : w)));
      if (ZERO_ENABLED && user?.userID) {
        fire(z.mutate.reviewWord({ userID: user.userID, en, mastery }));
      }
    },
    [z, user, savedWords],
  );

  const setCosmetic = useCallback(
    (id: string | null) => {
      setCosmeticState(id);
      if (ZERO_ENABLED && user?.userID) {
        fire(z.mutate.equipCosmetic({ userID: user.userID, cosmeticId: id ?? '' }));
      }
    },
    [z, user],
  );

  const value = useMemo(
    () => ({ state, savedWords, cosmetic, earn, saveWord, masterWord, setCosmetic }),
    [state, savedWords, cosmetic, earn, saveWord, masterWord, setCosmetic],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}
