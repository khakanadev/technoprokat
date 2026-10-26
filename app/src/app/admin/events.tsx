// Журнал действий по всем арендам (ФТ-24)
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { IconButton } from '../../components/ui';
import { dateTime } from '../../lib/format';
import { colors, radius, space, type } from '../../lib/theme';
import { useApi } from '../../lib/useApi';

interface Event { id: number; rental_id: number; type: 'status' | 'comment'; text: string; created_at: string; author: string }

export default function Events() {
  const insets = useSafeAreaInsets();
  const list = useApi<Event[]>('/admin/events');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <IconButton icon={ChevronLeft} label="Назад" onPress={() => router.back()} />
        <Text style={type.h2}>Журнал действий</Text>
      </View>
      <FlatList
        data={list.data ?? []}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ padding: space.lg, gap: space.sm }}
        renderItem={({ item: e }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/rental/${e.rental_id}`)}>
            <View style={[styles.mark, { backgroundColor: e.type === 'status' ? colors.accent : colors.border }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.body}>№ {e.rental_id} · {e.text}</Text>
              <Text style={type.small}>{e.author} · {dateTime(e.created_at)}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', gap: space.md, padding: space.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  mark: { width: 4, borderRadius: 2 },
});
