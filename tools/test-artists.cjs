const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')
const { ranking } = require('./search-test-utils.cjs')

function api({ respond = () => ({}), wy, match, signResponse } = {}) {
  const module = { exports: {} }
  const calls = []
  const output = ts.transpileModule(fs.readFileSync('src/core/music/artist.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  new Function('module', 'exports', 'require', output)(module, module.exports, id => { // eslint-disable-line no-new-func
    if (id === '@/utils/request') return { httpFetch(url, options) { calls.push({ url, options }); return { promise: Promise.resolve(respond(url, options)).then(body => ({ statusCode: 200, body })) } } }
    if (id === '@/core/search/ranking') return ranking
    if (id.endsWith('/tx/utils')) return { signRequest(data) { calls.push({ signedRequest: data }); return Promise.resolve({ body: signResponse?.(data) ?? {} }) } }
    if (id.endsWith('/musicInfo')) return { default: () => ({ promise: Promise.resolve(wy) }) }
    if (id === './officialInfo') {
      return {
        resolveOfficialTrack: async(music, source) => {
          if (music.source === source) return music
          if (match) return match(music, source)
          throw new Error('no match')
        },
      }
    }
    throw new Error(`Unexpected import: ${id}`)
  })
  return { ...module.exports, calls }
}
const wySong = { id: 12, name: 'Song', artists: [{ id: 22, name: 'AC/DC' }], album: { id: 30, name: 'Album', picUrl: 'https://p1.music.126.net/cover.jpg' }, duration: 185000, bMusic: { size: 10000 }, hMusic: { size: 20000 }, sqMusic: { size: 40000 } }
const qqSong = { id: 120, mid: 'SONG_MID', title: 'QQ Song', singer: [{ mid: 'ARTIST_MID', name: 'Singer' }], album: { id: 300, mid: 'ALBUM_MID', name: 'QQ Album' }, interval: 210, file: { media_mid: 'MEDIA_MID', size_128mp3: 10000, size_320mp3: 0, size_flac: 40000, size_hires: 0 } }
const qq = data => ({ code: 0, req: { code: 0, data } })

test('NetEase search returns the matching singer with aliases and catalog counts', async() => {
  const get = api({
    respond: url => {
      const query = new URL(url)
      assert.equal(query.searchParams.get('type'), '100')
      assert.equal(query.searchParams.get('s'), 'Joker Xue')
      return {
        code: 200,
        result: {
          artists: [
            { id: 20, name: '薛之谦后援会', alias: ['Joker Xue'], musicSize: 11 },
            { id: 22, name: '薛之谦', alias: ['Joker Xue'], picUrl: 'https://p1.music.126.net/cover.jpg', img1v1Url: 'https://p1.music.126.net/avatar.jpg', musicSize: 310, albumSize: 26 },
          ],
        },
      }
    },
  })
  const result = await get.searchArtist('Joker Xue', 'wy')
  assert.equal(result.artist.id, '22')
  assert.equal(result.artist.name, '薛之谦')
  assert.equal(result.artist.avatar, 'https://p1.music.126.net/avatar.jpg')
  assert.equal(result.songCount, 310)
  assert.equal(result.albumCount, 26)
})

test('QQ search uses the existing signed singer search and official artist MID', async() => {
  const get = api({
    signResponse: data => {
      const request = data['music.search.SearchCgiService']
      assert.equal(request.method, 'DoSearchForQQMusicDesktop')
      assert.equal(request.param.search_type, 1)
      assert.equal(request.param.query, 'G.E.M.')
      return {
        code: 0,
        'music.search.SearchCgiService': {
          code: 0,
          data: {
            body: {
              singer: {
                list: [
                  { singer_id: 28, singer_mid: 'GEM_MID', singer_name: 'G.E.M.邓紫棋', singer_pic: 'https://y.gtimg.cn/artist.jpg', alias: ['G.E.M.'], song_num: 120, album_num: 12 },
                ],
              },
            },
          },
        },
      }
    },
  })
  const result = await get.searchArtist('G.E.M.', 'tx')
  assert.equal(result.artist.id, 'GEM_MID')
  assert.equal(result.artist.source, 'tx')
  assert.equal(result.artist.avatar, 'https://y.gtimg.cn/artist.jpg')
  assert.equal(result.songCount, 120)
})

test('artist search does not show an unrelated singer when the query is not matched', async() => {
  const get = api({ respond: () => ({ code: 200, result: { artists: [{ id: 22, name: 'AC/DC', alias: [] }] } }) })
  assert.equal(await get.searchArtist('Unknown Artist', 'wy'), null)
})

test('QQ dedicated artist search accepts the actual camel-case singer response', async() => {
  const get = api({
    signResponse: data => {
      assert.equal(data['music.search.SearchCgiService'].param.search_type, 1)
      return { code: 0, 'music.search.SearchCgiService': { code: 0, data: { body: { singer: { list: [{ singerID: 4558, singerMID: '0025NhlN2yWrP4', singerName: '周杰伦', singerPic: 'http://y.gtimg.cn/jay.jpg', songNum: 1011, albumNum: 43 }] } } } } }
    },
  })
  const result = await get.searchArtist('周杰伦', 'tx')
  assert.equal(result.artist.id, '0025NhlN2yWrP4')
  assert.equal(result.artist.avatar, 'https://y.gtimg.cn/jay.jpg')
  assert.equal(result.songCount, 1011)
  assert.equal(result.albumCount, 43)
})

