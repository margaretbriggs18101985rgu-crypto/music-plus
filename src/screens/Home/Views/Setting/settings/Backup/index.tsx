import { useI18n } from '@/lang'
import { memo } from 'react'

import Section from '../../components/Section'
import Part from './Part'
import CompleteBackup from './CompleteBackup'
// import MaxCache from './MaxCache'

export default memo(() => {
  const t = useI18n()

  return (
    <Section title={t('setting_backup')}>
      <CompleteBackup />
      <Part />
      {/* <MaxCache /> */}
    </Section>
  )
})
