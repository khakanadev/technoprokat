// Затемнение нижней части фотографии, чтобы текст поверх фото оставался читаемым.
// На телефоне — CSS-градиент из стилей React Native (backgroundImage); react-native-web это свойство
// не передаёт, поэтому в веб-версии градиент собирается из тонких полос.
import { Platform, StyleSheet, View } from 'react-native';
import { colors } from '../lib/theme';

function rgba(hex: string, a: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const WEB_STEPS = 48;

export function LinearGradientFallback({ from = 0.25, color = colors.bg }: { from?: number; color?: string }) {
  if (Platform.OS === 'web') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: from * WEB_STEPS / (1 - from) }} />
        {Array.from({ length: WEB_STEPS }, (_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: rgba(color, ((i + 1) / WEB_STEPS) ** 1.4) }} />
        ))}
      </View>
    );
  }
  const start = Math.round(from * 100);
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, {
        backgroundImage: `linear-gradient(to bottom, ${rgba(color, 0)} ${start}%, ${rgba(color, 0.55)} ${Math.round(start + (100 - start) * 0.5)}%, ${rgba(color, 1)} 100%)`,
      }]}
    />
  );
}