test('official artist arrays preserve AC/DC and multiple artists instead of splitting display text', async() => {
  const get = api({ wy: { ar: [{ id: 22, name: 'AC/DC' }, { id: 33, name: 'Earth, Wind & Fire' }, { id: 22, name: 'AC/DC' }, { id: 0, name: 'Unknown' }] } })
  const artists = await get.getTrackArtists({ source: 'wy', singer: 'unreliable display', meta: { songId: 1 } })
  assert.deepEqual(artists.map(item => [item.id, item.name]), [['22', 'AC/DC'], ['33', 'Earth, Wind & Fire']])
})
test('QQ artists use singer MID from official track detail', async() => {
  const get = api({
    respond: url => {
      const req = JSON.parse(new URL(url).searchParams.get('data')).req
      assert.equal(req.param.song_mid, 'SONG_MID')
      return qq({ track_info: qqSong })
    },
  })
  const [artist] = await get.getTrackArtists({ source: 'tx', meta: { songId: 'SONG_MID' } })
  assert.equal(artist.id, 'ARTIST_MID')
  assert.equal(artist.source, 'tx')
  assert.match(artist.avatar, /T001.*ARTIST_MID/)
})
test('cross-platform/local tracks only use IDs from the matched platform, including QQ fallback', async() => {
  const get = api({
    match: (_music, source) => {
      if (source === 'wy') throw new Error('not found')
      return { source: 'tx', meta: { songId: 'MATCHED_MID' } }
    },
    respond: url => {
      assert.equal(JSON.parse(new URL(url).searchParams.get('data')).req.param.song_mid, 'MATCHED_MID')
      return qq({ track_info: qqSong })
    },
  })
  assert.equal((await get.getTrackArtists({ source: 'local', meta: { songId: '/private/local.mp3' } }))[0].id, 'ARTIST_MID')
})
test('NetEase legacy artist and album songs retain covers, durations and real quality metadata', async() => {
  const get = api({
    respond: url => url.includes('/api/artist/')
      ? { code: 200, artist: { id: 22, name: 'AC/DC', musicSize: 200, albumSize: 12 }, hotSongs: [wySong, wySong] }
      : { code: 200, album: { songs: [wySong] } },
  })
  const profile = await get.getArtistProfile({ source: 'wy', id: '22', name: 'stale' })
  assert.equal(profile.artist.name, 'AC/DC')
  assert.equal(profile.songs.list.length, 1)
  assert.equal(profile.songs.more, false)
  assert.equal(profile.songCount, 200)
  const album = await get.getAlbumSongs({ source: 'wy', id: '30' })
  assert.equal(album.list[0].interval, '03:05')
  assert.equal(album.list[0].meta.albumId, 30)
  assert.deepEqual(album.list[0].meta.qualitys.map(item => item.type), ['128k', '320k', 'flac'])
})
test('QQ pagination uses raw offsets even if a response contains duplicate songs', async() => {
  const get = api({
    respond: url => {
      const req = JSON.parse(new URL(url).searchParams.get('data')).req
      assert.equal(req.param.begin, 30)
      assert.equal(req.param.singerMid, 'ARTIST_MID')
      return qq({ songList: [{ songInfo: qqSong }, { songInfo: qqSong }], totalNum: 40 })
    },
  })
  const page = await get.getArtistSongs({ source: 'tx', id: 'ARTIST_MID' }, 30)
  assert.equal(page.nextOffset, 32)
  assert.equal(page.more, true)
  assert.equal(page.list.length, 1)
  assert.equal(page.list[0].meta.strMediaMid, 'MEDIA_MID')
  assert.equal(page.list[0].meta.id, 120)
  assert.equal(page.list[0].meta.albumMid, 'ALBUM_MID')
  assert.deepEqual(page.list[0].meta.qualitys.map(item => item.type), ['128k', 'flac'])
})
test('artist albums use source-specific IDs and independent album pagination', async() => {
  const wy = api({
    respond: url => {
      assert.equal(new URL(url).searchParams.get('offset'), '20')
      return { code: 200, more: true, hotAlbums: [{ id: 30, name: 'Album', publishTime: 1700000000000, size: 10 }] }
    },
  })
  assert.equal((await wy.getArtistAlbums({ source: 'wy', id: '22' }, 20)).nextOffset, 21)
  const tx = api({
    respond: url => {
      const req = JSON.parse(new URL(url).searchParams.get('data')).req
      assert.equal(req.method, 'GetAlbumList')
      assert.equal(req.param.order, 0)
      return qq({ albumList: [{ albumMid: 'ALBUM_MID', albumName: 'QQ Album', totalNum: 0 }], total: 1 })
    },
  })
  const page = await tx.getArtistAlbums({ source: 'tx', id: 'ARTIST_MID' })
  assert.equal(page.list[0].id, 'ALBUM_MID')
  assert.equal(page.list[0].count, undefined)
  assert.equal(page.more, false)
})
test('QQ album songs use album MID, ordered paging and actual returned tracks', async() => {
  const get = api({
    respond: url => {
      const req = JSON.parse(new URL(url).searchParams.get('data')).req
      assert.equal(req.method, 'GetAlbumSongList')
      assert.equal(req.param.albumMid, 'ALBUM_MID')
      assert.equal(req.param.begin, 50)
      assert.equal(req.param.order, 2)
      return qq({ songList: [{ songInfo: qqSong }], totalNum: 51 })
    },
  })
  const page = await get.getAlbumSongs({ source: 'tx', id: 'ALBUM_MID' }, 50)
  assert.equal(page.list[0].id, 'tx_SONG_MID')
  assert.equal(page.more, false)
})
test('empty works remain empty, and rejected/malformed responses surface errors', async() => {
  assert.equal((await api({ respond: () => qq({ songList: [], totalNum: 0 }) }).getArtistSongs({ source: 'tx', id: 'empty' })).more, false)
  await assert.rejects(api({ wy: { ar: [] } }).getTrackArtists({ source: 'wy', meta: { songId: 1 } }))
  await assert.rejects(api({ respond: () => ({ code: 0, req: { code: 10006 } }) }).getArtistProfile({ source: 'tx', id: 'blocked' }))
  await assert.rejects(api({ respond: () => ({ code: 200 }) }).getArtistAlbums({ source: 'wy', id: 'bad' }))
  await assert.rejects(api({ respond: () => ({ code: 301 }) }).getAlbumSongs({ source: 'wy', id: 'blocked' }))
})
test('biography uses official content and does not fabricate unavailable QQ biographies', async() => {
  const get = api({ respond: () => ({ code: 200, briefDesc: 'Official summary', introduction: [{ ti: 'Career', txt: 'Official details' }] }) })
  assert.equal((await get.getArtistBiography({ source: 'wy', id: '22' })).sections[0].text, 'Official details')
  assert.deepEqual(await get.getArtistBiography({ source: 'tx', id: 'ARTIST_MID' }), { summary: '', sections: [] })
})

