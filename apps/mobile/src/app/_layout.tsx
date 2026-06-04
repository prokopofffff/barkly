import '@/global.css';

import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import { GameProvider } from '@/lib/feed/game-context';
import { LocalProfileProvider, useLocalProfile } from '@/lib/profile/local-profile';
import { AppZeroProvider } from '@/lib/zero/provider';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
    SpaceMono_400Regular,
  });

  // ГАВ is dark-mode first; hold render until the brand face is ready so we
  // never flash a system font.
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <LocalProfileProvider>
            <AppZeroProvider>
              <GameProvider>
                <ThemeProvider value={DarkTheme}>
                  <OnboardingGate>
                    {/* (main) = the tabbed app; onboarding / notifications / vocabulary
                        are full-screen pushes. Routes are auto-discovered from files. */}
                    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#08080c' } }} />
                  </OnboardingGate>
                  <StatusBar style="light" />
                </ThemeProvider>
              </GameProvider>
            </AppZeroProvider>
          </LocalProfileProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Deferred-registration gate. We never wall sign-in — an anonymous session is
 * minted on first launch — but we DO route a brand-new user through onboarding
 * before the feed. Once `onboarded`, we stay out of the way.
 *
 * Renders nothing until both the auth session and the local profile have
 * loaded, so we don't flash the feed and immediately bounce to onboarding.
 */
function OnboardingGate({ children }: { children: ReactNode }) {
  const { ready: authReady } = useAuth();
  const { ready: profileReady, onboarded } = useLocalProfile();
  const router = useRouter();
  const segments = useSegments();
  const ready = authReady && profileReady;

  useEffect(() => {
    if (!ready) return;
    const onOnboarding = segments[0] === 'onboarding';
    if (!onboarded && !onOnboarding) router.replace('/onboarding');
    else if (onboarded && onOnboarding) router.replace('/');
  }, [ready, onboarded, segments, router]);

  if (!ready) return null;
  return <>{children}</>;
}
