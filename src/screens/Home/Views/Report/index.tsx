import { useCallback, useEffect, useMemo, useState } from 'react'
import { DeviceEventEmitter, ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import CheckBox from '@/components/common/CheckBox'
import Button from '@/screens/Home/Views/Setting/components/Button'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { getDesignTokens } from '@/theme/design'
import { useI18n } from '@/lang'
import {
  clearListeningHistory,
  getListeningReport,
  LIBRARY_EVENT,
  type ListeningReport,
  type ListeningReportPeriod,
} from '@/core/music/library'

const PERIODS: ListeningReportPeriod[] = ['day', 'week', 'month', 'year']
const languageLabels: Record<string, string> = { zh: 'ui_recommend_language_zh', yue: 'ui_recommend_language_yue', en: 'ui_recommend_language_en', ja: 'ui_recommend_language_ja', ko: 'ui_recommend_language_ko' }
const styleLabels: Record<string, string> = {
  rock: 'report_style_rock',
  rap: 'report_style_rap',
  rnb: 'report_style_rnb',
  electronic: 'report_style_electronic',
  folk: 'report_style_folk',
  jazz: 'report_style_jazz',
  classical: 'report_style_classical',
  anime: 'report_style_anime',
  instrumental: 'report_style_instrumental',
  pop: 'report_style_pop',
  country: 'report_style_country',
  metal: 'report_style_metal',
}

const formatDuration = (seconds: number, t: ReturnType<typeof useI18n>) => {
  const minutes = Math.max(0, Math.round(seconds / 60))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours) return t('report_duration_hours_minutes', { hours, minutes: rest })
  return t('report_duration_minutes', { minutes })
}

