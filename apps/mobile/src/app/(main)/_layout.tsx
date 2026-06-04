import { Stack, usePathname, useRouter } from 'expo-router';
import { View } from 'react-native';

import { BottomNav, type NavTab } from '@/components/bottom-nav';

/** Maps a nav tab to its route path. The feed is the group's index ("/"). */
const TAB_PATH: Record<NavTab, string> = {
  feed: '/',
  leaderboard: '/leaderboard',
  studio: '/studio',
  rewards: '/rewards',
  profile: '/profile',
};

function activeFromPath(path: string): NavTab {
  if (path.startsWith('/leaderboard')) return 'leaderboard';
  if (path.startsWith('/studio')) return 'studio';
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
      <BottomNav active={activeFromPath(pathname)} onNav={(tab) => router.replace(TAB_PATH[tab])} />
    </View>
  );
}
