// Добавление и изменение единицы техники администратором (ФТ-03, ФТ-04)
import { useState } from 'react';
import { Text, View } from 'react-native';
import { api, type Category, type Equipment } from '../lib/api';
import { CONDITION_TITLE } from '../lib/format';
import { space, type } from '../lib/theme';
import { Sheet } from './Sheet';
import { Banner, Button, Chip, Field } from './ui';

type Props = { visible: boolean; onClose: () => void; onSaved: (e: Equipment) => void; categories: Category[]; equipment?: Equipment };

export function EquipmentEditor(props: Props) {
  return props.visible ? <EquipmentForm {...props} /> : null;
}

function EquipmentForm({ visible, onClose, onSaved, categories, equipment }: Props) {
  const [form, setForm] = useState({
    name: equipment?.name ?? '', inventory_no: equipment?.inventory_no ?? '',
    daily_price: equipment ? String(equipment.daily_price) : '', deposit: equipment ? String(equipment.deposit) : '',
    photo: equipment?.photo ?? '',
  });
  const [categoryId, setCategoryId] = useState<number | null>(equipment?.category_id ?? categories[0]?.id ?? null);
  const [condition, setCondition] = useState<Equipment['condition']>(equipment?.condition ?? 'ok');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);


  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const money = (s: string) => Number(s.replace(',', '.'));

  async function save() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Укажите название';
    if (!form.inventory_no.trim()) e.inventory_no = 'Укажите инвентарный номер';
    if (!form.daily_price || !(money(form.daily_price) >= 0)) e.daily_price = 'Неотрицательное число';
    if (form.deposit && !(money(form.deposit) >= 0)) e.deposit = 'Неотрицательное число';
    setErrors(e);
    if (Object.keys(e).length || !categoryId) return;
    setBusy(true);
    setError(null);
    const body = {
      name: form.name.trim(), inventory_no: form.inventory_no.trim(), category_id: categoryId,
      daily_price: money(form.daily_price), deposit: form.deposit ? money(form.deposit) : 0, condition,
      photo: form.photo.trim() || null,
    };
    try {
      const saved = equipment
        ? await api<Equipment>(`/equipment/${equipment.id}`, { method: 'PATCH', body })
        : await api<Equipment>('/equipment', { method: 'POST', body });
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible} onClose={onClose}
      title={equipment ? 'Изменить технику' : 'Новая техника'}
      footer={<>{error ? <Banner text={error} /> : null}<Button title="Сохранить" onPress={save} loading={busy} /></>}
    >
      <Field label="Название" value={form.name} onChangeText={set('name')} error={errors.name} />
      <Field label="Инвентарный номер" value={form.inventory_no} onChangeText={set('inventory_no')} error={errors.inventory_no} autoCapitalize="characters" />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}><Field label="Цена за сутки, ₽" value={form.daily_price} onChangeText={set('daily_price')} error={errors.daily_price} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Залог, ₽" value={form.deposit} onChangeText={set('deposit')} error={errors.deposit} keyboardType="decimal-pad" /></View>
      </View>
      <View style={{ gap: space.sm }}>
        <Text style={type.caption}>Категория</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {categories.map((c) => <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />)}
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        <Text style={type.caption}>Состояние</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {(Object.keys(CONDITION_TITLE) as Equipment['condition'][]).map((c) => (
            <Chip key={c} label={CONDITION_TITLE[c]} active={condition === c} onPress={() => setCondition(c)} />
          ))}
        </View>
      </View>
      <Field label="Файл фотографии" value={form.photo} onChangeText={set('photo')} hint="Имя файла в каталоге media сервера, например drill.jpg" autoCapitalize="none" />
    </Sheet>
  );
}
