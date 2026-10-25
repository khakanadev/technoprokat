// Карточка техники: крупное фото, цена и залог; клиент оформляет аренду в два касания
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Archive, ArchiveRestore, Check, ChevronLeft, Pencil, Plus } from 'lucide-react-native';
import { BookingSheet } from '../../components/BookingSheet';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { EquipmentEditor } from '../../components/EquipmentEditor';
import { LinearGradientFallback } from '../../components/Gradient';
import { Banner, Button, Card, Divider, IconButton, Row } from '../../components/ui';
import { api, mediaUrl, type Category, type Equipment } from '../../lib/api';
import { useCart } from '../../lib/cart';
import { CONDITION_TITLE, rub } from '../../lib/format';
import { useSession } from '../../lib/session';
import { colors, space, type } from '../../lib/theme';
import { useApi } from '../../lib/useApi';

export default function EquipmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const cart = useCart();
  const { data: e, error, setData } = useApi<Equipment>(`/equipment/${id}`);
  const cats = useApi<Category[]>(user?.role === 'admin' ? '/categories' : null);
  const [booking, setBooking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  if (!e) {
    return <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.xl, paddingTop: insets.top + 60 }}>{error ? <Banner text={error} /> : null}</View>;
  }
  const inCart = cart.has(e.id);
  const bookingItems = inCart ? cart.items : [e];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.hero}>
          <Image source={{ uri: mediaUrl(e.photo) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          <LinearGradientFallback from={0.5} />
          <View style={[styles.heroBar, { top: insets.top + space.sm }]}>
            <IconButton icon={ChevronLeft} label="Назад" onPress={() => router.back()} />
            {user?.role === 'admin' ? <IconButton icon={Pencil} label="Изменить" onPress={() => setEditing(true)} /> : null}
          </View>
          <View style={styles.heroText}>
            <Text style={type.caption}>{e.category} · {e.inventory_no}</Text>
            <Text style={[type.title, { fontSize: 26 }]}>{e.name}</Text>
          </View>
        </View>
        <View style={{ padding: space.lg, gap: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
            <Text style={[type.title, type.number]}>{rub(e.daily_price)}</Text>
            <Text style={type.small}>за сутки</Text>
          </View>
          {!e.is_active ? <Banner text="Единица в архиве и недоступна для аренды" tone="accent" /> : null}
          <Card style={{ padding: space.lg, gap: space.xs }}>
            <Row label="Залог при выдаче" value={rub(e.deposit)} />
            <Divider />
            <Row label="Состояние" value={CONDITION_TITLE[e.condition]} />
            <Divider />
            <Row label="Инвентарный номер" value={e.inventory_no} />
          </Card>
          <Text style={type.small}>
            Выдача — пн–сб с 9:00 до 19:00 при предъявлении документа, удостоверяющего личность. Комплектность проверяется при выдаче и возврате.
          </Text>
          {user?.role === 'admin' ? (
            <Button
              title={e.is_active ? 'Перенести в архив' : 'Вернуть в каталог'}
              icon={e.is_active ? Archive : ArchiveRestore}
              variant="secondary"
              onPress={() => setArchiving(true)}
            />
          ) : null}
        </View>
      </ScrollView>

      {user?.role === 'client' && e.is_active ? (
        <View style={[styles.actions, { paddingBottom: insets.bottom + space.md }]}>
          <Button
            title={inCart ? 'В заявке' : 'В заявку'} icon={inCart ? Check : Plus} variant="secondary"
            onPress={() => cart.toggle(e)} style={{ flex: 1 }}
          />
          <Button title={inCart && cart.items.length > 1 ? `Оформить · ${cart.items.length}` : 'Арендовать'} onPress={() => setBooking(true)} style={{ flex: 1.3 }} />
        </View>
      ) : null}

      <BookingSheet
        visible={booking}
        onClose={() => setBooking(false)}
        items={bookingItems}
        onRemove={(rid) => (inCart ? cart.remove(rid) : setBooking(false))}
        onDone={(r) => {
          setBooking(false);
          if (inCart) cart.clear();
          router.replace(`/rental/${r.id}`);
        }}
      />
      {user?.role === 'admin' ? (
        <>
          <EquipmentEditor visible={editing} equipment={e} categories={cats.data ?? []} onClose={() => setEditing(false)} onSaved={(saved) => { setEditing(false); setData({ ...e, ...saved }); }} />
          <ConfirmSheet
            visible={archiving}
            title={e.is_active ? 'Перенести в архив?' : 'Вернуть в каталог?'}
            text={e.is_active
              ? 'Техника исчезнет из каталога клиентов. История аренд сохранится, вернуть единицу можно в любой момент.'
              : 'Техника снова станет доступна для заявок.'}
            confirm={e.is_active ? 'В архив' : 'Вернуть'}
            danger={e.is_active}
            onClose={() => setArchiving(false)}
            onConfirm={async () => setData({ ...e, ...(await api<Equipment>(`/equipment/${e.id}`, { method: 'PATCH', body: { is_active: !e.is_active } })) })}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 420, justifyContent: 'flex-end', backgroundColor: colors.bg },
  heroBar: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', justifyContent: 'space-between' },
  heroText: { padding: space.lg, gap: space.xs },
  actions: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: space.md,
    paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
  },
});
