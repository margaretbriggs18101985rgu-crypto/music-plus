import { View } from 'react-native'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { getDesignTokens } from '@/theme/design'


interface Props {
  title: string
  children: React.ReactNode | React.ReactNode[]
}

export default ({ title, children }: Props) => {
  const theme = useTheme()
  const colors = getDesignTokens(theme)

  return (
    <View style={styles.container}>
      <Text style={styles.title} color={colors.text} size={17} >{title}</Text>
      <View>
        {children}
      </View>
    </View>
  )
}


const styles = createStyle({
  container: {
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 20,
    marginBottom: 8,
    // paddingLeft: 10,
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  title: {
    fontWeight: '600',
    marginBottom: 14,
    // lineHeight: 16,
  },
})
