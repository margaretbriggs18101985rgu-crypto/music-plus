import { memo } from 'react'

// import Section from '../../components/Section'
import Theme from './Theme'
import IsDynamicBg from './IsDynamicBg'
import IsFontShadow from './IsFontShadow'
import Wallpaper from './Wallpaper'
import PageTypography from './PageTypography'
// import { useI18n } from '@/lang/i18n'

export default memo(() => {
  return (
    <>
      <Theme />
      <IsDynamicBg />
      <IsFontShadow />
      <PageTypography />
      <Wallpaper />
    </>
  )
})
