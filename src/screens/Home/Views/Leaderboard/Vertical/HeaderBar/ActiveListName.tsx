import { forwardRef, useImperativeHandle, useState } from 'react'
import { TouchableOpacity } from 'react-native'

import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'

export interface ActiveListNameProps {
  onShowBound: () => void
  expanded?: boolean
}
export interface ActiveListNameType {
  setBound: (id: string, name: string) => void
}

export default forwardRef<ActiveListNameType, ActiveListNameProps>(({ onShowBound, expanded = false }, ref) => {
  const theme = useTheme()
  let [currentListName, setCurrentListName] = useState('')

  useImperativeHandle(ref, () => ({
    setBound(id, name) {
      setCurrentListName(name)
    },
  }), [])

  return (
    <TouchableOpacity disabled={currentListName == '同步中…'} accessibilityRole="button" accessibilityLabel="选择榜单类型" onPress={onShowBound} style={styles.currentList}>
      <Text numberOfLines={1} style={styles.currentListText} color={theme['c-button-font']}>{currentListName}</Text>
      <Icon name="chevron-right" size={10} style={{ marginRight: 18, transform: [{ rotate: expanded ? '270deg' : '90deg' }] }} />
    </TouchableOpacity>
  )
})


const styles = createStyle({
  currentList: {
    flex: 1,
    flexDirection: 'row',
    paddingRight: 2,
    // height: 36,
    alignItems: 'center',
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  currentListIcon: {
    paddingLeft: 15,
    paddingRight: 10,
    // paddingTop: 10,
    // paddingBottom: 0,
  },
  currentListText: {
    flex: 1,
    // minWidth: 70,
    // paddingLeft: 10,
    paddingRight: 10,
    // paddingTop: 10,
    // paddingBottom: 10,
  },
})
