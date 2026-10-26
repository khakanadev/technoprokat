import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { ChevronRight, FolderTree, History, LogOut, type LucideIcon } from 'lucide-react-native';
import { ScreenHeader } from '../../components/Screen';
import { Button, Card, Divider } from '../../components/ui';
import { API_URL } from '../../lib/api';
import { ROLE_TITLE } from '../../lib/format';
import { useSession } from '../../lib/session';
import { colors, space, type } from '../../lib/theme';

function Link({ icon: Icon, title, onPress }: { icon: LucideIcon; title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.link, { opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button">
      <Icon size={20} color={colors.textMuted} />
      <Text style={[type.body, { flex: 1 }]}>{title}</Text>
      <ChevronRight size={18} color={colors.textDim} />
    </Pressable>
  );
}

export default function Profile() {
  const { user, signOut } = useSession();
  if (!user) return null;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Профиль" subtitle={ROLE_TITLE[user.role]} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <Card style={{ padding: space.lg, gap: 4 }}>
          <Text style={type.h2}>{user.full_name}</Text>
          <Text style={type.small}>{user.email}</Text>
        </Card>
        {user.role === 'admin' ? (
          <Card>
            <Link icon={FolderTree} title="Категории техники" onPress={() => router.push('/admin/categories')} />
            <Divider />
            <Link icon={History} title="Журнал действий" onPress={() => router.push('/admin/events')} />
          </Card>
        ) : null}
        <Button title="Выйти" icon={LogOut} variant="secondary" onPress={signOut} />
        <Text style={[type.small, { textAlign: 'center', color: colors.textDim }]}>
          ТехноПрокат {Constants.expoConfig?.version} · {API_URL}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 52 },
});
