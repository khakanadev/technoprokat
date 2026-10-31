import { useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react-native';
import { ScreenHeader } from '../../components/Screen';
import { Banner, Button, Card, Divider, IconButton } from '../../components/ui';
import { apiText } from '../../lib/api';
import { MONTHS_SHORT, rub } from '../../lib/format';
import { accentAlpha, colors, radius, space, type } from '../../lib/theme';
import { useApi } from '../../lib/useApi';

interface Month { month: number; rentals_count: number; closed_count: number; revenue: number }
interface Top { id: number; name: string; category: string; rentals_count: number }

export default function Reports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [metric, setMetric] = useState<'revenue' | 'rentals_count'>('revenue');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const report = useApi<Month[]>(`/reports/monthly?year=${year}`);
  const top = useApi<Top[]>('/reports/top');
  const months = report.data ?? [];
  const max = Math.max(1, ...months.map((m) => m[metric]));
  const revenue = months.reduce((s, m) => s + m.revenue, 0);
  const count = months.reduce((s, m) => s + m.rentals_count, 0);
  const closed = months.reduce((s, m) => s + m.closed_count, 0);

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const csv = await apiText(`/reports/monthly.csv?year=${year}`);
      const name = `technoprokat_report_${year}.csv`;
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const file = new File(Paths.cache, name);
        if (file.exists) file.delete();
        file.create();
        await file.write(csv);
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Отчёт ТехноПрокат', UTI: 'public.comma-separated-values-text' });
      }
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Отчёты"
        subtitle="Аренды и выручка"
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <IconButton icon={ChevronLeft} label="Предыдущий год" onPress={() => setYear(year - 1)} />
            <Text style={[type.h3, type.number, { width: 48, textAlign: 'center' }]}>{year}</Text>
            <IconButton icon={ChevronRight} label="Следующий год" onPress={() => setYear(year + 1)} />
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg, maxWidth: 560, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={report.refreshing} onRefresh={report.reload} tintColor={colors.accent} />}
      >
        {report.error ? <Banner text={report.error} /> : null}
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Card style={styles.tile}><Text style={type.caption}>Выручка</Text><Text style={[type.h2, type.number]}>{rub(revenue)}</Text><Text style={type.small}>по {closed} закрытым</Text></Card>
          <Card style={styles.tile}><Text style={type.caption}>Аренд</Text><Text style={[type.h2, type.number]}>{count}</Text><Text style={type.small}>за {year} год</Text></Card>
        </View>

        <Card style={{ padding: space.lg, gap: space.lg }}>
          <View style={styles.segment}>
            {([['revenue', 'Выручка'], ['rentals_count', 'Число аренд']] as const).map(([k, label]) => (
              <Text key={k} onPress={() => setMetric(k)} style={[styles.segmentItem, metric === k && styles.segmentActive]} accessibilityRole="button">{label}</Text>
            ))}
          </View>
          <View style={styles.chart} accessibilityLabel="График по месяцам">
            {months.map((m) => {
              const v = m[metric];
              return (
                <View key={m.month} style={styles.col}>
                  <Text style={styles.colValue} numberOfLines={1}>{v ? (metric === 'revenue' ? `${Math.round(v / 1000)}к` : v) : ''}</Text>
                  <View style={styles.colTrack}>
                    <View style={[styles.colBar, { height: `${(v / max) * 100}%`, backgroundColor: v ? colors.accent : 'transparent' }]} />
                  </View>
                  <Text style={styles.colLabel}>{MONTHS_SHORT[m.month - 1]}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        <Card>
          <View style={[styles.tr, styles.th]}>
            <Text style={[styles.td, type.caption, { flex: 1.3 }]}>Месяц</Text>
            <Text style={[styles.td, type.caption]}>Аренд</Text>
            <Text style={[styles.td, type.caption]}>Закрыто</Text>
            <Text style={[styles.td, type.caption, { flex: 1.6, textAlign: 'right' }]}>Выручка</Text>
          </View>
          {months.filter((m) => m.rentals_count).map((m, i) => (
            <View key={m.month}>
              {i ? <Divider /> : null}
              <View style={styles.tr}>
                <Text style={[styles.td, type.body, { flex: 1.3 }]}>{MONTHS_SHORT[m.month - 1]}</Text>
                <Text style={[styles.td, type.body, type.number]}>{m.rentals_count}</Text>
                <Text style={[styles.td, type.body, type.number]}>{m.closed_count}</Text>
                <Text style={[styles.td, type.body, type.number, { flex: 1.6, textAlign: 'right' }]}>{rub(m.revenue)}</Text>
              </View>
            </View>
          ))}
          {!count && !report.loading ? <Text style={[type.small, { padding: space.lg }]}>За {year} год аренд нет</Text> : null}
        </Card>

        {exportError ? <Banner text={exportError} /> : null}
        <Button title="Выгрузить CSV" icon={Download} variant="secondary" onPress={exportCsv} loading={exporting} />

        <View style={{ gap: space.sm }}>
          <Text style={type.caption}>Популярная техника</Text>
          <Card>
            {(top.data ?? []).slice(0, 5).map((t, i) => (
              <View key={t.id}>
                {i ? <Divider /> : null}
                <View style={[styles.tr, { gap: space.md }]}>
                  <Text style={[type.h3, type.number, { width: 20, color: colors.textDim }]}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={type.body} numberOfLines={1}>{t.name}</Text>
                    <Text style={type.small}>{t.category}</Text>
                  </View>
                  <Text style={[type.body, type.number]}>{t.rentals_count}</Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, padding: space.lg, gap: 4 },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceRaised, borderRadius: radius.md, padding: 3 },
  segmentItem: { flex: 1, textAlign: 'center', paddingVertical: 9, borderRadius: radius.sm, color: colors.textMuted, fontWeight: '600', fontSize: 14, overflow: 'hidden' },
  segmentActive: { backgroundColor: colors.surface, color: colors.text },
  chart: { flexDirection: 'row', height: 180, gap: 4, alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  colValue: { fontSize: 9, color: colors.textMuted, fontWeight: '600' },
  colTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', backgroundColor: accentAlpha(0.05), borderRadius: 4 },
  colBar: { width: '100%', borderRadius: 4 },
  colLabel: { fontSize: 10, color: colors.textDim },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, minHeight: 44 },
  th: { backgroundColor: colors.surfaceRaised },
  td: { flex: 1 },
});
