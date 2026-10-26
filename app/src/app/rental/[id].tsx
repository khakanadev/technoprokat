// Карточка аренды: состояние, позиции, действия по роли, история и комментарии (ФТ-11 – ФТ-19)
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, MessageSquare, PackageCheck, PackageOpen, Pencil, Send, ShieldCheck, Lock, XCircle } from 'lucide-react-native';
import { BookingSheet } from '../../components/BookingSheet';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { LinearGradientFallback } from '../../components/Gradient';
import { Sheet } from '../../components/Sheet';
import { Banner, Button, Card, Chip, Divider, IconButton, Row, StatusBadge } from '../../components/ui';
import { api, mediaUrl, type Equipment, type RentalFull, type StatusCode } from '../../lib/api';
import { CONDITION_TITLE, ROLE_TITLE, dateTime, days, period, rub } from '../../lib/format';
import { isStaffRole, useSession } from '../../lib/session';
import { colors, radius, space, type } from '../../lib/theme';
import { useApi } from '../../lib/useApi';

const PATH: { code: StatusCode; title: string }[] = [
  { code: 'new', title: 'Заявка' }, { code: 'confirmed', title: 'Подтв.' }, { code: 'issued', title: 'Выдана' },
  { code: 'returned', title: 'Возврат' }, { code: 'closed', title: 'Закрыта' },
];

type Action = { to: StatusCode; title: string; text: string; confirm: string; danger?: boolean; icon: typeof Lock };

