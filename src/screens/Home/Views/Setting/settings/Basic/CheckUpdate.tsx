import { memo } from 'react'
import { View } from 'react-native'
import { checkUpdate } from '@/core/version'
import { useVersionInfo } from '@/store/version/hook'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import Button from '../../components/Button'
import SubTitle from '../../components/SubTitle'

export default memo(() => {
  const t = useI18n()
  const info = useVersionInfo()
  return (
    <SubTitle title={t('setting_version_update')}>
      <Text size={13}>{t('version_label_current_ver')}{info.version}</Text>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <Button onPress={() => { void checkUpdate({ manual: true }) }}>{t('version_btn_check')}</Button>
      </View>
    </SubTitle>
  )
})
