// Список аренд (ФТ-09, ФТ-10): клиент видит свои, сотрудник — все с фильтрами
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { ClipboardList, Search, SlidersHorizontal } from 'lucide-react-native';
import { ScreenHeader } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { Banner, Button, Chip, Empty, Field, IconButton, StatusBadge } from '../../components/ui';
import { mediaUrl, type RentalListItem } from '../../lib/api';
import { period, rub } from '../../lib/format';
import { isStaffRole, useSession } from '../../lib/session';
import { colors, radius, space, type } from '../../lib/theme';
import { useApi } from '../../lib/useApi';

const STAFF_TABS = [
  { key: 'active', label: 'В работе', status: 'new,confirmed,issued,returned' },
  { key: 'new', label: 'Новые', status: 'new' },
  { key: 'issued', label: 'Выданы', status: 'issued' },
  { key: 'overdue', label: 'Просрочены', overdue: true },
  { key: 'returned', label: 'К закрытию', status: 'returned' },
  { key: 'all', label: 'Все' },
] as const;

const CLIENT_TABS = [
  { key: 'active', label: 'Текущие', status: 'new,confirmed,issued,returned' },
  { key: 'all', label: 'Все' },
] as const;

type Filters = { manager: string | null; from: string; to: string };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function Rentals() {
  const { user } = useSession();
  const staff = isStaffRole(user);
  const tabs = staff ? STAFF_TABS : CLIENT_TABS;
  const [tab, setTab] = useState<string>('active');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filters>({ manager: null, from: '', to: '' });
  const [sheet, setSheet] = useState(false);

  const current = tabs.find((t) => t.key === tab) as { status?: string; overdue?: boolean };
  const params = new URLSearchParams();
  if (current.status) params.set('status', current.status);
  if (current.overdue) params.set('overdue', 'true');
  if (q.trim()) params.set('q', q.trim());
  if (filters.manager) params.set('manager_id', filters.manager);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const list = useApi<RentalListItem[]>(`/rentals?${params}`);
  const staffList = useApi<{ id: string; full_name: string }[]>(staff ? '/staff' : null);
  const activeFilters = [filters.manager, filters.from, filters.to].filter(Boolean).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title={staff ? 'Аренды' : 'Мои аренды'}
        subtitle={user?.full_name}
        right={staff ? (
          <View>
            <IconButton icon={SlidersHorizontal} label="Фильтры" onPress={() => setSheet(true)} />
            {activeFilters ? <View style={styles.dot}><Text style={styles.dotText}>{activeFilters}</Text></View> : null}
          </View>
        ) : undefined}
      />
      {staff ? (
        <View style={styles.search}>
          <Search size={18} color={colors.textDim} />
          <TextInput value={q} onChangeText={setQ} placeholder="Клиент или номер аренды" placeholderTextColor={colors.textDim} style={styles.searchInput} accessibilityLabel="Поиск аренд" />
        </View>
      ) : null}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {tabs.map((t) => <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />)}
        </ScrollView>
      </View>
      {list.error ? <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}><Banner text={list.error} /></View> : null}
      <FlatList
        data={list.data ?? []}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, maxWidth: 560, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.reload} tintColor={colors.accent} />}
        ListEmptyComponent={list.loading ? undefined : (
          <Empty
            icon={ClipboardList}
            title={staff ? 'Аренд нет' : 'Здесь появятся ваши аренды'}
            text={staff ? 'Измените фильтр' : 'Выберите технику в каталоге и оформите заявку'}
            action={staff ? undefined : <Button title="Открыть каталог" compact onPress={() => router.navigate('/catalog')} />}
          />
        )}
        renderItem={({ item: r }) => (
          <Pressable onPress={() => router.push(`/rental/${r.id}`)} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.8 : 1 }]}>
            <Image source={{ uri: mediaUrl(r.photo) }} style={styles.thumb} contentFit="cover" />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text style={[type.small, type.number, { color: colors.textDim }]}>№ {r.id}</Text>
                <StatusBadge code={r.status_code} title={r.status_title} overdue={r.is_overdue} />
              </View>
              <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={1}>{staff ? r.client_name : r.items}</Text>
              <Text style={type.small} numberOfLines={1}>{staff ? r.items : `${r.items_count} поз.`} · {period(r.date_from, r.date_to)}</Text>
            </View>
            <Text style={[type.h3, type.number]}>{rub(r.total)}</Text>
          </Pressable>
        )}
      />
      {staff ? (
        <FilterSheet
          visible={sheet}
          value={filters}
          staff={staffList.data ?? []}
          me={user?.id}
          onClose={() => setSheet(false)}
          onApply={(f) => { setFilters(f); setSheet(false); }}
        />
      ) : null}
    </View>
  );
}

function FilterSheet({ visible, value, staff, me, onClose, onApply }: {
  visible: boolean; value: Filters; staff: { id: string; full_name: string }[]; me?: string;
  onClose: () => void; onApply: (f: Filters) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const apply = () => {
    if ((draft.from && !DATE_RE.test(draft.from)) || (draft.to && !DATE_RE.test(draft.to))) {
      setError('Даты в формате ГГГГ-ММ-ДД');
      return;
    }
    setError(null);
    onApply(draft);
  };
  return (
    <Sheet
      visible={visible} onClose={onClose} title="Фильтры"
      footer={<>
        {error ? <Banner text={error} /> : null}
        <Button title="Показать" onPress={apply} />
        <Button title="Сбросить" variant="ghost" onPress={() => { const empty = { manager: null, from: '', to: '' }; setDraft(empty); onApply(empty); }} />
      </>}
    >
      <View style={{ gap: space.sm }}>
        <Text style={type.caption}>Ответственный</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Chip label="Любой" active={!draft.manager} onPress={() => setDraft({ ...draft, manager: null })} />
          {staff.map((s) => (
            <Chip key={s.id} label={s.id === me ? 'Я' : s.full_name.split(' ').slice(0, 2).join(' ')} active={draft.manager === s.id} onPress={() => setDraft({ ...draft, manager: s.id })} />
          ))}
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        <Text style={type.caption}>Дата начала аренды</Text>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}><Field label="С" value={draft.from} onChangeText={(v) => setDraft({ ...draft, from: v })} placeholder="2026-10-01" /></View>
          <View style={{ flex: 1 }}><Field label="По" value={draft.to} onChangeText={(v) => setDraft({ ...draft, to: v })} placeholder="2026-10-31" /></View>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.lg, paddingHorizontal: space.md,
    height: 46, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, height: '100%' },
  chips: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  thumb: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  dot: {
    position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg,
  },
  dotText: { fontSize: 10, fontWeight: '700', color: colors.onAccent },
});

