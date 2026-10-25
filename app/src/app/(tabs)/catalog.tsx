// Каталог (ФТ-05): поиск, фильтр по категории, крупные фотографии; клиент набирает технику в заявку
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Check, PackageSearch, Plus, Search } from 'lucide-react-native';
import { BookingSheet } from '../../components/BookingSheet';
import { LinearGradientFallback } from '../../components/Gradient';
import { ScreenHeader } from '../../components/Screen';
import { EquipmentEditor } from '../../components/EquipmentEditor';
import { Banner, Button, Chip, Empty, IconButton } from '../../components/ui';
import { mediaUrl, type Category, type Equipment } from '../../lib/api';
import { useCart } from '../../lib/cart';
import { rub } from '../../lib/format';
import { useSession } from '../../lib/session';
import { colors, radius, space, type } from '../../lib/theme';
import { useApi } from '../../lib/useApi';

export default function Catalog() {
  const { user } = useSession();
  const cart = useCart();
  const isClient = user?.role === 'client';
  const isAdmin = user?.role === 'admin';
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<number | null>(null);
  const [booking, setBooking] = useState(false);
  const [creating, setCreating] = useState(false);
  const { width } = useWindowDimensions();
  const cardWidth = (Math.min(width, 560) - space.lg * 2 - space.md) / 2;

  const path = `/equipment?${new URLSearchParams({ ...(q ? { q } : {}), ...(category ? { category_id: String(category) } : {}), ...(isAdmin ? { include_archived: 'true' } : {}) })}`;
  const list = useApi<Equipment[]>(path);
  const cats = useApi<Category[]>('/categories');
  const perDay = useMemo(() => cart.items.reduce((s, i) => s + i.daily_price, 0), [cart.items]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Каталог"
        subtitle={`${list.data?.length ?? '…'} единиц техники`}
        right={isAdmin ? <IconButton icon={Plus} label="Добавить технику" onPress={() => setCreating(true)} /> : undefined}
      />
      <View style={styles.search}>
        <Search size={18} color={colors.textDim} />
        <TextInput
          value={q} onChangeText={setQ} placeholder="Перфоратор, мойка, ЭИ-001…"
          placeholderTextColor={colors.textDim} style={styles.searchInput} returnKeyType="search"
          accessibilityLabel="Поиск по каталогу"
        />
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Все" active={category === null} onPress={() => setCategory(null)} />
          {cats.data?.map((c) => (
            <Chip key={c.id} label={c.name} count={c.equipment_count} active={category === c.id} onPress={() => setCategory(category === c.id ? null : c.id)} />
          ))}
        </ScrollView>
      </View>
      {list.error ? <View style={{ padding: space.lg }}><Banner text={list.error} /></View> : null}
      <FlatList
        data={list.data ?? []}
        keyExtractor={(e) => String(e.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: cart.items.length ? 120 : space.xl, maxWidth: 560, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.reload} tintColor={colors.accent} />}
        ListEmptyComponent={list.loading ? undefined : <Empty icon={PackageSearch} title="Ничего не найдено" text="Измените запрос или выберите другую категорию" />}
        renderItem={({ item }) => {
          const selected = cart.has(item.id);
          return (
            <Pressable
              onPress={() => router.push(`/equipment/${item.id}`)}
              style={({ pressed }) => [styles.card, { width: cardWidth, opacity: pressed ? 0.85 : item.is_active ? 1 : 0.5 }]}
              accessibilityLabel={`${item.name}, ${rub(item.daily_price)} в сутки`}
            >
              <View style={{ height: cardWidth * 1.15 }}>
                <Image source={{ uri: mediaUrl(item.photo) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                <LinearGradientFallback from={0.5} color={colors.surface} />
                {isClient ? (
                  <IconButton
                    icon={selected ? Check : Plus}
                    label={selected ? 'Убрать из заявки' : 'Добавить в заявку'}
                    active={selected}
                    onPress={() => cart.toggle(item)}
                    style={styles.add}
                  />
                ) : null}
                <View style={styles.cardText}>
                  <Text style={styles.price}>{rub(item.daily_price)}<Text style={styles.per}> / сутки</Text></Text>
                </View>
              </View>
              <View style={{ padding: space.md, gap: 2 }}>
                <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={2}>{item.name}</Text>
                <Text style={type.small} numberOfLines={1}>
                  {item.is_active ? item.category : 'В архиве'}{item.condition !== 'ok' && item.is_active ? ' · на обслуживании' : ''}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
      {isClient && cart.items.length ? (
        <View style={styles.cartBar}>
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>{cart.items.length} {cart.items.length === 1 ? 'позиция' : cart.items.length < 5 ? 'позиции' : 'позиций'}</Text>
            <Text style={[type.small, type.number]}>{rub(perDay)} в сутки</Text>
          </View>
          <Button title="Оформить" onPress={() => setBooking(true)} compact />
        </View>
      ) : null}
      <BookingSheet
        visible={booking}
        onClose={() => setBooking(false)}
        items={cart.items}
        onRemove={cart.remove}
        onDone={(r) => {
          setBooking(false);
          cart.clear();
          router.push(`/rental/${r.id}`);
        }}
      />
      {isAdmin ? (
        <EquipmentEditor visible={creating} categories={cats.data ?? []} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void list.reload(); }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.lg, paddingHorizontal: space.md,
    height: 46, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, height: '100%' },
  chips: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  add: { position: 'absolute', top: space.sm, right: space.sm },
  cardText: { position: 'absolute', left: space.md, bottom: space.sm },
  price: { color: colors.text, fontSize: 17, fontWeight: '700' },
  per: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  cartBar: {
    position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg, maxWidth: 528, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, paddingLeft: space.lg,
    backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
});
