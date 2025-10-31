import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AppProvider, useApp } from '@/context/AppContext';
import { usePathname, useRouter } from 'expo-router';

export {
    // Catch any errors thrown by the Layout component.
    ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppProvider>
        <CalibrationGate />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          <Stack.Screen name="stages/red-dot" options={{ title: 'Red Dot Task' }} />
          <Stack.Screen name="break" options={{ title: 'Break' }} />
          <Stack.Screen name="stages/object-search" options={{ title: 'Object Search' }} />
          <Stack.Screen name="survey" options={{ title: 'Post-Task Survey' }} />
          <Stack.Screen name="session/new" options={{ title: 'New Session' }} />
        </Stack>
      </AppProvider>
    </ThemeProvider>
  );
}

function CalibrationGate() {
  const { settings, updateSettings } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (settings.hasCalibrated) return;
    if (settings.calibrationPrompted) return;
    if (pathname === '/modal') return;
    // Mark as prompted to avoid multiple navigations across renders
    updateSettings({ calibrationPrompted: true });
    // Use navigate to avoid stacking duplicates
    router.navigate('/modal');
  }, [settings.hasCalibrated, settings.calibrationPrompted, pathname]);
  return null;
}
