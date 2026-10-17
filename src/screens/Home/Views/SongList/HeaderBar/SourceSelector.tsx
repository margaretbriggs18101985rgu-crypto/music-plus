import { forwardRef, useImperativeHandle, useState } from 'react'
import { View, type ViewStyle } from 'react-native'
import InlineOptions, { OFFICIAL_PLATFORMS } from '@/components/common/InlineOptions'
import { type Source } from '@/store/songlist/state'
export interface SourceSelectorProps { onSourceChange: (source: Source) => void, style?: ViewStyle }
export interface SourceSelectorType { setSource: (source: Source) => void }
export default forwardRef<SourceSelectorType, SourceSelectorProps>(({ onSourceChange, style }, ref) => {
  const [source, setSource] = useState<Source>('wy')
  useImperativeHandle(ref, () => ({ setSource }), [])
  const handleChange = (next: Source) => {
    setSource(next)
    onSourceChange(next)
  }
  return <View style={[{ width: 148 }, style]}><InlineOptions value={source} options={OFFICIAL_PLATFORMS} onChange={handleChange} size={12} /></View>
})
