import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { forwardRef, useImperativeHandle, useState } from 'react'


export interface CurrentTagBtnProps {
  onShowList: () => void
  expanded?: boolean
}

export interface CurrentTagBtnType {
  setCurrentTagInfo: (name: string) => void
}

export default forwardRef<CurrentTagBtnType, CurrentTagBtnProps>(({ onShowList, expanded = false }, ref) => {
  const t = useI18n()
  const [name, setName] = useState('')

  useImperativeHandle(ref, () => ({
    setCurrentTagInfo(name) {
      if (!name) name = t('songlist_tag_default')
      setName(name)
    },
  }))

  return (
    <Button style={styles.btn} onPress={onShowList} accessibilityRole="button" accessibilityLabel={expanded ? '收起歌单分类' : '展开歌单分类'}>
      <Text style={styles.sourceMenu}>{name}</Text>
      <Icon name="chevron-right" size={10} style={{ marginLeft: 4, transform: [{ rotate: expanded ? '270deg' : '90deg' }] }} />
    </Button>
  )
})


const styles = createStyle({
  btn: {
    paddingLeft: 15,
    paddingRight: 15,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceMenu: {
    // height: 38,
    // lineHeight: 38,
    textAlign: 'center',
    // minWidth: 70,
    // paddingTop: 10,
    // paddingBottom: 10,
  },
})
