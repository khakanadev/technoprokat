// Дизайн-система: тёмная тема, один акцентный цвет из конфигурации (app.json → extra.accentColor)
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as { accentColor?: string };

export const colors = {
  bg: '#0B0D10',
  surface: '#14171C',
  surfaceRaised: '#1B1F26',
  border: '#262B33',
  text: '#F2F4F7',
  textMuted: '#A1A9B5',
  textDim: '#6B7380',
  accent: extra.accentColor ?? '#F5A524',
  onAccent: '#14110A',
  danger: '#F2555A',
  overlay: 'rgba(0,0,0,0.6)',
};

// Полупрозрачный вариант акцента для фонов выделенных элементов
export function accentAlpha(alpha: number) {
  const hex = colors.accent.replace('#', '');
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5, color: colors.text },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3, color: colors.text },
  h3: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, lineHeight: 21, color: colors.text },
  small: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  caption: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const, color: colors.textDim },
  number: { fontVariant: ['tabular-nums' as const] },
};

// Минимальная зона нажатия 44 pt
export const hit = 44;