test('popular QQ playback requests 50, while all songs keep independent pagination', async() => {
  const get = api({
    respond: url => {
      const req = JSON.parse(new URL(url).searchParams.get('data')).req
      if (req.param.begin === 0) assert.equal(req.param.num, 50)
      else { assert.equal(req.param.begin, 100); assert.equal(req.param.num, 100) }
      return qq({ songList: [{ songInfo: qqSong }], totalNum: 200 })
    },
  })
  const artist = { source: 'tx', id: 'ARTIST_MID' }
  assert.equal((await get.getArtistProfile(artist)).songs.more, false)
  assert.equal((await get.getArtistAllSongs(artist, 100)).more, true)
})
test('NetEase all songs uses the full catalog endpoint and advances past the popular 50', async() => {
  const get = api({
    respond: url => {
      const query = new URL(url)
      assert.equal(query.pathname, '/api/v1/artist/songs')
      assert.equal(query.searchParams.get('offset'), '100')
      assert.equal(query.searchParams.get('limit'), '100')
      return { code: 200, songs: [wySong], total: 596, more: true }
    },
  })
  const page = await get.getArtistAllSongs({ source: 'wy', id: '22' }, 100)
  assert.equal(page.total, 596)
  assert.equal(page.more, true)
  assert.equal(page.nextOffset, 101)
})
test('NetEase portraits are fetched by artist ID and upgrade returned HTTP images to HTTPS', async() => {
  const get = api({
    respond: url => {
      assert.equal(new URL(url).searchParams.get('id'), '22')
      return { code: 200, data: { artist: { id: 22, name: 'Artist', avatar: 'http://p1.music.126.net/avatar.jpg', cover: 'http://p1.music.126.net/cover.jpg' } } }
    },
  })
  const artist = await get.getArtistIdentity({ source: 'wy', id: '22', name: 'fallback' })
  assert.equal(artist.avatar, 'https://p1.music.126.net/avatar.jpg')
  assert.equal(artist.cover, 'https://p1.music.126.net/cover.jpg')
})

test('player menu resolves the actual official album on both platforms', async() => {
  const wyAlbum = await api({ wy: wySong }).getTrackAlbum({ source: 'wy', meta: { songId: 12 } })
  assert.deepEqual(wyAlbum, { source: 'wy', id: '30', name: 'Album', cover: wySong.album.picUrl })
  const qqAlbum = await api({ respond: () => qq({ track_info: qqSong }) }).getTrackAlbum({ source: 'tx', meta: { songId: 'SONG_MID' } })
  assert.equal(qqAlbum.source, 'tx')
  assert.equal(qqAlbum.id, 'ALBUM_MID')
  assert.equal(qqAlbum.name, 'QQ Album')
})

test('missing album metadata is reported rather than opening a guessed album', async() => {
  await assert.rejects(api({ wy: { id: 12 } }).getTrackAlbum({ source: 'wy', meta: { songId: 12 } }), /专辑/)
})
