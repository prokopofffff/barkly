import { useZero } from '@rocicorp/zero/react';

/**
 * Example Zero queries. Use these from components via `useQuery`, e.g.:
 *
 *   import { useQuery } from '@rocicorp/zero/react';
 *   import { useFeedQuery } from '@/lib/zero/queries';
 *   const [videos] = useQuery(useFeedQuery('es'));
 *
 * Reads are reactive and run against the local SQLite replica first, so they
 * resolve instantly and update live as zero-cache syncs.
 */
export function useFeedQuery(learningLang: string) {
  const z = useZero();
  return z.query.video
    .where('langCode', '=', learningLang)
    .orderBy('createdAt', 'desc')
    .limit(50);
}

export function useProgressForUser(userID: string) {
  const z = useZero();
  return z.query.progress.where('userID', '=', userID);
}
