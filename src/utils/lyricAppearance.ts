export const normalizeLyricColor = (input: string): string | null => {
  const hex = input.trim().replace(/^#/, '')
  if (/^[\da-f]{3}$/i.test(hex)) return '#' + hex.split('').map(value => value + value).join('').toUpperCase()
  return /^[\da-f]{6}$/i.test(hex) ? '#' + hex.toUpperCase() : null
}

export const LYRIC_FONTS = [
  { id: 'system', name: '默认字体', detail: '清晰简洁', family: undefined },
  { id: 'wenkai', name: '霞鹜文楷', detail: '自然手写', family: 'LyricWenKai' },
  { id: 'xiaowei', name: '站酷小薇', detail: '文艺宋体', family: 'LyricXiaoWei' },
  { id: 'huangyou', name: '站酷庆科黄油体', detail: '圆润醒目', family: 'LyricHuangYou' },
] as const

export const normalizeLyricFont = (value: unknown): LX.AppSetting['player.lyricFontFamily'] =>
  LYRIC_FONTS.find(font => font.id === value)?.id ?? 'system'
