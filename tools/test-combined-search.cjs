const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')
const { ranking } = require('./search-test-utils.cjs')
function environment() {
  const env = { calls: [], failed: new Set(), details: 0 }
  const module = { exports: {} }
  const sdk = Object.fromEntries(['wy', 'tx'].map(source => [source, Object.fromEntries(['musicSearch', 'songList'].map(kind => [kind, {
    search: async(text, page, limit) => {
      env.calls.push({ source, kind, text, page })
      if (env.failed.has(`${source}_${kind}`)) throw new Error('offline')
      const list = Array.from({ length: limit }, (_, index) => kind == 'musicSearch'
        ? { id: `${source}_${page}_${index}`, name: text, singer: 'Artist', source, searchMetadata: { heat: index, publishedAt: index ? '2026-10-01' : undefined } }
        : { id: `${page}_${index}`, name: text, source, play_count: '10万', time: '2026-10-01' })
      return { list, total: 100 }
    },
  }]))]))
  const code = ts.transpileModule(fs.readFileSync('src/core/search/combined.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(module, module.exports, id => {
    if (id === '@/utils/musicSdk') return { default: sdk }
    if (id === '@/utils') return { toNewMusicInfo: item => item }
    if (id === '@/core/music/artist') return { searchArtist: async(text, source) => ({ artist: { source, id: source, name: text } }) }
    if (id === '@/core/music/officialInfo') return { getOfficialSongInfo: async() => { env.details++; return { published: '2026-10-18' } } }
    if (id === '@/utils/musicSdk/wy/musicDetail') return { default: { getList: async() => ({ list: [] }) } }
    if (id === './ranking') return ranking
    throw new Error(id)
  })
  return { ...env, env, api: module.exports }
}

test('one query searches both platforms for songs, artists and playlists', async() => {
  const { api, calls } = environment()
  const result = await api.searchCombined('摇滚')
  assert.equal(result.songs.length, 40)
  assert.equal(result.playlists.length, 24)
  assert.deepEqual(result.artists.map(item => item.artist.source), ['wy', 'tx'])
  assert.equal(calls.length, 4)
  assert.equal(result.songs[0].heat, 0)
  assert.equal(result.songs[0].publishedAt, undefined)
})

test('a failed platform page retries independently without losing successful pages or duplicating songs', async() => {
  const { api, env } = environment()
  env.failed.add('tx_musicSearch')
  const first = await api.searchCombined('rock')
  assert.ok(first.failures.includes('tx_songs'))
  env.failed.clear()
  const second = await api.searchCombined('rock', 2, first)
  assert.equal(env.calls.filter(item => item.source == 'tx' && item.kind == 'musicSearch').at(-1).page, 1)
  assert.equal(env.calls.filter(item => item.source == 'wy' && item.kind == 'musicSearch').at(-1).page, 2)
  assert.equal(second.songs.length, 60)
  assert.equal(new Set(second.songs.map(item => item.music.id)).size, 60)
})

test('heat sorting compares platform percentiles, supports zero and puts unknowns last', () => {
  const { api } = environment()
  const items = [
    { id: 'unknown', source: 'tx' }, { id: 'low', source: 'wy', heat: 0 },
    { id: 'a', source: 'wy', heat: 90 }, { id: 'b', source: 'tx', heat: 1000000 }, { id: 'b-low', source: 'tx', heat: 100 },
  ]
  assert.deepEqual(api.sortSearchItems(items, 'hot', '', item => ({ ...item, text: '' })).map(item => item.id), ['a', 'b', 'low', 'b-low', 'unknown'])
})

test('date sorting uses real timestamps and leaves missing dates last', () => {
  const { api } = environment()
  const items = [{ music: { id: 'unknown', name: 'Song', singer: '', source: 'wy' } }, { music: { id: 'old', name: 'Song', singer: '', source: 'tx' }, publishedAt: api.searchTimestamp('2020-01-01') }, { music: { id: 'new', name: 'Song', singer: '', source: 'wy' }, publishedAt: api.searchTimestamp('2026-01-01') }]
  assert.deepEqual(api.sortedSongs(items, 'newest', 'Song').map(item => item.music.id), ['new', 'old', 'unknown'])
  assert.equal(api.searchTimestamp(1700000000), 1700000000000)
  assert.equal(api.searchTimestamp('unknown'), undefined)
})

test('missing release dates are fetched once from official metadata and cached', async() => {
  const { api, env } = environment()
  const input = [{ music: { id: 'song', source: 'wy' } }]
  const first = await api.enrichSearchDates(input)
  assert.equal(first[0].publishedAt, api.searchTimestamp('2026-10-18'))
  await api.enrichSearchDates(input)
  assert.equal(env.details, 1)
  assert.equal(input[0].publishedAt, undefined)
})

test('search source selection filters songs, artists, playlists, failures and pagination together without discarding loaded data', async() => {
  const { api } = environment()
  const result = await api.searchCombined('周杰伦')
  result.more.wy_songs = false
  result.more.wy_playlists = false
  result.failures = ['tx_songs', 'wy_playlists']
  for (const source of ['tx', 'wy']) {
    const visible = api.filterCombinedSearch(result, source)
    assert.equal(visible.songs.length, 20)
    assert.equal(visible.playlists.length, 12)
    assert.equal(visible.artists.length, 1)
    assert.ok(visible.songs.every(item => item.music.source === source))
    assert.ok(visible.playlists.every(item => item.source === source))
    assert.equal(visible.artists[0].artist.source, source)
    assert.ok(visible.failures.every(key => key.startsWith(source + '_')))
    assert.equal(Object.values(visible.more).some(Boolean), source === 'tx')
  }
  assert.equal(api.filterCombinedSearch(result, 'all'), result)
  assert.equal(result.songs.length, 40)
  const next = await api.searchCombined('周杰伦', 2, result)
  assert.equal(api.filterCombinedSearch(next, 'tx').songs.length, 40)
  assert.equal(api.filterCombinedSearch(next, 'wy').songs.length, 20)
})
