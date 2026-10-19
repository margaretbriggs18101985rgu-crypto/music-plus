import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { clearHistoryList, getSearchHistory, removeHistoryWord } from '@/core/search/search'
import { Icon } from '@/components/common/Icon'
import { getDesignTokens } from '@/theme/design'

interface HistorySearchProps {
  onSearch: (keyword: string) => void
}

export default ({ onSearch }: HistorySearchProps) => {
  const [list, setList] = useState<string[] | null>(null)
  const t = useI18n()
  const colors = getDesignTokens(useTheme())

  useEffect(() => {
    let cancelled = false
    void getSearchHistory().then(list => {
      if (!cancelled) setList(list)
    })
    return () => { cancelled = true }
  }, [])

  const handleClear = () => {
    clearHistoryList()
    setList([])
  }
  const handleRemove = (keyword: string) => {
    if (!list) return
    const index = list.indexOf(keyword)
    if (index < 0) return
    removeHistoryWord(index)
    setList(list.filter(item => item != keyword))
  }

  return (
    <View>
      <View style={styles.titleContent}>
        <Text size={18} style={styles.title}>{t('search_history_search')}</Text>
        {list?.length ? (
          <Button
            onPress={handleClear}
            style={styles.titleBtn}
            accessibilityRole="button"
            accessibilityLabel={t('search_history_clear')}
          >
            <Icon name="eraser" color={colors.muted} size={18} />
          </Button>
        ) : null}
      </View>
      <View style={styles.list}>
        {list?.map(keyword => (
          <Button
            key={keyword}
            style={{ ...styles.button, borderColor: colors.border }}
            onPress={() => { onSearch(keyword) }}
            onLongPress={() => { handleRemove(keyword) }}
            accessibilityRole="button"
            accessibilityLabel={keyword}
            accessibilityHint={t('search_history_remove_hint')}
          >
            <Text color={colors.text} size={14} numberOfLines={1} style={styles.keyword}>{keyword}</Text>
          </Button>
        ))}
      </View>
      {list && !list.length ? <Text color={colors.muted} size={14} style={styles.empty}>{t('search_history_empty')}</Text> : null}
    </View>
  )
}

const styles = createStyle({
  titleContent: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flexShrink: 1,
  },
  titleBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  button: {
    maxWidth: '100%',
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 22,
    marginRight: 8,
    marginTop: 8,
  },
  keyword: {
    flexShrink: 1,
  },
  empty: {
    paddingVertical: 12,
  },
})
