import { Tabs } from 'expo-router';
import { BarChart3, ClipboardList, Package, User, Users } from 'lucide-react-native';
import { useSession } from '../../lib/session';
import { colors } from '../../lib/theme';

export default function TabsLayout() {
  const { user } = useSession();
  const staff = user?.role === 'admin' || user?.role === 'manager';
  const admin = user?.role === 'admin';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="rentals" options={{ title: staff ? 'Аренды' : 'Мои аренды', tabBarIcon: ({ color }) => <ClipboardList color={color} size={22} /> }} />
      <Tabs.Screen name="catalog" options={{ title: 'Каталог', tabBarIcon: ({ color }) => <Package color={color} size={22} /> }} />
      <Tabs.Screen name="reports" options={{ title: 'Отчёты', href: staff ? undefined : null, tabBarIcon: ({ color }) => <BarChart3 color={color} size={22} /> }} />
      <Tabs.Screen name="users" options={{ title: 'Люди', href: admin ? undefined : null, tabBarIcon: ({ color }) => <Users color={color} size={22} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль', tabBarIcon: ({ color }) => <User color={color} size={22} /> }} />
    </Tabs>
  );
}
