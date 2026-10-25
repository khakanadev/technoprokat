// Нижний лист (bottom sheet) с последовательными шагами: шаги сменяют друг друга внутри одного листа,
// индикатор показывает, где находится пользователь (видимость состояния)
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, X } from 'lucide-react-native';
import { colors, radius, space, type } from '../lib/theme';

export function Sheet({
  visible, onClose, title, subtitle, step, steps, onBack, children, footer,
}: {
  visible: boolean; onClose: () => void; title: string; subtitle?: string;
  step?: number; steps?: number; onBack?: () => void; children: ReactNode; footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [shift] = useState(() => new Animated.Value(1));
  const [fade] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    shift.setValue(1);
    fade.setValue(0);
    Animated.parallel([
      Animated.timing(shift, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, [visible, shift, fade]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: fade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Закрыть" />
        </Animated.View>
        <Animated.View
          style={[styles.sheet, {
            paddingBottom: Math.max(insets.bottom, space.lg),
            transform: [{ translateY: shift.interpolate({ inputRange: [0, 1], outputRange: [0, 600] }) }],
          }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            {onBack ? (
              <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Назад" style={styles.headerBtn}>
                <ChevronLeft size={22} color={colors.text} />
              </Pressable>
            ) : <View style={styles.headerBtn} />}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={type.h3} numberOfLines={1}>{title}</Text>
              {subtitle ? <Text style={type.small} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Закрыть" style={styles.headerBtn}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          {steps && steps > 1 ? (
            <View style={styles.steps}>
              {Array.from({ length: steps }, (_, i) => (
                <View key={i} style={[styles.stepDot, { backgroundColor: i <= (step ?? 0) ? colors.accent : colors.border }]} />
              ))}
            </View>
          ) : null}
          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, width: '100%', maxWidth: 560, alignSelf: 'center',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.sm },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  steps: { flexDirection: 'row', gap: 6, paddingHorizontal: space.lg, paddingTop: space.sm },
  stepDot: { flex: 1, height: 3, borderRadius: 2 },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm },
});
