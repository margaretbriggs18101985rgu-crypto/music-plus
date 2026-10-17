import { forwardRef, type Ref, useImperativeHandle, useMemo, useState } from 'react'
import InlineOptions from '@/components/common/InlineOptions'
import { useI18n } from '@/lang'

import { useSettingValue } from '@/store/setting/hook'

type Sources = Readonly<Array<LX.OnlineSource | 'all'>>

export interface SourceSelectorProps<S extends Sources> {
  fontSize?: number
  center?: boolean
  onSourceChange: (source: S[number]) => void
}

export interface SourceSelectorType<S extends Sources> {
  setSourceList: (list: S, activeSource: S[number]) => void
}

export const useSourceListI18n = (list: Sources) => {
  const sourceNameType = useSettingValue('common.sourceNameType')
  const t = useI18n()
  return useMemo(() => {
    return list.map(s => ({ label: t(`source_${sourceNameType}_${s}`), action: s }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, sourceNameType, t])
}

const Component = <S extends Sources>({ fontSize = 13, onSourceChange }: SourceSelectorProps<S>, ref: Ref<SourceSelectorType<S>>) => {
  const [list, setList] = useState([] as unknown as S)
  const [source, setSource] = useState<S[number]>('kw')

  useImperativeHandle(ref, () => ({
    setSourceList(list, activeSource) {
      setList(list)
      setSource(activeSource)
    },
  }), [])

  const sourceList_t = useSourceListI18n(list)

  const handleChangeSource = (action: S[number]) => {
    onSourceChange(action)
    setSource(action)
  }

  return <InlineOptions value={source} options={sourceList_t.map(item => ({ value: item.action, label: item.label }))} onChange={handleChangeSource} size={fontSize} />
}

export default forwardRef(Component) as <S extends Sources>(p: SourceSelectorProps<S> & { ref?: Ref<SourceSelectorType<S>> }) => JSX.Element | null
