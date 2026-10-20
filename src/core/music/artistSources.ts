import { getData, removeData, saveData } from '@/plugins/storage'
import { normalizeSearchText, recordingQuality } from '@/core/search/ranking'
import { getMusicIdentity } from '@/utils/musicVersionMatch'
import { getArtistProfile, searchArtist, type Artist, type ArtistProfile, type ArtistSource } from './artist'

export interface ArtistSourceOption { artist: Artist, profile?: ArtistProfile }
export interface ArtistSources { options: ArtistSourceOption[], recommended: ArtistSource, preferred?: ArtistSource }
const preferenceKey = (artist: Artist) => `musicplus_artist_source_${artist.source}_${artist.id}`

const catalogScore = (option: ArtistSourceOption) => {
  const profile = option.profile
  if (!profile) return -1
  const list = [...new Map(profile.songs.list.map(music => {
    const identity = getMusicIdentity(music)
    return [`${identity.title}|${identity.artists}|${identity.types}|${identity.detail}`, music] as const
  })).values()]
  if (!list.length) return 0
  const quality = list.reduce((sum, music, index) => sum + recordingQuality(music, option.artist.name) / (1 + index / 10), 0)
  const weight = list.reduce((sum, _, index) => sum + 1 / (1 + index / 10), 0)
  // Compare actual sampled recordings first. Catalog counts alone include live,
  // compilations and duplicates and cannot establish recording availability.
  return 1 + quality / weight * 8 + Math.log1p(quality)
}
export const recommendArtistSource = (options: ArtistSourceOption[], fallback: ArtistSource): ArtistSource => [...options]
  .sort((a, b) => catalogScore(b) - catalogScore(a) || Number(b.artist.source == fallback) - Number(a.artist.source == fallback))[0]?.artist.source ?? fallback

export const loadArtistSources = async(artist: Artist): Promise<ArtistSources> => {
  const otherSource = artist.source == 'wy' ? 'tx' : 'wy'
  const [otherOption, seedProfile, preference] = await Promise.all([
    searchArtist(artist.name, otherSource).catch(() => null).then(async match => {
      // Substring matches (fan accounts, tribute artists) are never treated as
      // the same person. IDs always come from the target service.
      if (!match || ![match.artist.name, ...match.aliases].some(value => normalizeSearchText(value) == normalizeSearchText(artist.name))) return undefined
      return { artist: match.artist, profile: await getArtistProfile(match.artist).catch(() => undefined) }
    }),
    getArtistProfile(artist).catch(() => undefined),
    getData<ArtistSource>(preferenceKey(artist)).catch(() => null),
  ])
  const options: ArtistSourceOption[] = [{ artist, profile: seedProfile }, ...otherOption ? [otherOption] : []]
  const remembered = preference ?? (otherOption ? await getData<ArtistSource>(preferenceKey(otherOption.artist)).catch(() => null) : null)
  return { options, recommended: recommendArtistSource(options, artist.source), preferred: options.some(option => option.artist.source == remembered && option.profile) ? remembered ?? undefined : undefined }
}

export const saveArtistSource = async(options: ArtistSourceOption[], source?: ArtistSource) => {
  await Promise.all(options.map(async({ artist }) => source ? saveData(preferenceKey(artist), source) : removeData(preferenceKey(artist))))
}
