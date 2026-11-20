import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Banner, Button, Field, IconButton } from '../components/ui';
import { useSession } from '../lib/session';
import { colors, space, type } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { signUp } = useSession();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  function validate() {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = 'Укажите ФИО';
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'Некорректный адрес';
    if (form.phone && !/^\+?[0-9]{10,15}$/.test(form.phone)) e.phone = 'От 10 до 15 цифр, можно с «+»';
    if (form.password.length < 10) e.password = 'Не менее 10 символов';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function submit() {
    setError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      await signUp({ ...form, email: form.email.trim(), phone: form.phone || undefined });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space.md }]} keyboardShouldPersistTaps="handled">
        <IconButton icon={ChevronLeft} label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))} />
        <View style={{ gap: space.xs }}>
          <Text style={type.title}>Регистрация</Text>
          <Text style={type.small}>Данные нужны только для оформления аренды и связи с вами.</Text>
        </View>
        <Field label="ФИО" value={form.full_name} onChangeText={set('full_name')} error={errors.full_name} autoComplete="name" />
        <Field label="Электронная почта" value={form.email} onChangeText={set('email')} error={errors.email} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Телефон (необязательно)" value={form.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" placeholder="+79110000000" />
        <Field label="Пароль" value={form.password} onChangeText={set('password')} error={errors.password} hint="Не менее 10 символов" secureTextEntry />
        {error ? <Banner text={error} /> : null}
        <Button title="Создать учётную запись" onPress={submit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: space.xl, gap: space.lg } });
