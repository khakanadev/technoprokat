// Короткий путь оформления: даты → проверка занятости и сумма → готово (ФТ-06, ФТ-07, ФТ-08)
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { CalendarCheck, CircleCheck, Minus, Plus, Trash2 } from 'lucide-react-native';
import { api, mediaUrl, type Equipment, type RentalFull } from '../lib/api';
import { addDays, dayMonth, days, isoDate, parseDate, rub, weekday } from '../lib/format';
import { colors, radius, space, type } from '../lib/theme';
import { Sheet } from './Sheet';
import { Banner, Button, Chip, Divider, Row } from './ui';

type Item = Pick<Equipment, 'id' | 'name' | 'daily_price' | 'deposit' | 'photo' | 'inventory_no'>;

type Props = {
  visible: boolean; onClose: () => void; items: Item[]; onRemove: (id: number) => void;
  onDone: (rental: RentalFull) => void;
  edit?: { rentalId: number; dateFrom: string; dateTo: string };
};

// Лист монтируется при открытии: каждое открытие начинается с первого шага
export function BookingSheet(props: Props) {
  return props.visible ? <BookingFlow {...props} /> : null;
}

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function BookingFlow({ visible, onClose, items, onRemove, onDone, edit }: Props) {
  const [today] = useState(startOfToday);
  const [step, setStep] = useState(0);
  const [start, setStart] = useState(() => (edit ? parseDate(edit.dateFrom) : addDays(today, 1)));
  const [length, setLength] = useState(() => (edit
    ? Math.round((parseDate(edit.dateTo).getTime() - parseDate(edit.dateFrom).getTime()) / 864e5) + 1
    : 1));
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<RentalFull | null>(null);


  const end = addDays(start, length - 1);
  const perDay = items.reduce((s, i) => s + i.daily_price, 0);
  const deposit = items.reduce((s, i) => s + i.deposit, 0);
  const strip = useMemo(() => Array.from({ length: 28 }, (_, i) => addDays(today, i)), [today]);

  async function check() {
    setChecking(true);
    setError(null);
    try {
      const list = await api<Equipment[]>(`/equipment?from=${isoDate(start)}&to=${isoDate(end)}`);
      setBusy(new Set(list.filter((e) => e.is_busy).map((e) => e.id)));
      setStep(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function submit() {
    setSending(true);
    setError(null);
    try {
      const body = { date_from: isoDate(start), date_to: isoDate(end), equipment_ids: items.map((i) => i.id) };
      const rental = edit
        ? await api<RentalFull>(`/rentals/${edit.rentalId}`, { method: 'PATCH', body })
        : await api<RentalFull>('/rentals', { method: 'POST', body });
      setCreated(rental);
      setStep(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const busyItems = items.filter((i) => busy.has(i.id));
  const titles = [edit ? 'Новые даты' : 'Когда нужна техника', 'Проверьте заявку', edit ? 'Заявка изменена' : 'Заявка отправлена'];

  return (
    <Sheet
      visible={visible}
      onClose={() => (created ? onDone(created) : onClose())}
      title={titles[step]}
      subtitle={step < 2 ? `${items.length} ${items.length === 1 ? 'позиция' : 'позиции'} · ${rub(perDay)} в сутки` : undefined}
      step={step}
      steps={3}
      onBack={step === 1 ? () => setStep(0) : undefined}
      footer={
        step === 0 ? (
          <Button title={`Продолжить · ${dayMonth(start)}${length > 1 ? ` — ${dayMonth(end)}` : ''}`} onPress={check} loading={checking} disabled={!items.length} />
        ) : step === 1 ? (
          <>
            {error ? <Banner text={error} /> : null}
            <Button
              title={edit ? 'Сохранить изменения' : `Отправить заявку · ${rub(perDay * length)}`}
              icon={CalendarCheck}
              onPress={submit}
              loading={sending}
              disabled={!items.length || busyItems.length > 0}
            />
          </>
        ) : (
          <Button title="Открыть заявку" onPress={() => created && onDone(created)} />
        )
      }
    >
      {step === 0 ? (
        <>
          <View style={{ gap: space.sm }}>
            <Text style={type.caption}>Начало аренды</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {strip.map((d) => {
                const active = isoDate(d) === isoDate(start);
                const sunday = d.getDay() === 0;
                return (
                  <Pressable
                    key={isoDate(d)}
                    onPress={() => setStart(d)}
                    accessibilityLabel={dayMonth(d)}
                    style={[styles.day, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                  >
                    <Text style={[styles.dayWeek, active && { color: colors.onAccent }, sunday && !active && { color: colors.textDim }]}>{weekday(d)}</Text>
                    <Text style={[styles.dayNum, active && { color: colors.onAccent }]}>{d.getDate()}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {start.getDay() === 0 ? <Text style={type.small}>В воскресенье пункт выдачи закрыт — заберите технику в понедельник</Text> : null}
          </View>

          <View style={{ gap: space.sm }}>
            <Text style={type.caption}>Срок</Text>
            <View style={styles.stepper}>
              <Pressable style={styles.stepBtn} onPress={() => setLength((n) => Math.max(1, n - 1))} accessibilityLabel="Меньше">
                <Minus size={20} color={colors.text} />
              </Pressable>
              <View style={{ alignItems: 'center' }}>
                <Text style={[type.title, type.number]}>{length}</Text>
                <Text style={type.small}>{days(length).split(' ')[1]}</Text>
              </View>
              <Pressable style={styles.stepBtn} onPress={() => setLength((n) => Math.min(60, n + 1))} accessibilityLabel="Больше">
                <Plus size={20} color={colors.text} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              {[[1, 'Сутки'], [3, '3 дня'], [7, 'Неделя'], [14, '2 недели']].map(([n, label]) => (
                <Chip key={n} label={label as string} active={length === n} onPress={() => setLength(n as number)} />
              ))}
            </View>
          </View>
          {error ? <Banner text={error} /> : null}
        </>
      ) : step === 1 ? (
        <>
          <View style={{ gap: space.md }}>
            {items.map((i) => (
              <View key={i.id} style={styles.item}>
                <Image source={{ uri: mediaUrl(i.photo) }} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={type.body} numberOfLines={1}>{i.name}</Text>
                  {busy.has(i.id)
                    ? <Text style={[type.small, { color: colors.danger }]}>Занята на эти даты</Text>
                    : <Text style={[type.small, type.number]}>{rub(i.daily_price)} в сутки · свободна</Text>}
                </View>
                <Pressable onPress={() => onRemove(i.id)} hitSlop={8} style={styles.remove} accessibilityLabel={`Убрать ${i.name}`}>
                  <Trash2 size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
          {busyItems.length ? <Banner text="Уберите занятую технику или выберите другие даты" /> : null}
          <Divider />
          <View style={{ gap: space.xs }}>
            <Row label="Период" value={`${dayMonth(start)} — ${dayMonth(end)}`} />
            <Row label="Срок" value={days(length)} />
            <Row label="Залог при выдаче" value={rub(deposit)} />
            <Row label="Стоимость аренды" value={rub(perDay * length)} strong />
          </View>
          <Text style={type.small}>Оплата и залог — в пункте выдачи. Заявку подтвердит менеджер; до выдачи её можно отменить.</Text>
        </>
      ) : (
        <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
          <CircleCheck size={56} color={colors.accent} strokeWidth={1.6} />
          <Text style={type.h2}>Заявка № {created?.id}</Text>
          <Text style={[type.small, { textAlign: 'center' }]}>
            {dayMonth(start)} — {dayMonth(end)} · {rub(perDay * length)}{'\n'}Менеджер проверит наличие и подтвердит заявку.
          </Text>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  day: {
    width: 52, height: 64, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  dayWeek: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  dayNum: { fontSize: 18, color: colors.text, fontWeight: '700' },
  stepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, padding: space.sm, borderWidth: 1, borderColor: colors.border,
  },
  stepBtn: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
