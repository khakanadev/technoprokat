import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space, type } from '../lib/theme';

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={type.caption}>{subtitle}</Text> : null}
        <Text style={type.title}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.md, backgroundColor: colors.bg },
});
