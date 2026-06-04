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
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/lib/auth/auth-context';
import { GameProvider } from '@/lib/feed/game-context';
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
          <AppZeroProvider>
            <GameProvider>
              <ThemeProvider value={DarkTheme}>
                {/* (main) = the tabbed app; onboarding / notifications / vocabulary
                    are full-screen pushes. Routes are auto-discovered from files. */}
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#08080c' } }} />
                <StatusBar style="light" />
              </ThemeProvider>
            </GameProvider>
          </AppZeroProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
