import { tranditionalize } from '@/utils/simplify-chinese-main'
import { getMusicIdentity, musicVersionPatterns } from '@/utils/musicVersionMatch'

interface Song { id: string, source: string, name: string, singer: string, meta?: { albumName?: string } }
export interface RankedSong { music: Song, sourceRank?: number }
interface ArtistMatch { artist: { name: string }, aliases?: string[] }
export const normalizeSearchText = (value: string) => tranditionalize(typeof value.normalize == 'function' ? value.normalize('NFKC') : value).toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')
const performers = (music: Song) => music.singer.split(/、|,|，|;|；|\||\s+\/\s+|\s+(?:feat\.?|ft\.?|featuring|with)\s+/i).map(normalizeSearchText).filter(Boolean)
const hasArtist = (music: Song, names: string[]) => names.includes(normalizeSearchText(music.singer)) || performers(music).some(name => names.includes(name))

/** Metadata evidence, not a guarantee that an unlabelled recording is a studio master. */
export const recordingQuality = (music: Song, artistName: string) => {
  if (!hasArtist(music, [normalizeSearchText(artistName)])) return 0
  const types = getMusicIdentity(music).types
  if (types) return 0
  return normalizeSearchText(music.singer) == normalizeSearchText(artistName) ? 1 : 0.65
}

/** Relevance first, recording intent second, source-local retrieval rank last.
 * Retain separate platform IDs/versions so every result remains playable/selectable.
 */
export const rankSearchSongs = <T extends RankedSong>(items: T[], keyword: string, artists: ArtistMatch[] = []): T[] => {
  const fullQuery = normalizeSearchText(keyword)
  const literal = artists.some(item => [item.artist.name, ...item.aliases ?? []].some(name => normalizeSearchText(name) == fullQuery)) || items.some(({ music }) => normalizeSearchText(music.singer) == fullQuery || (normalizeSearchText(music.name) == fullQuery && !getMusicIdentity(music).types))
  const requested = literal ? [] : musicVersionPatterns.filter(([, pattern]) => pattern.test(keyword)).map(([type]) => type)
  let core = keyword
  for (const [type, pattern] of musicVersionPatterns) if (requested.includes(type)) core = core.replace(pattern, ' ')
  // Collaboration is a preference only for a bare artist query.
  const wantsCollaboration = /合唱|合作|对唱|對唱|duet|feat\.?|featuring/i.test(core)
  if (wantsCollaboration) core = core.replace(/合唱|合作|对唱|對唱|duet|feat\.?|featuring/gi, ' ')
  const query = normalizeSearchText(core)
  const names = artists.filter(item => [item.artist.name, ...item.aliases ?? []].some(name => normalizeSearchText(name) == query)).map(item => normalizeSearchText(item.artist.name))
  if (!names.length) names.push(query)
  const artistQuery = !!query && (artists.some(item => [item.artist.name, ...item.aliases ?? []].some(name => normalizeSearchText(name) == query)) || items.some(item => hasArtist(item.music, names)))
  const tokens = core.trim().split(/\s+/).map(normalizeSearchText).filter(Boolean)
  const ranks = new Map<string, number>()
  const entries = items.map(item => {
    const { music } = item
    const rank = ranks.get(music.source) ?? 0
    ranks.set(music.source, rank + 1)
    const title = normalizeSearchText(music.name)
    const singer = normalizeSearchText(music.singer)
    const identity = getMusicIdentity(music)
    const base = normalizeSearchText(identity.title)
    const full = title + singer
    let relevance = 0
    if (query) {
      if (artistQuery) relevance = hasArtist(music, names) ? 6 : singer.includes(query) ? 2 : title.includes(query) ? 1 : 0
      else if (full == query || singer + title == query) relevance = 8
      else if (title == query || base == query) relevance = 7
      else if (tokens.length > 1 && tokens.every(token => full.includes(token))) relevance = 6
      else if (title.startsWith(query)) relevance = 4
      else if (title.includes(query)) relevance = 3
      else if (full.includes(query)) relevance = 2
    }
    const types = identity.types ? identity.types.split(',') : []
    const version = requested.length
      ? requested.filter(type => types.includes(type)).length * 4 - types.filter(type => !requested.includes(type as typeof requested[number])).length
      : -types.reduce((sum, type) => sum + (type == 'cover' || type == 'remix' ? 3 : type == 'live' ? 2 : 1), 0)
    const collaboration = artistQuery ? Number(wantsCollaboration ? performers(music).length > 1 : names.includes(singer)) : 0
    // Rank is not heat. A small reciprocal contribution preserves provider order
    // without letting one response's arrival time dominate equal matches.
    return { item, relevance, version, collaboration, retrieval: 1 / (60 + (item.sourceRank ?? rank) + 1) }
  })
  return entries.sort((a, b) => b.relevance - a.relevance || b.version - a.version || b.collaboration - a.collaboration || b.retrieval - a.retrieval || a.item.music.source.localeCompare(b.item.music.source) || a.item.music.id.localeCompare(b.item.music.id)).map(entry => entry.item)
}
