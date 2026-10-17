import { useRef, forwardRef, useImperativeHandle } from 'react'
import { View } from 'react-native'

// import music from '@/utils/musicSdk'
import { getDesignTokens } from '@/theme/design'
// import InsetShadow from 'react-native-inset-shadow'
import SearchInput, { type SearchInputType, type SearchInputProps } from './SearchInput'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
export interface HeaderBarProps {
  onTipSearch: SearchInputProps['onChangeText']
  onSearch: SearchInputProps['onSubmit']
  onHideTipList: SearchInputProps['onBlur']
  onShowTipList: SearchInputProps['onTouchStart']
}

export interface HeaderBarType {
  setText: SearchInputType['setText']
  blur: SearchInputType['blur']
}


export default forwardRef<HeaderBarType, HeaderBarProps>(({ onTipSearch, onSearch, onHideTipList, onShowTipList }, ref) => {
  const searchInputRef = useRef<SearchInputType>(null)
  const theme = useTheme()
  const colors = getDesignTokens(theme)

  useImperativeHandle(ref, () => ({
    setText(text) {
      searchInputRef.current?.setText(text)
    },
    blur() {
      searchInputRef.current?.blur()
    },
  }), [])


  return (
    <View>
      <View style={{ ...styles.searchBar, backgroundColor: colors.surface }}>
      <SearchInput
        ref={searchInputRef}
        onChangeText={onTipSearch}
        onSubmit={onSearch}
        onBlur={onHideTipList}
        onTouchStart={onShowTipList}
      />
      </View>
    </View>
  )
})

const styles = createStyle({
  searchBar: {
    flexDirection: 'row',
    height: 44,
    zIndex: 2,
    paddingRight: 10,
    borderRadius: 8,
    marginHorizontal: 18,
    marginBottom: 8,
    alignItems: 'center',
  },
})
