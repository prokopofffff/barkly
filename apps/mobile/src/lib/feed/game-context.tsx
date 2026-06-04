import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { SavedWord } from '@/components/feed-video';
import { INITIAL_VOCABULARY, type VocabWord } from '@/lib/feed/app-data';
import { INITIAL_USER_STATE, type FeedUserState } from '@/lib/feed/sample-videos';
import { useAuth } from '@/lib/auth/auth-context';
import { ZERO_ENABLED, useZeroApp } from '@/lib/zero/provider';

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

  const earn = useCallback(
    (amount: number, combo: number) => {
      const next = {
        xp: state.xp + amount,
        xpToday: state.xpToday + amount,
        gems: state.gems + Math.round(amount / 2),
      };
      setState((s) => ({ ...s, ...next, combo }));
      if (ZERO_ENABLED && user?.userID) {
        fire(z.mutate.earnXp({ userID: user.userID, ...next, streak: state.streak }));
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
