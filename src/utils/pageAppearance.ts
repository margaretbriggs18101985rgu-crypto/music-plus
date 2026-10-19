import type { ColorValue } from 'react-native'

export const PAGE_FONTS = [
  { id: 'system', name: '系统默认', family: undefined },
  { id: 'wenkai', name: '霞鹜文楷', family: 'PageWenKai' },
  { id: 'xiaowei', name: '站酷小薇', family: 'PageXiaoWei' },
  { id: 'huangyou', name: '站酷庆科黄油体', family: 'PageHuangYou' },
] as const
export type PageFont = typeof PAGE_FONTS[number]['id']
export const normalizePageFont = (value: unknown): PageFont => PAGE_FONTS.find(font => font.id === value)?.id ?? 'system'
export const normalizePageColor = (value: unknown): string => {
  if (typeof value != 'string') return ''
  const hex = value.trim().replace(/^#/, '')
  if (/^[\da-f]{3}$/i.test(hex)) return '#' + hex.split('').map(char => char + char).join('').toUpperCase()
  return /^[\da-f]{6}$/i.test(hex) ? '#' + hex.toUpperCase() : ''
}

// Preserve semantic colors and explicit previews; recolor neutral page text only.
export const resolvePageTextColor = (color: ColorValue, custom: string, theme: LX.ActiveTheme): ColorValue => {
  if (!custom || typeof color != 'string') return color
  const value = color.toUpperCase()
  const primary = [theme['c-font'], theme['c-primary-font'], theme['c-button-font'], '#F3F3F5', '#1B1B20', '#F0F0F2', '#FFFFFF']
  const secondary = [theme['c-font-label'], '#929298', '#72727A', '#99999F', '#888888', '#888', '#999']
  if (primary.some(item => item.toUpperCase() == value)) return custom
  if (secondary.some(item => item.toUpperCase() == value)) return custom + 'A3'
  return color
}
