import { DeviceEventEmitter, NativeModules } from 'react-native'
import { defaultHeaders } from '@/components/common/Image'
import { getListMusics } from '@/core/list'
import { getListeningReport, getRecentTracks, LIBRARY_EVENT } from '@/core/music/library'
import { LIST_IDS } from '@/config/constant'

interface ShortcutArtworks {
  favorites?: string
  recent?: string
  recommendation?: string
  report?: string
  artworkUserAgent?: string
}

const widget = NativeModules.MusicHomeWidget as {
  updateShortcutArtworks: (artworks: ShortcutArtworks) => void
} | undefined

const normalizeArtwork = (value?: string | null) => {
  if (!value) return ''
  return value.startsWith('/') ? `file://${value}` : value
}

export const updateHomeWidgetRecommendationArtwork = (artwork?: string | null) => {
  if (!artwork?.trim()) return
  widget?.updateShortcutArtworks({
    recommendation: normalizeArtwork(artwork),
    artworkUserAgent: defaultHeaders['User-Agent'],
  })
}

export const startHomeWidgetArtworkSync = () => {
  if (!widget) return () => {}

  let active = true
  let revision = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const sync = async() => {
    const currentRevision = ++revision
    const [favoritesResult, recentResult, reportResult] = await Promise.allSettled([
      getListMusics(LIST_IDS.LOVE),
      getRecentTracks(),
      getListeningReport('day'),
    ])
    if (!active || currentRevision != revision) return

    const recent = recentResult.status == 'fulfilled' ? recentResult.value : []
    const recentArtwork = normalizeArtwork(recent[0]?.music.meta?.picUrl)
    const artworks: ShortcutArtworks = {
      artworkUserAgent: defaultHeaders['User-Agent'],
    }
    if (favoritesResult.status == 'fulfilled') {
      artworks.favorites = normalizeArtwork(favoritesResult.value[0]?.meta?.picUrl) || recentArtwork
    } else {
      artworks.favorites = recentArtwork
    }
    if (recentResult.status == 'fulfilled') {
      artworks.recent = recentArtwork
    }
    artworks.recommendation = recentArtwork
    if (reportResult.status == 'fulfilled') {
      const topTrack = reportResult.value.topSong?.track
      const fallback = topTrack && recent.find(item => item.music.id == topTrack.id)?.music.meta?.picUrl
      const topArtwork = topTrack?.picUrl?.trim() ? topTrack.picUrl : fallback
      artworks.report = normalizeArtwork(topArtwork) || recentArtwork
    } else {
      artworks.report = recentArtwork
    }
    widget.updateShortcutArtworks(artworks)
  }

  const scheduleSync = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { void sync() }, 250)
  }

  const librarySubscription = DeviceEventEmitter.addListener(LIBRARY_EVENT, scheduleSync)
  const onListUpdate = () => { scheduleSync() }
  global.app_event.on('myListMusicUpdate', onListUpdate)
  void sync()

  return () => {
    active = false
    revision++
    if (timer) clearTimeout(timer)
    librarySubscription.remove()
    global.app_event.off('myListMusicUpdate', onListUpdate)
  }
}
