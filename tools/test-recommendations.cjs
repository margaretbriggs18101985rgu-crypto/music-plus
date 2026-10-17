const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')

const songs = new Map([
  ['artist-rock', { id: 'artist-rock', name: '明天会更好', singer: '常听歌手', interval: '04:20', source: 'kw', meta: { albumName: '摇滚现场' } }],
  ['same-taste', { id: 'same-taste', name: '新的旅程', singer: '新歌手', interval: '04:10', source: 'kw', meta: { albumName: '华语摇滚' } }],
  ['other-taste', { id: 'other-taste', name: 'Blue Sky', singer: 'Other', interval: '02:50', source: 'kw', meta: { albumName: 'Jazz collection' } }],
])
const searches = []
const sdk = { kw: { musicSearch: { search: async (query, page = 1, limit) => {
  searches.push({ query, page, limit })
  return { list: [...songs.values()], source: 'kw' }
} } } }
const compiledModule = { exports: {} }
const code = ts.transpileModule(fs.readFileSync('src/core/music/recommendation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
new Function('module', 'exports', 'require', code)(compiledModule, compiledModule.exports, id => {
  if (id === '@/utils/musicSdk') return { default: sdk }
  if (id === '@/utils') return { toNewMusicInfo: item => item }
  return {}
})
const recommendation = compiledModule.exports
const music = (id, name, singer, albumName, interval) => ({ id, name, singer, interval, source: 'kw', meta: { albumName } })

test('listening profile uses recency, repeat plays, duration, language and style signals', () => {
  const recent = [
    { music: music('a', '再見', '常聽歌手', '华语摇滚', '04:20'), playedAt: Date.now(), playCount: 5, listenedSeconds: 900 },
    { music: music('b', '海闊天空', '常聽歌手', '搖滾現場', '04:40'), playedAt: Date.now() - 86_400_000, playCount: 2, listenedSeconds: 400 },
  ]
  const profile = recommendation.buildListeningProfile(recent)
  assert.equal(profile.artists[0].name, '常聽歌手')
  assert.equal(profile.languages[0].id, 'zh')
  assert.equal(profile.styles[0].id, 'rock')
  assert.ok(profile.averageDuration > 260 && profile.averageDuration < 280)
})

test('song ranking favors matching singer, language and style signals over unrelated results', () => {
  const profile = recommendation.buildListeningProfile([{ music: music('seed', '再見', '常聽歌手', '华语摇滚', '04:20'), playedAt: Date.now(), playCount: 3, listenedSeconds: 500 }])
  const match = songs.get('artist-rock')
  const sameTaste = songs.get('same-taste')
  const unrelated = songs.get('other-taste')
  assert.ok(recommendation.scoreRecommendedTrack(match, profile) > recommendation.scoreRecommendedTrack(unrelated, profile))
  assert.ok(recommendation.scoreRecommendedTrack(sameTaste, profile) > recommendation.scoreRecommendedTrack(unrelated, profile))
  assert.deepEqual(recommendation.getRecommendationReasons(sameTaste, profile), ['ui_recommend_reason_language', 'ui_recommend_reason_style'])
})

test('longer songs are favored only when the matching style is associated with long tracks', () => {
  const longStyleRecent = [{ music: music('long-seed', '长篇摇滚', '喜欢的歌手', '华语摇滚', '06:00'), playedAt: Date.now(), playCount: 4, listenedSeconds: 1200 }]
  const longStyleProfile = recommendation.buildListeningProfile(longStyleRecent)
  const longRock = music('long-rock', '长歌', '其他歌手', '摇滚', '06:30')
  const shortRock = music('short-rock', '短歌', '其他歌手', '摇滚', '03:00')
  const longJazz = music('long-jazz', '长爵士', '其他歌手', '爵士', '06:30')
  const shortJazz = music('short-jazz', '短爵士', '其他歌手', '爵士', '03:00')
  assert.ok(longStyleProfile.styles[0].averageDuration > 350)
  assert.ok(recommendation.scoreRecommendedTrack(longRock, longStyleProfile) > recommendation.scoreRecommendedTrack(shortRock, longStyleProfile))
  assert.equal(recommendation.scoreRecommendedTrack(longJazz, longStyleProfile), recommendation.scoreRecommendedTrack(shortJazz, longStyleProfile))

  const regularProfile = recommendation.buildListeningProfile([{ music: music('regular-seed', '摇滚歌曲', '喜欢的歌手', '华语摇滚', '04:00'), playedAt: Date.now(), playCount: 2, listenedSeconds: 500 }])
  const fourMinutes = music('four-minutes', '歌 A', '其他歌手', '摇滚', '04:00')
  const fourThirty = music('four-thirty', '歌 B', '其他歌手', '摇滚', '04:30')
  assert.equal(recommendation.scoreRecommendedTrack(fourMinutes, regularProfile), recommendation.scoreRecommendedTrack(fourThirty, regularProfile))
})

test('recommendations search preferred artists and exclude songs already heard or saved', async () => {
  searches.length = 0
  const recent = [{ music: music('seed', '再見', '常聽歌手', '华语摇滚', '04:20'), playedAt: Date.now(), playCount: 3, listenedSeconds: 500 }]
  const result = await recommendation.getRecommendedSongs(recent, 'kw', ['same-taste'])
  assert.ok(searches.some(item => item.query === '常聽歌手'))
  assert.ok(searches.some(item => item.query === '摇滚 华语'))
  assert.ok(result.every(item => !['seed', 'same-taste'].includes(item.music.id)))
  assert.ok(result.length > 0)
})

test('recommendation refresh rotates search pages and excludes songs shown in the previous set', async () => {
  const searchedPages = []
  sdk.kw.musicSearch.search = async (query, page = 1) => {
    searchedPages.push(page)
    return { list: page == 2 ? [songs.get('same-taste')] : [songs.get('artist-rock')] }
  }
  const recent = [{ music: music('seed', '再見', '常聽歌手', '华语摇滚', '04:20'), playedAt: Date.now(), playCount: 3, listenedSeconds: 500 }]
  const result = await recommendation.getRecommendedSongs(recent, 'kw', ['artist-rock'], 2)
  assert.ok(searchedPages.includes(2))
  assert.deepEqual(result.map(item => item.music.id), ['same-taste'])
})

test('recommendations ignore rejected queries and malformed search results', async () => {
  sdk.kw.musicSearch.search = async query => {
    if (query === '常聽歌手') throw new Error('search unavailable')
    return { list: [null, { id: 'missing-singer', name: 'incomplete' }, songs.get('same-taste')] }
  }
  const recent = [{ music: music('seed', '再見', '常聽歌手', '华语摇滚', '04:20'), playedAt: Date.now(), playCount: 3, listenedSeconds: 500 }]
  const result = await recommendation.getRecommendedSongs(recent, 'kw')
  assert.deepEqual(result.map(item => item.music.id), ['same-taste'])
})

test('recommendation searches keep the music source receiver context', async () => {
  sdk.kw.musicSearch.search = async function(query) {
    assert.equal(this, sdk.kw.musicSearch)
    return { list: query === '摇滚 华语' ? [songs.get('same-taste')] : [] }
  }
  const recent = [{ music: music('seed', '再見', '常聽歌手', '华语摇滚', '04:20'), playedAt: Date.now(), playCount: 3, listenedSeconds: 500 }]
  const result = await recommendation.getRecommendedSongs(recent, 'kw')
  assert.deepEqual(result.map(item => item.music.id), ['same-taste'])
})

test('playlist ordering moves language and style matches ahead of general lists', () => {
  const recent = [{ music: music('seed', '再見', '常聽歌手', '华语摇滚', '04:20'), playedAt: Date.now(), playCount: 3, listenedSeconds: 500 }]
  const profile = recommendation.buildListeningProfile(recent)
  const ordered = recommendation.rankRecommendedPlaylists([
    { id: 'general', name: '热门歌曲精选', author: '', source: 'wy' },
    { id: 'match', name: '华语摇滚精选', author: '', source: 'wy' },
  ], profile)
  assert.deepEqual(ordered.map(item => item.id), ['match', 'general'])
})
