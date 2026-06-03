import { ZeroProvider } from '@rocicorp/zero/react';
import { expoSQLiteStoreProvider } from '@rocicorp/zero/expo-sqlite';
import { Platform } from 'react-native';
import { type ReactNode } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { schema } from './schema';

/**
 * Wraps the app in Zero, wired to the current (anonymous or linked) user.
 *
 * - `kvStore`: SQLite on native (persistent, offline-capable), IndexedDB on web.
 * - `server`: the zero-cache URL. When unset (no backend yet), Zero runs
 *   purely local — the app still works, it just has nothing to sync with.
 * - `userID` / `auth`: when these change (e.g. anon → linked), ZeroProvider
 *   recreates the client so storage is correctly partitioned per user.
 */

const ZERO_SERVER = process.env.EXPO_PUBLIC_ZERO_SERVER;

// 'idb' on web; persistent SQLite store on iOS/Android.
const kvStore = Platform.OS === 'web' ? 'idb' : expoSQLiteStoreProvider();

export function AppZeroProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return (
    <ZeroProvider
      schema={schema}
      userID={user?.userID ?? 'anonymous'}
      auth={user?.token ?? undefined}
      server={ZERO_SERVER}
      kvStore={kvStore}>
      {children}
    </ZeroProvider>
  );
}
