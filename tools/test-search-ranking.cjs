const assert = require('node:assert/strict')
const { test } = require('node:test')
const { ranking } = require('./search-test-utils.cjs')
const song = (id, name, singer = '周杰伦', album = '七里香', sourceRank = 0) => ({ music: { id, source: id.startsWith('tx') ? 'tx' : 'wy', name, singer, meta: { albumName: album } }, sourceRank })
const ids = (list, query, artists) => ranking.rankSearchSongs(list, query, artists).map(item => item.music.id)

test('artist search ranks QQ studio solo above NetEase live, collaboration, covers and unrelated names', () => {
  const list = [song('wy_live', '晴天 (Live)'), song('wy_duet', '屋顶', '周杰伦、温岚'), song('wy_cover', '晴天 (Cover 周杰伦)', '翻唱歌手'), song('wy_fan', '晴天', '周杰伦粉丝团'), song('tx_studio', '七里香')]
  assert.deepEqual(ids(list, '周杰伦'), ['tx_studio', 'wy_duet', 'wy_live', 'wy_fan', 'wy_cover'])
  assert.equal(ids(list.map(item => ({ ...item, music: { ...item.music, source: item.music.source == 'wy' ? 'tx' : 'wy' } })), '周杰伦')[0], 'tx_studio')
})
test('live and concert album markers are respected even when the song title has no version suffix', () => {
  assert.deepEqual(ids([song('wy_album_live', '晴天', '周杰伦', '地表最强世界巡回演唱会'), song('tx_studio', '晴天')], '晴天'), ['tx_studio', 'wy_album_live'])
})
test('explicit live, cover, instrumental, DJ and duet requests retain the requested intent', () => {
  for (const version of ['Live', 'Cover', 'DJ Remix', '伴奏']) {
    assert.equal(ids([song('tx_studio', '晴天'), song('wy_version', `晴天 (${version})`)], `晴天 ${version}`)[0], 'wy_version', version)
  }
  assert.equal(ids([song('tx_studio', '晴天'), song('wy_live', '晴天 (Live)')], '周杰伦 live')[0], 'wy_live')
  assert.equal(ids([song('tx_studio', '晴天'), song('wy_duet', '屋顶', '周杰伦、温岚')], '周杰伦 合唱')[0], 'wy_duet')
})
test('song and artist queries work in either order; exact songs beat substring matches', () => {
  const list = [song('wy_partial', '晴天的故事'), song('tx_exact', '晴天')]
  for (const query of ['晴天', '晴天 周杰伦', '周杰伦 晴天']) assert.equal(ids(list, query)[0], 'tx_exact', query)
})
test('artist aliases, simplified/traditional names and intact band names match', () => {
  const artists = [{ artist: { name: '周杰伦' }, aliases: ['Jay Chou'] }]
  const list = [song('wy_live', '晴天 (Live)'), song('tx_studio', '七里香', '周杰倫')]
  assert.equal(ids(list, 'Jay Chou', artists)[0], 'tx_studio')
  assert.equal(ids(list, '周杰倫')[0], 'tx_studio')
  assert.equal(ids([song('wy_song', 'Thunderstruck', 'AC/DC')], 'AC/DC')[0], 'wy_song')
})
test('source-local retrieval ranks mix tied platforms and are independent of response completion order', () => {
  const wy = [song('wy_0', 'a', 'Singer', '', 0), song('wy_1', 'b', 'Singer', '', 1)]
  const tx = [song('tx_0', 'c', 'Singer', '', 0), song('tx_1', 'd', 'Singer', '', 1)]
  assert.deepEqual(ids([...wy, ...tx], 'Singer'), ids([...tx, ...wy], 'Singer'))
  assert.deepEqual(ids([...wy, ...tx], 'Singer').map(id => id.slice(3)), ['0', '0', '1', '1'])
})
test('ranking preserves both platform IDs and recording variants, and never mutates input', () => {
  const list = [song('wy_live', '晴天 (Live)'), song('tx_studio', '晴天'), song('wy_studio', '晴天')]
  const original = structuredClone(list)
  assert.equal(ids(list, '晴天').length, 3)
  assert.deepEqual(list, original)
})
test('literal titles and artist names containing Live, Cover or DJ are not version requests', () => {
  assert.equal(ids([song('wy_live', 'Live Forever (Live)', 'Oasis'), song('tx_studio', 'Live Forever', 'Oasis')], 'Live Forever')[0], 'tx_studio')
  assert.equal(ids([song('wy_remix', 'Lean On (DJ Remix)', 'DJ Snake'), song('tx_studio', 'Lean On', 'DJ Snake')], 'DJ Snake')[0], 'tx_studio')
})
