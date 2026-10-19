import { getMusicUrl } from '@/core/music'
import { getOtherSource } from '@/core/music/utils'
import { requestMsg } from '@/utils/message'
import BackgroundTimer from 'react-native-background-timer'
import settingState from '@/store/setting/state'
import { playbackSources } from './sourceReliability'
import { musicVersionScore, rankMusicVersions } from '@/utils/musicVersionMatch'

export const withPlaybackTimeout = async<T>(task: Promise<T>, delay = 12000): Promise<T> => {
  let timeout: number | undefined
  try {
    return await Promise.race([
      task,
      new Promise<never>((resolve, reject) => {
        timeout = BackgroundTimer.setTimeout(() => { reject(new Error(requestMsg.timeout)) }, delay)
      }),
    ])
  } finally {
    if (timeout !== undefined) BackgroundTimer.clearTimeout(timeout)
  }
}

// Keep failures for this playback selection only. A URL API succeeding does not
// mean its returned audio can be loaded by the native player.
export const createPlaybackUrlResolver = (
  musicInfo: LX.Player.PlayMusic,
  isCurrent: () => boolean,
  onToggleSource: () => void,
  forcePreferred = false,
) => {
  const original = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
  const preferred = original.meta.toggleMusicInfo
  const reference = preferred ?? original
  const api = settingState.setting['common.apiSource'] ?? ''
  const songIdentity = JSON.stringify([original.source, original.id])
  const track = JSON.stringify([original.source, original.id, preferred?.source ?? '', preferred?.id ?? ''])
  const failedSources = new Set<string>()
  const refreshedSources = new Set<string>()
  const failedUrls = new Set<string>()
  let current: LX.Music.MusicInfo | undefined
  let currentUrl = ''
  let lastPosition: { position: number, at: number } | undefined
  let advanced = 0
  let confirmed = false

  const checkCurrent = () => {
    if (!isCurrent() || (settingState.setting['common.apiSource'] ?? '') != api) throw new Error(requestMsg.cancelRequest)
  }
  const fail = (info: LX.Music.MusicInfo) => {
    checkCurrent()
    if (failedSources.has(info.source)) return
    failedSources.add(info.source)
    playbackSources.failure(api, track, info.source, songIdentity)
  }
  const activate = (info: LX.Music.MusicInfo, url: string) => {
    current = info
    currentUrl = url
    lastPosition = undefined
    advanced = 0
    confirmed = false
    return url
  }
  const request = async(info: LX.Music.MusicInfo, isRefresh: boolean) => {
    checkCurrent()
    const url = await withPlaybackTimeout(getMusicUrl({ musicInfo: info, isRefresh, allowToggleSource: false }))
    checkCurrent()
    if (!url?.trim()) throw new Error(requestMsg.fail)
    if (failedUrls.has(url)) throw new Error(requestMsg.fail)
    return url
  }

  const resolve = async(isRefresh = false): Promise<string> => {
    checkCurrent()
    // History is an optimization. Slow/unavailable storage cannot block audio.
    await withPlaybackTimeout(playbackSources.ready(), 1000).catch(() => {})
    checkCurrent()
    if (original.source == 'local' && !original.meta.toggleMusicInfo) {
      // Retain local file/tag matching and its existing online fallback.
      return withPlaybackTimeout(getMusicUrl({ musicInfo, isRefresh, onToggleSource }))
    }

    if (isRefresh && current) {
      failedUrls.add(currentUrl)
      if (!refreshedSources.has(current.source)) {
        refreshedSources.add(current.source)
        try {
          const url = await request(current, true)
          if (url != currentUrl) {
            return activate(current, url)
          }
        } catch (error) {
          checkCurrent()
          if (error instanceof Error && error.message == requestMsg.cancelRequest) throw error
        }
      }
      // Do not send an identical failed URL back to the player, or keep
      // refreshing a platform after its replacement URL also failed.
      fail(current)
      current = undefined
    }

    const trySources = async(infos: LX.Music.MusicInfo[], refresh: boolean, probe = false): Promise<string | null> => {
      for (const info of infos) {
        checkCurrent()
        if (failedSources.has(info.source)) continue
        const manual = forcePreferred && info === preferred
        if (!manual && (playbackSources.blockedTrack(api, track, info.source) || (!probe && playbackSources.blockedSource(api, info.source)))) continue
        if (info.source != original.source) onToggleSource()
        try {
          const url = await request(info, refresh)
          return activate(info, url)
        } catch (error) {
          checkCurrent()
          if (error instanceof Error && error.message == requestMsg.cancelRequest) throw error
          fail(info)
        }
      }
      return null
    }

    const known = playbackSources.remembered(api, track)
    const recent = known && musicVersionScore(reference, known) != null ? known : undefined
    const primary = [
      ...(current ? [current] : []),
      ...(preferred ? [preferred] : []),
      ...(recent ? [recent] : []),
      ...(!preferred || musicVersionScore(reference, original) != null ? [original] : []),
    ]
    let alternatives: Promise<LX.Music.MusicInfoOnline[]> | undefined
    const findAlternatives = async() => {
      checkCurrent()
      onToggleSource()
      alternatives ??= withPlaybackTimeout(getOtherSource(reference)).then(infos => rankMusicVersions(reference, infos))
      return playbackSources.sort(api, track, await alternatives)
    }
    const remembered = playbackSources.preferred(api, track)
    if (!preferred && !recent && remembered && remembered.source != original.source && !playbackSources.blockedSource(api, remembered.source)) {
      try {
        const matches = (await findAlternatives()).filter(info => info.source == remembered.source)
        const url = await trySources(matches, true)
        if (url) return url
      } catch (error) {
        checkCurrent()
        if (error instanceof Error && error.message == requestMsg.cancelRequest) throw error
      }
    }
    const url = await trySources(primary, isRefresh)
    if (url) return url

    const candidates = await findAlternatives()
    const alternateUrl = await trySources(candidates, true)
    if (alternateUrl) return alternateUrl
    // If every compatible source is cooling down, allow one recovery probe;
    // don't skip an entire playlist solely because the network was briefly down.
    const probes = playbackSources.sort(api, track, [...primary, ...candidates])
      .filter(info => !failedSources.has(info.source) && !playbackSources.blockedTrack(api, track, info.source))
      .sort((a, b) => playbackSources.cooldownUntil(api, a.source) - playbackSources.cooldownUntil(api, b.source))
    if (probes.length) {
      const probe = await trySources(probes.slice(0, 1), true, true)
      if (probe) return probe
    }
    throw new Error(global.i18n.t('toggle_source_failed'))
  }
  return Object.assign(resolve, {
    needsObservation: () => isCurrent() && (settingState.setting['common.apiSource'] ?? '') == api &&
      current != null && current.source != 'local' && !confirmed,
    observe(position: number, playing: boolean, nativeTrackId: string, rate = 1) {
      if (!isCurrent() || (settingState.setting['common.apiSource'] ?? '') != api || !current || current.source == 'local' ||
        !playing || !Number.isFinite(position) || !nativeTrackId.endsWith(`__//${currentUrl}`)) {
        lastPosition = undefined; advanced = 0
        return
      }
      if (confirmed) return
      const at = Date.now()
      if (lastPosition) {
        const elapsed = (at - lastPosition.at) / 1000
        const delta = position - lastPosition.position
        const playbackRate = Math.max(0.25, Number.isFinite(rate) ? rate : 1)
        if (elapsed > 0 && elapsed <= Math.max(1.5, 1.5 / playbackRate) && delta > 0 && delta <= elapsed * playbackRate + 0.5) advanced += delta
        else advanced = 0
      }
      lastPosition = { position, at }
      if (advanced >= 3) {
        confirmed = true
        playbackSources.success(api, track, current)
      }
    },
  })
}
