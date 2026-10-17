import { forwardRef, useImperativeHandle, useState } from 'react'
import InlineOptions, { OFFICIAL_PLATFORMS } from '@/components/common/InlineOptions'
import { type Source } from '@/store/leaderboard/state'
export interface SourceSelectorProps { onSourceChange: (source: Source) => void }
export interface SourceSelectorType { setSource: (source: Source) => void }
export default forwardRef<SourceSelectorType, SourceSelectorProps>(({ onSourceChange }, ref) => {
  const [source, setSource] = useState<Source>('wy')
  useImperativeHandle(ref, () => ({ setSource }), [])
  const handleChange = (next: Source) => {
    setSource(next)
    onSourceChange(next)
  }
  return <InlineOptions value={source} options={OFFICIAL_PLATFORMS} onChange={handleChange} size={12} style={{ width: 148, flexShrink: 0 }} />
})
