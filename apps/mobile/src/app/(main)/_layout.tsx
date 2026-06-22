import { Stack, usePathname, useRouter } from 'expo-router';
import { View } from 'react-native';

import { BottomNav, type NavTab } from '@/components/bottom-nav';

/**
 * Maps a nav tab to its route path. The feed is the group's index ("/").
 * The center "+" ('studio') is an ACTION, not a tab: it pushes the role-aware
 * curator screen (bk-jaz.9.3) — basic users see "Стать куратором", curators/
 * admins get the YouTube Shorts submission. The MP4 studio editor is hidden
 * for now (MVP submits YouTube links, it doesn't host video).
 */
const TAB_PATH = {
  feed: '/',
  leaderboard: '/leaderboard',
  rewards: '/rewards',
  profile: '/profile',
} as const satisfies Record<Exclude<NavTab, 'studio'>, string>;

function activeFromPath(path: string): NavTab {
  if (path.startsWith('/leaderboard')) return 'leaderboard';
  if (path.startsWith('/rewards')) return 'rewards';
  if (path.startsWith('/profile')) return 'profile';
  return 'feed';
}

/**
 * The five main tabs share one Stack with a single floating BottomNav overlay.
 * The bar is absolutely positioned, so the feed's full-screen video shows
 * through behind it; the other screens pad their content to clear it.
 */
export default function MainLayout() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View className="flex-1 bg-bg">
      <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: '#08080c' } }} />
      <BottomNav
        active={activeFromPath(pathname)}
        onNav={(tab) => (tab === 'studio' ? router.push('/curator-submit') : router.replace(TAB_PATH[tab]))}
      />
    </View>
  );
}
