import { useEffect, useRef, useState } from 'react'
import { DeviceEventEmitter, Linking, Modal, ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import playerState from '@/store/player/state'
import { getOfficialSongInfo, type OfficialSongInfo } from '@/core/music/officialInfo'
import { getMusicUrl } from '@/core/music'
import { getData, saveData } from '@/plugins/storage'
import { filterFileName } from '@/utils'
import { downloader, forgetDownloadJob, getDownloadJobs, saveDownloadJob, type DownloadStatus, type DownloadJob, type Folder } from '@/core/music/library'

const EVENT = 'lx_showPlayerTool'
export const showPlayerTool = (type: 'info' | 'download') => { DeviceEventEmitter.emit(EVENT, type) }
const FOLDER_KEY = 'musicplus_download_folder'
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

export default () => {
  const theme = useTheme()
  const [view, setView] = useState<'info' | 'download' | null>(null)
  const [track, setTrack] = useState<LX.Music.MusicInfo | null>(null)
  const [details, setDetails] = useState<OfficialSongInfo | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [folder, setFolder] = useState<Folder | null>(null)
  const [job, setJob] = useState<DownloadJob | null>(null)
  const [status, setStatus] = useState<DownloadStatus | null>(null)
  const version = useRef(0)
  const info = async(song: LX.Music.MusicInfo) => {
    const request = ++version.current
    setDetails(null); setError(''); setLoading(true)
    try { const data = await getOfficialSongInfo(song); if (version.current == request) setDetails(data) } catch (error: unknown) { if (version.current == request) setError(errorMessage(error) || '歌曲资料加载失败') } finally { if (version.current == request) setLoading(false) }
  }
  useEffect(() => {
    const listener = DeviceEventEmitter.addListener(EVENT, (type: 'info' | 'download') => {
      const original = playerState.playMusicInfo.musicInfo
      if (!original) return
      const song = 'progress' in original ? original.metadata.musicInfo : original
      setTrack(song); setView(type); setError(''); setStatus(null); setLoading(false)
      if (type == 'info') void info(song)
      else {
        const request = ++version.current
        setJob(null)
        void Promise.all([getDownloadJobs(), getData<Folder>(FOLDER_KEY)]).then(([saved, selected]) => {
          if (request != version.current) return
          setJob(saved.find(job => job.musicId == song.id) ?? null)
          setFolder(selected ?? null)
        })
      }
    })
    return () => { listener.remove() }
  }, [])
  useEffect(() => {
    if (view != 'download' || !job) return
    let active = true
    const poll = () => {
      void downloader.query(job.id).then(value => { if (active) setStatus(value) }).catch((error: unknown) => { if (active) setError(errorMessage(error)) })
    }
    poll()
    const timer = setInterval(poll, 1000)
    return () => { active = false; clearInterval(timer) }
  }, [view, job])
  const download = async() => {
    if (!track || !folder || loading) return
    setLoading(true); setError(''); setStatus(null)
    try {
      const url = await getMusicUrl({ musicInfo: track, quality: '128k', allowToggleSource: false })
      if (!/^https?:\/\//i.test(url) || /\.m3u8(?:\?|$)/i.test(url)) throw new Error('当前音源未提供可下载的音频文件')
      const extension = url.match(/\.(mp3|m4a|flac|wav|ogg|aac)(?:\?|$)/i)?.[1]?.toLowerCase() ?? 'mp3'
      const filename = `${filterFileName(`${track.name} - ${track.singer}`).slice(0, 100)}-${Date.now()}.${extension}`
      const id = await downloader.start(url, filename, track.name, folder.uri)
      const task = { id, musicId: track.id, filename, title: track.name, folderName: folder.name, music: track }
      await saveDownloadJob(task)
      setJob(task)
    } catch (error: unknown) { setError(errorMessage(error) || '下载失败') } finally { setLoading(false) }
  }
  const chooseFolder = async() => {
    try {
      const selected = await downloader.chooseFolder()
      if (!selected) return
      await saveData(FOLDER_KEY, selected)
      setFolder(selected)
    } catch (error: unknown) { setError(errorMessage(error)) }
  }
  const close = () => { version.current++; setView(null) }
  const button = (label: string, action: () => void, disabled = false) => <TouchableOpacity disabled={disabled} onPress={action}
    style={{ minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}><Text size={14}>{label}</Text></TouchableOpacity>
  const percent = status && status.total > 0 ? Math.floor(status.bytes * 100 / status.total) : null
  return <Modal visible={view !== null} transparent animationType="slide" onRequestClose={close}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}>
      <TouchableOpacity accessibilityLabel="关闭歌曲面板" style={{ flex: 1 }} onPress={close} />
      <View style={{ maxHeight: '74%', backgroundColor: theme['c-content-background'], borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 20, paddingBottom: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64 }}><Text size={18} style={{ flex: 1 }}>{view == 'info' ? '歌曲信息' : '下载歌曲'}</Text>{button('关闭', close)}</View>
        <ScrollView>
          <Text size={17} style={{ marginBottom: 18 }}>{track?.name}</Text>
          {view == 'info' ? <>
            {loading ? <Text color={theme['c-font-label']}>正在获取官方歌曲资料…</Text> : null}
            {details ? <>
              {Object.entries({ 歌曲: details.name, 歌手: details.artist, 专辑: details.album, 时长: details.duration, 发行时间: details.published, 发行公司: details.company, 语种: details.language, 资料来源: details.source }).filter(([, value]) => value).map(([label, value]) =>
                <View key={label} style={{ paddingVertical: 10 }}><Text size={12} color={theme['c-font-label']}>{label}</Text><Text size={15} style={{ marginTop: 5 }}>{value}</Text></View>)}
              {button('打开官方歌曲页', () => { void Linking.openURL(details.url).catch(() => { setError('无法打开浏览器') }) })}
            </> : null}
            {error && track ? button('重新获取', () => { void info(track) }) : null}
          </> : <>
            <Text size={13} color={theme['c-font-label']} style={{ marginBottom: 14 }}>保存到：{job?.folderName ?? folder?.name ?? '尚未选择文件夹'}</Text>
            {button('选择保存文件夹', () => { void chooseFolder() })}
            {track?.source == 'local' ? <Text>本地歌曲已保存在设备中，无需重复下载。</Text> : <>
              {loading ? <Text>正在获取下载地址…</Text> : null}
              {job ? <>
                <Text size={13} selectable>{job.filename}</Text>
                <Text style={{ marginVertical: 16 }}>{status?.status == 8 ? '下载完成' : status?.status == 16 ? `下载失败（${status.reason}）` : status?.status == 4 ? '等待网络或系统恢复' : `下载中${percent !== null ? ` · ${percent}%` : '…'}`}</Text>
                {status?.bytes ? <Text size={12} color={theme['c-font-label']}>{(status.bytes / 1024 / 1024).toFixed(2)} MB{status.total > 0 ? ` / ${(status.total / 1024 / 1024).toFixed(2)} MB` : ''}</Text> : null}
                {status?.status == 8 ? button('打开文件', () => { void downloader.open(job.id).catch((error: unknown) => { setError(errorMessage(error)) }) })
                  : status?.status != 16 ? button('取消下载', () => { void downloader.cancel(job.id).then(async() => { setJob(null); setStatus(null); await forgetDownloadJob(job.id) }).catch((error: unknown) => { setError(errorMessage(error)) }) }) : button('重试下载', () => { void download() })}
              </> : button('开始下载', () => { void download() }, loading || !folder)}
            </>}
          </>}
          {error ? <Text color={theme['c-font-label']} style={{ paddingVertical: 14 }}>{error}</Text> : null}
        </ScrollView>
      </View>
    </View>
  </Modal>
}
