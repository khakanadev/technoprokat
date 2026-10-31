import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputInstance, type TextInputProps, type ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { accentAlpha, colors, hit, radius, space, type } from '../lib/theme';
import type { StatusCode } from '../lib/api';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title, onPress, variant = 'primary', icon: Icon, loading, disabled, style, compact,
}: {
  title: string; onPress?: () => void; variant?: Variant; icon?: LucideIcon;
  loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; compact?: boolean;
}) {
  const palette = {
    primary: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
    secondary: { bg: colors.surfaceRaised, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.textMuted, border: 'transparent' },
    danger: { bg: 'transparent', fg: colors.danger, border: colors.border },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: off ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : (
        <>
          {Icon ? <Icon size={18} color={palette.fg} strokeWidth={2.2} /> : null}
          <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon: Icon, onPress, label, active, style }: {
  icon: LucideIcon; onPress?: () => void; label: string; active?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, active && { backgroundColor: colors.accent }, { opacity: pressed ? 0.75 : 1 }, style]}
    >
      <Icon size={20} color={active ? colors.onAccent : colors.text} strokeWidth={2.2} />
    </Pressable>
  );
}

export function Chip({ label, active, onPress, count }: { label: string; active?: boolean; onPress?: () => void; count?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: colors.text, borderColor: colors.text }]}
    >
      <Text style={[styles.chipText, active && { color: colors.bg }]}>{label}</Text>
      {count !== undefined ? <Text style={[styles.chipCount, active && { color: colors.bg }]}>{count}</Text> : null}
    </Pressable>
  );
}

export const Field = forwardRef<TextInputInstance, TextInputProps & { label: string; error?: string | null; hint?: string }>(
  function Field({ label, error, hint, style, ...props }, ref) {
    return (
      <View style={{ gap: space.xs }}>
        <Text style={type.caption}>{label}</Text>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textDim}
          style={[styles.input, error ? { borderColor: colors.danger } : null, style]}
          {...props}
        />
        {error ? <Text style={[type.small, { color: colors.danger }]}>{error}</Text> : hint ? <Text style={type.small}>{hint}</Text> : null}
      </View>
    );
  },
);

export function Card({ children, style, onPress, ...rest }: { children: ReactNode; style?: StyleProp<ViewStyle> } & PressableProps) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }, style]} {...rest}>
      {children}
    </Pressable>
  );
}

const STATUS_STYLE: Record<StatusCode, { fg: string; bg: string }> = {
  new: { fg: colors.onAccent, bg: colors.accent },
  confirmed: { fg: colors.accent, bg: accentAlpha(0.14) },
  issued: { fg: colors.text, bg: colors.surfaceRaised },
  returned: { fg: colors.accent, bg: accentAlpha(0.14) },
  closed: { fg: colors.textDim, bg: 'transparent' },
  cancelled: { fg: colors.textDim, bg: 'transparent' },
};

export function StatusBadge({ code, title, overdue }: { code: StatusCode; title: string; overdue?: boolean }) {
  if (overdue) {
    return <View style={[styles.badge, { backgroundColor: 'rgba(242,85,90,0.15)' }]}><Text style={[styles.badgeText, { color: colors.danger }]}>Просрочена</Text></View>;
  }
  const s = STATUS_STYLE[code];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg, borderColor: s.bg === 'transparent' ? colors.border : s.bg }]}>
      <Text style={[styles.badgeText, { color: s.fg }]}>{title}</Text>
    </View>
  );
}

export function Row({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={type.small}>{label}</Text>
      {typeof value === 'string' ? <Text style={[strong ? type.h3 : type.body, type.number]}>{value}</Text> : value}
    </View>
  );
}

export function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Icon size={26} color={colors.textMuted} /></View>
      <Text style={type.h3}>{title}</Text>
      {text ? <Text style={[type.small, { textAlign: 'center' }]}>{text}</Text> : null}
      {action}
    </View>
  );
}

export function Banner({ text, tone = 'danger' }: { text: string; tone?: 'danger' | 'accent' }) {
  const fg = tone === 'danger' ? colors.danger : colors.accent;
  return (
    <View style={[styles.banner, { borderColor: fg, backgroundColor: tone === 'danger' ? 'rgba(242,85,90,0.1)' : accentAlpha(0.1) }]}>
      <Text style={[type.small, { color: fg }]}>{text}</Text>
    </View>
  );
}

export const Divider = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;

const styles = StyleSheet.create({
  button: {
    minHeight: 52, borderRadius: radius.md, paddingHorizontal: space.xl, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
  },
  buttonCompact: { minHeight: hit, paddingHorizontal: space.lg },
  buttonText: { fontSize: 16, fontWeight: '600' },
  iconButton: {
    width: hit, height: hit, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(20,23,28,0.85)', borderWidth: 1, borderColor: colors.border,
  },
  chip: {
    height: 36, borderRadius: radius.pill, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface,
  },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '500' },
  chipCount: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  input: {
    minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, color: colors.text, paddingHorizontal: space.lg, fontSize: 16,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl * 2, paddingHorizontal: space.xl },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  banner: { borderWidth: 1, borderRadius: radius.md, padding: space.md },
});
