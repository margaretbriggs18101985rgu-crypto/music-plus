import { createRoot } from 'react-dom/client'
import { View, ScrollView, TouchableOpacity } from 'react-native'
import Header from '../../src/screens/Home/Vertical/Header'
import BottomNav from '../../src/screens/Home/Vertical/BottomNav'
import ListeningHome from '../../src/screens/Home/Views/Search/BlankView/ListeningHome'
import PlayerBar from '../../src/components/player/PlayerBar'
import SonglistCard from '../../src/screens/Home/Views/SongList/components/Songlist/ListItem'
import MusicRow from '../../src/components/OnlineList/ListItem'
import PlayerCover from '../../src/screens/PlayDetail/Vertical/Pic'
import PlayerControls from '../../src/screens/PlayDetail/Vertical/Player/components/ControlBtn'
import Section from '../../src/screens/Home/Views/Setting/components/Section'
import Text from './text'
import { Icon } from './icon'
import Progress from './progress'
import { getDesignTokens } from '../../src/theme/design'
import { state, tracks, update, useTheme, useNavActiveId, usePlayerMusicInfo, useI18n } from './mocks'

globalThis.lx = { fontSize: 1 }
globalThis.i18n = { t: key => ({ ui_play: '播放', ui_pause: '暂停', ui_next: '下一首', ui_previous: '上一首' }[key] ?? key) }
globalThis.app_event = { on: () => {}, off: () => {}, changeMenuVisible: visible => { if (visible) update({ nav: 'nav_setting' }) }, jumpListPosition: () => update({ nav: 'nav_love' }) }

const playlists = ['夜航 · 把时间交给音乐', '城市漫游 · 耳机里的风景', '松弛时刻 · 慢下来', '纯粹人声 · 心动循环']
const RowList = () => <>{tracks.map((item, index) => <MusicRow key={item.id} item={item} index={index} selectedList={[]} rowInfo={{ rowWidth: '100%' }} isShowInterval isShowAlbumName showSource onPress={() => update({ detail: true })} onLongPress={() => {}} onShowMenu={() => {}} />)}</>

function PlayerScreen() {
  const colors = getDesignTokens(useTheme())
  const music = usePlayerMusicInfo()
  const t = useI18n()
  return <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 24 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
      <TouchableOpacity style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} onPress={() => update({ detail: false })} accessibilityLabel="返回"><Icon name="chevron-left" size={20} color={colors.text} /></TouchableOpacity>
      <View style={{ flex: 1, alignItems: 'center', gap: 5 }}><Text size={12}>{t('ui_now_playing')}</Text><Text size={10} color={colors.muted}>LX / MUSIC</Text></View>
      <Icon name="slider" size={18} color={colors.text} />
    </View>
    <PlayerCover componentId="preview" />
    <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 24, padding: 20 }}><Text size={11} color={colors.accent}>封面</Text><Text size={11} color={colors.muted}>歌词</Text></View>
    <View style={{ paddingHorizontal: 28, paddingBottom: 44 }}>
      <Text size={24} style={{ fontWeight: '700', marginBottom: 6 }}>{music.name}</Text>
      <Text size={13} color={colors.muted} style={{ marginBottom: 20 }}>{music.singer}</Text>
      <Progress /><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text size={11} color={colors.muted}>01:11</Text><Text size={11} color={colors.muted}>03:42</Text></View>
      <PlayerControls />
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 }}>{['lyric-on', 'add-music', 'list-loop', 'comment'].map(name => <Icon key={name} name={name} size={22} color={colors.accent} />)}</View>
    </View>
  </View>
}

function NativeScreen() {
  const colors = getDesignTokens(useTheme())
  const nav = useNavActiveId()
  if (state.detail) return <PlayerScreen />
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <Header />
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {nav == 'nav_search' ? <View style={{ paddingHorizontal: 18 }}>
        <View style={{ height: 50, borderRadius: 18, borderWidth: 0.5, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}><Text size={11} color={colors.accent}>聚合 ▾</Text><Text size={13} color={colors.muted}>搜索歌曲、歌手、歌单</Text><Icon name="search-2" size={16} color={colors.muted} /></View>
        <ListeningHome />
      </View> : null}
      {nav == 'nav_songlist' ? <View><View style={{ padding: 18, gap: 10 }}><Text size={22} style={{ fontWeight: '700' }}>为每一种心情，找到声音</Text><Text size={12} color={colors.muted}>精选歌单 · 热门 / 最新</Text></View><View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6 }}>{playlists.map((name, index) => <SonglistCard key={name} item={{ id: `list-${index}`, source: 'kw', name, img: `http://127.0.0.1:4173/art/${['night', 'city', 'coast', 'night'][index]}.svg` }} index={index} width={174} showSource onPress={() => update({ nav: 'nav_love' })} />)}</View></View> : null}
      {nav == 'nav_love' || nav == 'nav_top' ? <View><View style={{ padding: 18, gap: 10 }}><Text size={24} style={{ fontWeight: '700' }}>{nav == 'nav_top' ? '此刻，大家都在听' : '我的收藏'}</Text><Text size={12} color={colors.muted}>预览示例 · 3 首歌曲</Text></View><RowList /></View> : null}
      {nav == 'nav_setting' ? <View style={{ paddingHorizontal: 18 }}><Section title="外观与体验"><TouchableOpacity onPress={() => update({ theme: state.theme == 'mineradio' ? 'green' : 'mineradio' })} style={{ paddingVertical: 14 }}><Text>主题：{state.theme == 'mineradio' ? '夜航 · MineRadio' : '绿意盎然'}　›</Text></TouchableOpacity><Text size={12} color={colors.muted}>点击切换浅色 / 深色</Text></Section><Section title="播放与音源"><Text style={{ paddingVertical: 14 }}>播放、音源和同步保留洛雪原有实现</Text><Text size={12} color={colors.muted}>此浏览器预览只用于检查界面</Text></Section></View> : null}
    </ScrollView>
    <PlayerBar isHome />
    <BottomNav />
  </View>
}

function App() {
  useNavActiveId()
  return <div className="workspace"><div className="toolbar"><h1>LX Music <span style={{ color: '#58e0c1' }}> / 夜航</span></h1><button onClick={() => update({ detail: !state.detail })}>{state.detail ? '查看首页' : '查看播放页'}</button><button onClick={() => update({ theme: state.theme == 'mineradio' ? 'green' : 'mineradio' })}>切换主题</button><select value={state.lang} onChange={event => update({ lang: event.target.value })}><option value="zh-cn">简体中文</option><option value="en-us">English</option></select><p>复用实际 React Native 界面组件 · 示例数据 · 浏览器中不连接音乐服务</p></div><div className="stage"><div><div className="phone"><NativeScreen /></div><p className="caption">REACT NATIVE / 375 × 812</p></div><div className="aside"><span>LX × MINERADIO</span><h2>声音有温度。<br />界面也应该有。</h2><p>深夜底色，薄荷色点亮。<br />让封面、内容和播放回到视觉中心。</p><div className="line" /><p>底部导航、精选歌单、封面列表、浮动播放条和沉浸播放页。</p><p>预览可点击底部导航、主题切换，以及播放 / 下一首按钮。</p></div></div></div>
}
createRoot(document.getElementById('root')).render(<App />)
