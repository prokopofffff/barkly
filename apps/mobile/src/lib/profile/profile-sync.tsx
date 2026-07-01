import { useQuery } from '@rocicorp/zero/react';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { useLocalProfile } from '@/lib/profile/local-profile';
import { useCurrentUserQuery, useProgressForUser } from '@/lib/zero/queries';

/**
 * Headless reconciler: reads the synced Zero user row + progress rows and folds
 * them back into the device-local profile via `hydrateFromSync`. Renders null.
 *
 * MUST be mounted INSIDE <AppZeroProvider> (it calls useZero via the query
 * builders) and within AuthProvider/LocalProfileProvider (needs the user id +
 * the local profile). See _layout.tsx.
 *
 * The reconciliation is strictly NON-REGRESSING (see local-profile.tsx):
 * when the replica is empty `me` is undefined, so we pass `onboarded: undefined`
 * and nothing regresses — an already-onboarded user is never re-walled.
 */
export function ProfileSync() {
  const { user } = useAuth();
  if (!user) return null;
  return <ProfileSyncInner userID={user.userID} />;
}

function ProfileSyncInner({ userID }: { userID: string }) {
  const { hydrateFromSync } = useLocalProfile();
  const [me] = useQuery(useCurrentUserQuery(userID));
  const [prog] = useQuery(useProgressForUser(userID));

  // Completed quizzes = progress rows flagged completed (fallback: any score > 0).
  const quizzesCompleted = (prog ?? []).filter((row) => (row.completed ? true : (row.score ?? 0) > 0)).length;
  const onboarded = me?.onboarded === true ? true : undefined;

  useEffect(() => {
    hydrateFromSync({ onboarded, quizzesCompleted });
  }, [hydrateFromSync, onboarded, quizzesCompleted]);

  return null;
}
