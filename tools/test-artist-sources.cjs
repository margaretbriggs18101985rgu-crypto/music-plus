const assert = require('node:assert/strict')
const { test } = require('node:test')
const { load, ranking, versions } = require('./search-test-utils.cjs')
const seed = { source: 'wy', id: '6452', name: '周杰伦' }
const other = { source: 'tx', id: 'JAY_MID', name: '周杰伦' }
const music = (name, singer = '周杰伦') => ({ id: name, source: 'wy', name, singer, meta: { albumName: '' } })
const profile = (artist, list) => ({ artist, songs: { list, more: false }, description: '', songCount: 100 })
function environment({ match = { artist: other, aliases: [] }, profiles = { wy: profile(seed, [music('晴天 (Live)')]), tx: profile(other, [music('晴天')]) }, stored = new Map() } = {}) {
  const calls = []
  const imports = {
    '@/plugins/storage': { getData: async key => stored.get(key), saveData: async(key, value) => { stored.set(key, value) }, removeData: async key => { stored.delete(key) } },
    '@/core/search/ranking': ranking,
    '@/utils/musicVersionMatch': versions,
    './artist': {
      searchArtist: async(name, source) => { calls.push({ name, source }); return match },
      getArtistProfile: async artist => { calls.push({ artist }); const value = profiles[artist.source]; if (!value) throw new Error('offline'); return value },
    },
  }
  return { api: load('src/core/music/artistSources.ts', imports), calls, stored }
}
test('automatic choice compares actual studio recordings and retains real platform IDs', async() => {
  const { api, calls } = environment()
  const result = await api.loadArtistSources(seed)
  assert.equal(result.recommended, 'tx')
  assert.equal(result.preferred, undefined)
  assert.deepEqual(result.options.map(item => item.artist.id), ['6452', 'JAY_MID'])
  assert.equal(calls.find(item => item.artist?.source == 'tx').artist.id, 'JAY_MID')
})
test('manual platform preference survives reopening from either platform and resets to automatic', async() => {
  const { api, stored } = environment()
  const result = await api.loadArtistSources(seed)
  await api.saveArtistSource(result.options, 'wy')
  assert.equal((await api.loadArtistSources(seed)).preferred, 'wy')
  const reopened = environment({ stored, match: { artist: seed, aliases: [] } })
  assert.equal((await reopened.api.loadArtistSources(other)).preferred, 'wy')
  await api.saveArtistSource(result.options)
  assert.equal((await api.loadArtistSources(seed)).preferred, undefined)
})
test('fan/tribute substring matches do not become switchable identities', async() => {
  const { api } = environment({ match: { artist: { ...other, name: '周杰伦后援会' }, aliases: [] } })
  const result = await api.loadArtistSources(seed)
  assert.equal(result.options.length, 1)
  assert.equal(result.recommended, 'wy')
})
test('cross-platform aliases are accepted and a missing platform leaves the existing page usable', async() => {
  assert.equal((await environment({ match: { artist: { ...other, name: 'Jay Chou' }, aliases: ['周杰伦'] } }).api.loadArtistSources(seed)).options.length, 2)
  assert.equal((await environment({ match: null }).api.loadArtistSources(seed)).options.length, 1)
})
test('a failed profile falls back to the healthy service and ignores unavailable saved preference', async() => {
  const env = environment({ profiles: { tx: profile(other, [music('晴天')]) } })
  await env.api.saveArtistSource([{ artist: seed }], 'wy')
  const result = await env.api.loadArtistSources(seed)
  assert.equal(result.recommended, 'tx')
  assert.equal(result.preferred, undefined)
  assert.equal(result.options.length, 2)
})
test('large live/duplicate catalogs cannot beat a sample with the original artist studio tracks', () => {
  const { api } = environment()
  const live = { artist: seed, profile: { ...profile(seed, Array.from({ length: 50 }, (_, i) => music(`现场 ${i} (Live)`))), songCount: 99999 } }
  const studio = { artist: other, profile: profile(other, [music('晴天')]) }
  assert.equal(api.recommendArtistSource([live, studio], 'wy'), 'tx')
  assert.equal(api.recommendArtistSource([studio, live], 'tx'), 'tx')
})
