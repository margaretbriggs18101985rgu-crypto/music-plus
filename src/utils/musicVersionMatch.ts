interface MatchingMusic {
  name?: unknown
  singer?: unknown
  interval?: unknown
  albumName?: unknown
  meta?: { albumName?: unknown }
}

const text = (value: unknown) => {
  if (typeof value != 'string') return ''
  // Older Android JS engines may omit Unicode normalization. Full-width ASCII
  // still needs to match, especially the brackets around version qualifiers.
  const normalized = typeof value.normalize == 'function' ? value.normalize('NFKC')
    : value.replace(/[\uFF01-\uFF5E]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g, ' ')
  return normalized.toLowerCase().trim()
}
const compact = (value: string) => value.replace(/[\s'’"“”,，、.。!！?？:：;；_\-/&|()[\]{}<>《》【】]/g, '')
const flags = [
  ['live', /\blive\b|现场|現場|演唱[会會]|音乐[会會]|音樂[会會]|巡演|演奏会|演奏會/i],
  ['cover', /\bcover(?:ed)?\b|翻唱|翻弹|翻彈/i],
  ['remix', /remix|混音|慢摇|慢搖|串烧|串燒|蹦迪|舞曲|\bdj\b|dj版/i],
  ['instrumental', /instrumental|karaoke|伴奏|纯音乐|純音樂|无人声|無人聲/i],
  ['acoustic', /acoustic|不插电|不插電|unplugged/i],
  ['slowed', /slowed|slow(?:ed)?\s*(?:version|ver\.?|版)|降速|慢速/i],
  ['sped', /sped\s*up|speed\s*up|nightcore|加速/i],
  ['demo', /\bdemo\b|小样|小樣/i],
  ['rerecorded', /taylor'?s\s+version|重录|重錄|re-record/i],
  ['radio', /radio\s*edit|电台版|電台版/i],
  ['extended', /extended|加长版|加長版/i],
] as const
const genericVersion = /\b(?:live|version|ver|original|studio|album|single|remix|mix|cover|covered|by|dj)\b|现场|現場|翻唱|混音|原唱|原版|原声|原聲|录音室|錄音室|完整版|正式版|版/gi
const neutralVersion = /^(?:(?:original|studio|album|single|full)\s*(?:version|ver\.?)?|原唱版?|原版|原声版?|原聲版?|录音室版?|錄音室版?|完整版|正式版|hq|sq|无损|無損)$/i

const identity = (music: MatchingMusic) => {
  const title = text(music.name)
  const album = text(music.meta?.albumName ?? music.albumName)
  const qualifiers: string[] = []
  const base = title.replace(/[([【]([^)[\]】]*)[)\]】]/g, (whole, content: string) => {
    if (neutralVersion.test(content.trim()) || flags.some(([, pattern]) => pattern.test(content))) {
      qualifiers.push(content)
      return ''
    }
    // A feature credit is not a new recording version; the artist set still
    // has to match exactly. Unknown qualifiers (Part 1, language, etc.) remain.
    return /^(?:feat\.?|ft\.?|featuring)\s/i.test(content) ? '' : whole
  }).replace(/\s*[-–—]\s*(live\b.*|.*remix.*|.*混音.*|.*现场.*|.*現場.*)$/i, (_, version: string) => {
    qualifiers.push(version)
    return ''
  })
  const versionText = qualifiers.join(' ')
  const directMarkers = title.match(/现场|現場|演唱[会會]|巡演|翻唱|混音|慢摇|慢搖|串烧|串燒|dj版|伴奏|纯音乐|純音樂|不插电|不插電|降速|慢速|加速|重录|重錄|电台版|電台版|加长版|加長版/g)?.join(' ') ?? ''
  const titleFlags = flags.filter(([, pattern]) => pattern.test(versionText + ' ' + directMarkers)).map(([name]) => name)
  // Album titles are useful evidence for a concert/cover/remix collection.
  // Do not interpret an artist named "DJ Snake" as a DJ recording version.
  const albumVersion = /^(?:live|remix|covers?)$|\blive\s+(?:at|from|in)\b|concert|演唱[会會]|音乐[会會]|音樂[会會]|现场|現場|翻唱|混音|dj版|remix/i.test(album) ? album : ''
  const albumFlags = flags.filter(([, pattern]) => pattern.test(albumVersion)).map(([name]) => name)
  const types = [...new Set([...titleFlags, ...albumFlags])].sort().join(',')
  const detail = qualifiers.map(value => compact(value.replace(genericVersion, ''))).filter(Boolean).sort().join('|')
  const artist = text(music.singer).replace(/[(（][^()（）]*(?:原唱|original\s+artist)[^()（）]*[)）]/gi, '')
  const artists = [...new Set(artist.split(/、|,|，|;|；|\||&|\s+\/\s+|\s+(?:feat\.?|ft\.?|featuring|with)\s+/i)
    .map(compact).filter(Boolean))].sort().join('|')
  return { title: compact(base), artists, types, detail, album: compact(album) }
}

// Search uses the same recording markers as playback matching, without changing
// the strict rules used when automatically substituting a playable track.
export const getMusicIdentity = identity
export const musicVersionPatterns = flags

const duration = (value: unknown): number | null => {
  if (typeof value != 'string' || !/^\d+(?::\d{1,2}){1,2}(?:\.\d+)?$/.test(value.trim())) return null
  const pieces = value.trim().split(':').map(Number)
  if (pieces.slice(1).some(piece => piece >= 60)) return null
  const result = pieces.reduce((total, piece) => total * 60 + piece, 0)
  return result > 0 && Number.isFinite(result) ? result : null
}

/** Metadata evidence only: reject uncertain automatic substitutions. */
export const musicVersionScore = (reference: MatchingMusic, candidate: MatchingMusic): number | null => {
  const expected = identity(reference)
  const actual = identity(candidate)
  if (!expected.title || !expected.artists || expected.title != actual.title || expected.artists != actual.artists || expected.types != actual.types) return null
  // A named concert or remixer cannot be replaced by a different/unspecified
  // one merely because both titles contain Live or Remix.
  if (expected.detail != actual.detail) return null
  const from = duration(reference.interval)
  const to = duration(candidate.interval)
  if (from != null && to != null && Math.abs(from - to) > 5) return null
  return 100 + (expected.album && expected.album == actual.album ? 20 : 0) +
    (from != null && to != null ? 10 - Math.abs(from - to) : 0)
}

export const rankMusicVersions = <T extends MatchingMusic>(reference: MatchingMusic, candidates: readonly T[]): T[] =>
  candidates.map((music, index) => ({ music, index, score: musicVersionScore(reference, music) }))
    .filter((item): item is { music: T, index: number, score: number } => item.score != null)
    .sort((a, b) => b.score - a.score || a.index - b.index).map(item => item.music)
