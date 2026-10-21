import { LIST_IDS } from '@/config/constant'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { MAX_RECOMMENDED_SONGS } from './recommendation'

export const playRecommendedSongs = async(musics: LX.Music.MusicInfo[]) => {
  const queue = musics.filter((music): music is LX.Music.MusicInfoOnline => music.source != 'local').slice(0, MAX_RECOMMENDED_SONGS)
  if (!queue.length) return false
  await setTempList('recommendations', queue)
  await playList(LIST_IDS.TEMP, 0)
  return true
}
