import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { Sheet } from '../../components/Sheet';
import { Banner, Button, Card, Divider, Field, IconButton } from '../../components/ui';
import { api, type Category } from '../../lib/api';
import { colors, space, type } from '../../lib/theme';
import { useApi } from '../../lib/useApi';

export default function Categories() {
  const insets = useSafeAreaInsets();
  const list = useApi<Category[]>('/categories');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const open = (c: Category | 'new') => { setEditing(c); setName(c === 'new' ? '' : c.name); setError(null); };
  async function save() {
    try {
      if (editing === 'new') await api('/categories', { method: 'POST', body: { name } });
      else if (editing) await api(`/categories/${editing.id}`, { method: 'PATCH', body: { name } });
      setEditing(null);
      await list.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <IconButton icon={ChevronLeft} label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />
        <Text style={[type.h2, { flex: 1 }]}>Категории</Text>
        <IconButton icon={Plus} label="Новая категория" onPress={() => open('new')} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        <Card>
          {(list.data ?? []).map((c, i) => (
            <View key={c.id}>
              {i ? <Divider /> : null}
              <Pressable style={styles.row} onPress={() => open(c)} onLongPress={() => setDeleting(c)}>
                <Text style={[type.body, { flex: 1 }]}>{c.name}</Text>
                <Text style={type.small}>{c.equipment_count} ед.</Text>
              </Pressable>
            </View>
          ))}
        </Card>
        <Text style={[type.small, { marginTop: space.md }]}>Нажмите, чтобы переименовать; удерживайте, чтобы удалить. Категорию с техникой удалить нельзя.</Text>
      </ScrollView>
      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Новая категория' : 'Переименовать'}
        footer={<>{error ? <Banner text={error} /> : null}<Button title="Сохранить" onPress={save} disabled={!name.trim()} /></>}>
        <Field label="Название" value={name} onChangeText={setName} autoFocus />
      </Sheet>
      {deleting ? (
        <ConfirmSheet visible title="Удалить категорию?" text={`Категория «${deleting.name}» будет удалена.`} confirm="Удалить" danger
          onClose={() => setDeleting(null)} onConfirm={async () => { await api(`/categories/${deleting.id}`, { method: 'DELETE' }); await list.reload(); }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space.lg },
});
