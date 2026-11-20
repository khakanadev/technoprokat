import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { SessionProvider, useSession } from '../lib/session';
import { CartProvider } from '../lib/cart';
import { colors } from '../lib/theme';

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, border: colors.border, primary: colors.accent, text: colors.text },
};

function RootStack() {
  const { user, loading } = useSession();
  if (loading) {
    return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /></View>;
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="equipment/[id]" />
        <Stack.Screen name="rental/[id]" />
        <Stack.Protected guard={user?.role === 'admin'}>
          <Stack.Screen name="admin/categories" />
          <Stack.Screen name="admin/events" />
        </Stack.Protected>
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <SessionProvider>
          <CartProvider>
            <StatusBar style="light" />
            <RootStack />
          </CartProvider>
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
