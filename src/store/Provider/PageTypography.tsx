import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useSettingValue } from '@/store/setting/hook'
import { PAGE_FONTS, normalizePageFont, normalizePageColor } from '@/utils/pageAppearance'

const Context = createContext<{ fontFamily?: string, color: string }>({ color: '' })
export const usePageTypography = () => useContext(Context)
export default ({ children }: { children: ReactNode }) => {
  const font = useSettingValue('theme.pageFontFamily')
  const color = useSettingValue('theme.pageFontColor')
  const value = useMemo(() => ({
    fontFamily: PAGE_FONTS.find(item => item.id == normalizePageFont(font))?.family,
    color: normalizePageColor(color),
  }), [font, color])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
