// Управление пользователями и ролями — только администратор (ФТ-22)
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { UserPlus, Users as UsersIcon } from 'lucide-react-native';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { ScreenHeader } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { Banner, Button, Chip, Empty, Field, IconButton } from '../../components/ui';
import { api, type Role } from '../../lib/api';
import { ROLE_TITLE } from '../../lib/format';
import { useSession } from '../../lib/session';
import { colors, radius, space, type } from '../../lib/theme';
import { useApi } from '../../lib/useApi';

interface AdminUser { id: string; email: string; full_name: string; phone: string | null; role: Role; is_active: boolean }
const ROLES: Role[] = ['admin', 'manager', 'client'];

export default function Users() {
  const { user: me } = useSession();
  const [role, setRole] = useState<Role | null>(null);
  const list = useApi<AdminUser[]>(`/admin/users${role ? `?role=${role}` : ''}`);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Пользователи" subtitle="Учётные записи и роли" right={<IconButton icon={UserPlus} label="Новый пользователь" onPress={() => setCreating(true)} />} />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm }}>
          <Chip label="Все" active={!role} onPress={() => setRole(null)} />
          {ROLES.map((r) => <Chip key={r} label={ROLE_TITLE[r]} active={role === r} onPress={() => setRole(r)} />)}
        </ScrollView>
      </View>
      <FlatList
        data={list.data ?? []}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, maxWidth: 560, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.reload} tintColor={colors.accent} />}
        ListEmptyComponent={list.loading ? undefined : <Empty icon={UsersIcon} title="Пользователей нет" />}
        renderItem={({ item: u }) => (
          <Pressable onPress={() => setSelected(u)} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.8 : u.is_active ? 1 : 0.55 }]}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{u.full_name.split(' ').slice(0, 2).map((p) => p[0]).join('')}</Text></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={1}>{u.full_name}{u.id === me?.id ? ' (вы)' : ''}</Text>
              <Text style={type.small} numberOfLines={1}>{u.email}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={[type.small, { color: u.role === 'client' ? colors.textMuted : colors.text }]}>{ROLE_TITLE[u.role]}</Text>
              {!u.is_active ? <Text style={[type.small, { color: colors.danger }]}>заблокирован</Text> : null}
            </View>
          </Pressable>
        )}
      />
      {selected ? <UserSheet user={selected} isMe={selected.id === me?.id} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); void list.reload(); }} /> : null}
      <CreateUserSheet visible={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); void list.reload(); }} />
    </View>
  );
}

// Смена роли и блокировка с подтверждением (ПИ-05)
function UserSheet({ user, isMe, onClose, onChanged }: { user: AdminUser; isMe: boolean; onClose: () => void; onChanged: () => void }) {
  const [role, setRole] = useState<Role>(user.role);
  const [confirm, setConfirm] = useState<null | 'role' | 'block'>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [passDone, setPassDone] = useState(false);

  // Временный пароль при утере доступа: администратор сообщает его пользователю лично
  async function setPassword() {
    setPassError(null);
    try {
      await api(`/admin/users/${user.id}`, { method: 'PATCH', body: { password: tempPassword } });
      setTempPassword('');
      setPassDone(true);
    } catch (e) {
      setPassError((e as Error).message);
    }
  }
  if (confirm) {
    const block = confirm === 'block';
    return (
      <ConfirmSheet
        visible
        title={block ? (user.is_active ? 'Заблокировать?' : 'Разблокировать?') : 'Сменить роль?'}
        text={block
          ? (user.is_active ? `${user.full_name} не сможет войти в систему. Данные и история сохранятся.` : `${user.full_name} снова сможет войти.`)
          : `Роль изменится с «${ROLE_TITLE[user.role]}» на «${ROLE_TITLE[role]}». Права применяются со следующего запроса пользователя.`}
        confirm={block ? (user.is_active ? 'Заблокировать' : 'Разблокировать') : 'Сменить роль'}
        danger={block && user.is_active}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await api(`/admin/users/${user.id}`, { method: 'PATCH', body: block ? { is_active: !user.is_active } : { role } });
          onChanged();
        }}
      />
    );
  }
  return (
    <Sheet visible onClose={onClose} title={user.full_name} subtitle={user.email}
      footer={isMe ? <Banner text="Свою роль и доступ изменить нельзя" tone="accent" /> : <>
        <Button title="Сохранить роль" disabled={role === user.role} onPress={() => setConfirm('role')} />
        <Button title={user.is_active ? 'Заблокировать' : 'Разблокировать'} variant={user.is_active ? 'danger' : 'secondary'} onPress={() => setConfirm('block')} />
      </>}
    >
      {user.phone ? <Text style={type.body}>{user.phone}</Text> : null}
      <View style={{ gap: space.sm }}>
        <Text style={type.caption}>Роль</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {ROLES.map((r) => <Chip key={r} label={ROLE_TITLE[r]} active={role === r} onPress={() => !isMe && setRole(r)} />)}
        </View>
      </View>
      {!isMe ? (
        <View style={{ gap: space.sm }}>
          <Field label="Временный пароль" value={tempPassword} onChangeText={setTempPassword} hint="Не менее 10 символов; сообщите его пользователю лично" error={passError} secureTextEntry />
          {passDone ? <Banner text="Пароль изменён" tone="accent" /> : null}
          <Button title="Задать временный пароль" variant="secondary" compact disabled={tempPassword.length < 10} onPress={setPassword} />
        </View>
      ) : null}
    </Sheet>
  );
}

function CreateUserSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [role, setRole] = useState<Role>('manager');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api('/admin/users', { method: 'POST', body: { ...form, phone: form.phone || undefined, role } });
      setForm({ full_name: '', email: '', phone: '', password: '' });
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet visible={visible} onClose={onClose} title="Новый пользователь"
      footer={<>{error ? <Banner text={error} /> : null}<Button title="Создать" onPress={save} loading={busy} /></>}>
      <Field label="ФИО" value={form.full_name} onChangeText={set('full_name')} />
      <Field label="Электронная почта" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Телефон" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field label="Временный пароль" value={form.password} onChangeText={set('password')} hint="Не менее 10 символов" secureTextEntry />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {ROLES.map((r) => <Chip key={r} label={ROLE_TITLE[r]} active={role === r} onPress={() => setRole(r)} />)}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontWeight: '700', fontSize: 15 },
});