const formatDate = (value: string) => value.slice(5).replace('-', '/')
const formatTimestampDate = (value: number) => {
  const date = new Date(value)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

const Metric = ({ label, value, detail }: { label: string, value: string, detail?: string }) => {
  const colors = getDesignTokens(useTheme())
  return (
    <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text size={12} color={colors.muted}>{label}</Text>
      <Text size={20} style={styles.metricValue} numberOfLines={1}>{value}</Text>
      {detail ? <Text size={12} color={colors.muted} numberOfLines={1}>{detail}</Text> : null}
    </View>
  )
}

const EmptyState = () => {
  const t = useI18n()
  const colors = getDesignTokens(useTheme())
  return <Text size={13} color={colors.muted} style={styles.empty}>{t('report_empty')}</Text>
}

export default () => {
  const t = useI18n()
  const colors = getDesignTokens(useTheme())
  const enabled = useSettingValue('player.isListeningStatsEnabled')
  const [period, setPeriod] = useState<ListeningReportPeriod>('week')
  const [report, setReport] = useState<ListeningReport | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    let mounted = true
    setLoading(true)
    void getListeningReport(period).then(value => {
      if (mounted) setReport(value)
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [period])

  useEffect(load, [load])
  useEffect(() => {
    const listener = DeviceEventEmitter.addListener(LIBRARY_EVENT, load)
    return () => { listener.remove() }
  }, [load])

  const maxHour = useMemo(() => Math.max(1, ...(report?.hourDistribution ?? [])), [report])
  const periodLabel = t(`report_period_${period}` as Parameters<typeof t>[0])
  const handleClear = async() => {
    if (!await confirmDialog({ title: t('report_clear_title'), message: t('report_clear_message'), confirmButtonText: t('report_clear_confirm') })) return
    await clearListeningHistory()
    toast(t('report_clear_success'))
    void load()
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Icon name="leaderboard" size={22} color={colors.accent} />
          <Text size={22} style={styles.title}>{t('report_title')}</Text>
        </View>
        <Text size={13} color={colors.muted}>{t('report_local_only')}</Text>
      </View>

      <View style={[styles.periods, { borderColor: colors.border, backgroundColor: colors.surface }]} accessibilityRole="tablist">
        {PERIODS.map(item => {
          const active = item == period
          return <TouchableOpacity key={item} style={[styles.period, active && { backgroundColor: colors.accent }]} onPress={() => { setPeriod(item) }} accessibilityRole="tab" accessibilityState={{ selected: active }}>
            <Text size={13} color={active ? colors.onAccent : colors.muted}>{t(`report_period_${item}` as Parameters<typeof t>[0])}</Text>
          </TouchableOpacity>
        })}
      </View>

      <View style={styles.actions}>
        <CheckBox check={enabled} label={t('report_enable_stats')} onChange={value => { updateSetting({ 'player.isListeningStatsEnabled': value }) }} />
        <Button onPress={() => { void handleClear() }}>{t('report_clear_history')}</Button>
      </View>

      {loading || !report ? <Text size={13} color={colors.muted} style={styles.loading}>{t('loading')}</Text> : (
        <>
          <Text size={14} color={colors.muted} style={styles.range}>{periodLabel} · {formatTimestampDate(report.startAt)} - {formatTimestampDate(report.endAt - 1)}</Text>
          {!report.hasEvents ? <EmptyState /> : (
            <>
              <View style={styles.metrics}>
                <Metric label={t('report_listened_time')} value={formatDuration(report.listenedSeconds, t)} />
                <Metric label={t('report_play_count')} value={String(report.playCount)} detail={t('report_unique_songs', { count: report.uniqueSongCount })} />
                <Metric label={t('report_top_artist')} value={report.topArtist?.name ?? t('report_no_data')} detail={report.topArtist ? t('report_play_count_short', { count: report.topArtist.playCount }) : undefined} />
                <Metric label={t('report_top_song')} value={report.topSong?.track.name ?? t('report_no_data')} detail={report.topSong?.track.singer} />
                <Metric label={t('report_language')} value={report.topLanguage ? t((languageLabels[report.topLanguage.id] ?? 'report_no_data') as Parameters<typeof t>[0]) : t('report_no_data')} />
                <Metric label={t('report_style')} value={report.topStyle ? t((styleLabels[report.topStyle.id] ?? 'report_no_data') as Parameters<typeof t>[0]) : t('report_no_data')} />
              </View>

              <View style={[styles.section, { borderTopColor: colors.border }]}>
                <Text size={16} style={styles.sectionTitle}>{t('report_time_distribution')}</Text>
                <View style={styles.chart}>
                  {report.hourDistribution.map((count, hour) => <View key={hour} style={styles.barColumn}>
                    <View style={[styles.bar, { height: Math.max(3, Math.round(count / maxHour * 72)), backgroundColor: colors.accent }]} />
                    <Text size={9} color={colors.muted}>{hour % 3 == 0 ? `${hour}` : ''}</Text>
                  </View>)}
                </View>
              </View>

              <View style={[styles.section, { borderTopColor: colors.border }]}>
                <Text size={16} style={styles.sectionTitle}>{t('report_preference_change')}</Text>
                {report.trend.slice(-14).map(item => <View key={item.date} style={styles.trendRow}>
                  <Text size={12} color={colors.muted} style={styles.trendDate}>{formatDate(item.date)}</Text>
                  <View style={styles.trendMain}>
                    <Text size={13} numberOfLines={1}>{item.favoriteSong || t('report_no_data')}</Text>
                    <Text size={11} color={colors.muted}>{t('report_trend_detail', { plays: item.playCount, duration: formatDuration(item.listenedSeconds, t) })}</Text>
                  </View>
                </View>)}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  )
}

const styles = createStyle({
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 36 },
  header: { marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontWeight: '600' },
  periods: { flexDirection: 'row', borderWidth: 1, borderRadius: 6, padding: 3, marginBottom: 14 },
  period: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 36, borderRadius: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  range: { marginBottom: 12 },
  loading: { paddingVertical: 28 },
  empty: { paddingVertical: 32 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '31.8%', minHeight: 88, borderWidth: 1, borderRadius: 6, padding: 10 },
  metricValue: { fontWeight: '600', marginTop: 6, marginBottom: 2 },
  section: { borderTopWidth: 1, marginTop: 24, paddingTop: 18 },
  sectionTitle: { fontWeight: '600', marginBottom: 12 },
  chart: { height: 100, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  barColumn: { width: 9, height: 96, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 7, minHeight: 3, borderRadius: 2, opacity: 0.9 },
  trendRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center' },
  trendDate: { width: 48 },
  trendMain: { flex: 1, paddingLeft: 10 },
})