export default function RentalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const staff = isStaffRole(user);
  const { data: r, error, setData, reload } = useApi<RentalFull>(`/rentals/${id}`);
  const [action, setAction] = useState<Action | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<RentalFull['items']>([]);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  if (!r) {
    return <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.xl, paddingTop: insets.top + 60 }}>{error ? <Banner text={error} /> : null}</View>;
  }

  const change = async (to: StatusCode, extra?: object) => setData(await api<RentalFull>(`/rentals/${r.id}/status`, { method: 'POST', body: { to, ...extra } }));
  const deposit = r.items.reduce((s, i) => s + i.deposit, 0);
  const stepIndex = PATH.findIndex((p) => p.code === r.status_code);
  const cancellable = r.status_code === 'new' || r.status_code === 'confirmed';

  const cancel: Action = {
    to: 'cancelled', title: 'Отменить аренду?', confirm: 'Отменить аренду', danger: true, icon: XCircle,
    text: 'Заявка перейдёт в состояние «Отменена». Это действие нельзя отменить — для новой аренды потребуется новая заявка.',
  };
  const staffActions: Partial<Record<StatusCode, Action>> = {
    new: { to: 'confirmed', title: 'Подтвердить заявку?', confirm: 'Подтвердить', icon: ShieldCheck, text: 'Система проверит, что техника свободна на эти даты, и назначит вас ответственным.' },
    confirmed: { to: 'issued', title: 'Выдать технику?', confirm: 'Выдать', icon: PackageOpen, text: `Проверьте документ клиента, комплектность и примите залог ${rub(deposit)}.` },
    returned: { to: 'closed', title: 'Закрыть аренду?', confirm: `Закрыть · ${rub(r.total)}`, icon: Lock, text: `Итог к оплате: ${rub(r.total)} за ${days(r.days)}. Верните клиенту залог за вычетом удержаний.` },
  };
  const primary = staff ? staffActions[r.status_code] : undefined;

  async function sendComment() {
    if (!comment.trim()) return;
    setSending(true);
    setCommentError(null);
    try {
      await api(`/rentals/${r!.id}/comments`, { method: 'POST', body: { text: comment.trim() } });
      setComment('');
      await reload();
    } catch (e) {
      setCommentError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Image source={{ uri: mediaUrl(r.items[0]?.photo) }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradientFallback from={0.3} />
          <View style={[styles.heroBar, { top: insets.top + space.sm }]}>
            <IconButton icon={ChevronLeft} label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/rentals'))} />
          </View>
          <View style={{ padding: space.lg, gap: space.sm }}>
            <StatusBadge code={r.status_code} title={r.status_title} overdue={r.is_overdue} />
            <Text style={type.title}>Аренда № {r.id}</Text>
            <Text style={type.small}>{period(r.date_from, r.date_to)} · {days(r.days)}</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: space.lg, gap: space.lg }}>
          {r.status_code !== 'cancelled' ? (
            <View style={styles.track}>
              {PATH.map((p, i) => (
                <View key={p.code} style={{ flex: 1, gap: 6 }}>
                  <View style={[styles.trackBar, { backgroundColor: i <= stepIndex ? colors.accent : colors.border }]} />
                  <Text style={[styles.trackText, i === stepIndex && { color: colors.text }]}>{p.title}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {primary || cancellable || (staff && r.status_code === 'issued') || (!staff && r.status_code === 'new') ? (
            <View style={{ gap: space.sm }}>
              {staff && r.status_code === 'issued' ? <Button title="Принять технику" icon={PackageCheck} onPress={() => setReceiving(true)} /> : null}
              {primary ? <Button title={primary.confirm} icon={primary.icon} onPress={() => setAction(primary)} /> : null}
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                {!staff && r.status_code === 'new' ? <Button title="Изменить" icon={Pencil} variant="secondary" style={{ flex: 1 }} onPress={() => { setEditItems(r.items); setEditing(true); }} /> : null}
                {cancellable ? <Button title="Отменить" variant="danger" style={{ flex: 1 }} onPress={() => setAction(cancel)} /> : null}
              </View>
            </View>
          ) : null}

          <Card style={{ padding: space.lg, gap: space.xs }}>
            {staff ? <><Row label="Клиент" value={r.client_name} /><Divider /></> : null}
            {staff && r.client_phone ? <><Row label="Телефон" value={r.client_phone} /><Divider /></> : null}
            <Row label="Ответственный" value={r.manager_name ?? 'ещё не назначен'} />
            <Divider />
            <Row label="Залог" value={rub(deposit)} />
            <Divider />
            <Row label={`Итого за ${days(r.days)}`} value={rub(r.total)} strong />
          </Card>

          <View style={{ gap: space.sm }}>
            <Text style={type.caption}>Техника · {r.items.length}</Text>
            {r.items.map((i) => (
              <View key={i.equipment_id} style={styles.item}>
                <Image source={{ uri: mediaUrl(i.photo) }} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={type.body} numberOfLines={1}>{i.name}</Text>
                  <Text style={type.small}>{i.inventory_no} · {CONDITION_TITLE[i.condition]}</Text>
                </View>
                <Text style={[type.body, type.number]}>{rub(i.price_per_day)}<Text style={type.small}>/сут</Text></Text>
              </View>
            ))}
          </View>

          <View style={{ gap: space.md }}>
            <Text style={type.caption}>История и комментарии</Text>
            {r.events.map((e) => (
              <View key={e.id} style={styles.event}>
                <View style={[styles.eventIcon, e.type === 'comment' && { backgroundColor: colors.surfaceRaised }]}>
                  {e.type === 'comment' ? <MessageSquare size={14} color={colors.textMuted} /> : <View style={styles.eventDot} />}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={e.type === 'comment' ? type.body : [type.body, { fontWeight: '600' }]}>{e.text}</Text>
                  <Text style={type.small}>{e.author} · {ROLE_TITLE[e.author_role]} · {dateTime(e.created_at)}</Text>
                </View>
              </View>
            ))}
            {r.status_code !== 'closed' && r.status_code !== 'cancelled' ? (
              <View style={{ gap: space.sm }}>
                <View style={styles.compose}>
                  <TextInput
                    value={comment} onChangeText={setComment} placeholder="Комментарий к аренде" placeholderTextColor={colors.textDim}
                    style={styles.composeInput} multiline maxLength={2000} accessibilityLabel="Комментарий"
                  />
                  <IconButton icon={Send} label="Отправить комментарий" active={!!comment.trim()} onPress={sendComment} />
                </View>
                {sending ? <Text style={type.small}>Отправка…</Text> : null}
                {commentError ? <Banner text={commentError} /> : null}
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {action ? (
        <ConfirmSheet
          visible title={action.title} text={action.text} confirm={action.confirm} danger={action.danger}
          onClose={() => setAction(null)} onConfirm={() => change(action.to)}
        />
      ) : null}
      <ReceiveSheet visible={receiving} rental={r} onClose={() => setReceiving(false)} onDone={async (conditions) => { await change('returned', { conditions }); setReceiving(false); }} />
      {!staff ? (
        <BookingSheet
          visible={editing}
          onClose={() => setEditing(false)}
          items={editItems.map((i) => ({ id: i.equipment_id, name: i.name, daily_price: i.price_per_day, deposit: i.deposit, photo: i.photo, inventory_no: i.inventory_no }))}
          onRemove={(rid) => setEditItems((list) => list.filter((i) => i.equipment_id !== rid))}
          edit={{ rentalId: r.id, dateFrom: r.date_from, dateTo: r.date_to }}
          onDone={(updated) => { setEditing(false); setData(updated); }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

// Приём техники в два шага: состояние каждой единицы → подтверждение (ФТ-13)
function ReceiveSheet({ visible, rental, onClose, onDone }: {
  visible: boolean; rental: RentalFull; onClose: () => void; onDone: (c: Record<number, Equipment['condition']>) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [conditions, setConditions] = useState<Record<number, Equipment['condition']>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = (id: number) => conditions[id] ?? 'ok';
  const damaged = rental.items.filter((i) => value(i.equipment_id) !== 'ok');

  return (
    <Sheet
      visible={visible} onClose={() => { setStep(0); onClose(); }} step={step} steps={2}
      title={step === 0 ? 'Состояние техники' : 'Подтвердите приём'} subtitle={`Аренда № ${rental.id}`}
      onBack={step === 1 ? () => setStep(0) : undefined}
      footer={step === 0
        ? <Button title="Далее" onPress={() => setStep(1)} />
        : <>{error ? <Banner text={error} /> : null}<Button title="Принять технику" icon={PackageCheck} loading={busy} onPress={async () => {
          setBusy(true); setError(null);
          try { await onDone(Object.fromEntries(rental.items.map((i) => [i.equipment_id, value(i.equipment_id)]))); setStep(0); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
        }} /></>}
    >
      {step === 0 ? rental.items.map((i) => (
        <View key={i.equipment_id} style={{ gap: space.sm }}>
          <View style={styles.item}>
            <Image source={{ uri: mediaUrl(i.photo) }} style={styles.thumb} contentFit="cover" />
            <Text style={[type.body, { flex: 1 }]}>{i.name}</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {(Object.keys(CONDITION_TITLE) as Equipment['condition'][]).map((c) => (
              <Chip key={c} label={CONDITION_TITLE[c]} active={value(i.equipment_id) === c} onPress={() => setConditions({ ...conditions, [i.equipment_id]: c })} />
            ))}
          </View>
        </View>
      )) : (
        <View style={{ gap: space.md }}>
          <Row label="Позиций" value={String(rental.items.length)} />
          <Row label="С замечаниями" value={damaged.length ? damaged.map((d) => d.name).join(', ') : 'нет'} />
          <Text style={type.small}>Состояние единиц будет записано в каталог, аренда перейдёт в «Возвращена». Удержания из залога оформляются в пункте выдачи.</Text>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: { height: 300, justifyContent: 'flex-end', backgroundColor: colors.surface, marginBottom: space.lg },
  heroBar: { position: 'absolute', left: space.lg },
  track: { flexDirection: 'row', gap: 6 },
  trackBar: { height: 4, borderRadius: 2 },
  trackText: { fontSize: 11, color: colors.textDim, fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  event: { flexDirection: 'row', gap: space.md },
  eventIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  eventDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  compose: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  composeInput: {
    flex: 1, minHeight: 46, maxHeight: 120, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, color: colors.text, paddingHorizontal: space.md, paddingTop: 12, paddingBottom: 12, fontSize: 15,
  },
});
