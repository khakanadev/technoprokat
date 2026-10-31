import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradientFallback } from '../components/Gradient';
import { Banner, Button, Field } from '../components/ui';
import { mediaUrl } from '../lib/api';
import { useSession } from '../lib/session';
import { colors, space, type } from '../lib/theme';

export default function Login() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Введите адрес электронной почты и пароль');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Image source={{ uri: mediaUrl('plate-compactor.jpg') }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradientFallback />
          <View style={styles.brand}>
            <Text style={type.caption}>Прокат инструмента · Калининград</Text>
            <Text style={[type.title, { fontSize: 34 }]}>ТехноПрокат</Text>
          </View>
        </View>
        <View style={styles.form}>
          <Field
            label="Электронная почта" value={email} onChangeText={setEmail}
            autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email"
            returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} placeholder="name@mail.ru"
          />
          <Field
            ref={passwordRef} label="Пароль" value={password} onChangeText={setPassword}
            secureTextEntry autoComplete="password" returnKeyType="go" onSubmitEditing={submit}
          />
          {error ? <Banner text={error} /> : null}
          <Button title="Войти" onPress={submit} loading={busy} />
          <Link href="/register" asChild>
            <Button title="Создать учётную запись" variant="ghost" />
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { height: 340, justifyContent: 'flex-end', backgroundColor: colors.surface },
  brand: { padding: space.xl, gap: space.xs },
  form: { padding: space.xl, gap: space.lg, flex: 1 },
});
