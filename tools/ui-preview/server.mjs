import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const require = createRequire(import.meta.url)
const mock = path.join(here, 'mocks.jsx')
const aliases = {
  'react-native': require.resolve('react-native-web'),
  react: path.dirname(require.resolve('react/package.json')),
  'react-dom': path.dirname(require.resolve('react-dom/package.json')),
  '@/store/theme/hook': mock,
  '@/store/common/hook': mock,
  '@/store/common/state': mock,
  '@/store/player/hook': mock,
  '@/store/player/state': mock,
  '@/store/setting/hook': mock,
  '@/core/common': mock,
  '@/core/player/player': mock,
  '@/core/player/playInfo': mock,
  '@/components/player/PlaybackQueue': path.join(here, 'queue.jsx'),
  '@/core/songlist': mock,
  '@/core/list': mock,
  '@/core/music/library': mock,
  '@/core/music/recommendation': mock,
  '@/utils/data': mock,
  '@/utils/tools': mock,
  '@/utils/hooks': mock,
  '@/utils/pixelRatio': mock,
  '@/navigation': mock,
  '@/lang': mock,
  '@/theme': path.join(here, 'theme.jsx'),
  '@/plugins/player': mock,
  '@/plugins/player/hook': mock,
  'react-native-track-player': mock,
  '@/plugins/lyric': mock,
  '@/components/common/Text': path.join(here, 'text.jsx'),
  '@/components/common/Icon': path.join(here, 'icon.jsx'),
  '@/components/common/StatusBar': path.join(here, 'empty.jsx'),
  '@/screens/Home/Views/Search/SearchTypeSelector': path.join(here, 'search-type.jsx'),
  '@/components/player/Progress': path.join(here, 'progress.jsx'),
  '@/components/player/ProgressBar': path.join(here, 'progress.jsx'),
}
await mkdir(path.join(here, 'dist'), { recursive: true })
await build({
  entryPoints: [path.join(here, 'entry.jsx')],
  outfile: path.join(here, 'dist/app.js'),
  bundle: true,
  jsx: 'automatic',
  alias: aliases,
  plugins: [{ name: 'native-source', setup(builder) {
    builder.onResolve({ filter: /^(?:@\/|\.)/ }, ({ path: request, importer }) => {
      if (aliases[request]) return { path: aliases[request] }
      const base = request.startsWith('@/') ? path.resolve(root, 'src', request.slice(2)) : path.resolve(path.dirname(importer), request)
      for (const name of ['Text', 'Icon', 'StatusBar']) {
        if (base == path.join(root, 'src/components/common', name)) return { path: aliases[`@/components/common/${name}`] }
      }
      if (base == path.join(root, 'src/components/player/Progress') || base == path.join(root, 'src/components/player/ProgressBar')) return { path: path.join(here, 'progress.jsx') }
      if (base == path.join(root, 'src/screens/PlayDetail/Vertical/Player/components/MoreBtn/Btn')) return { path: path.join(here, 'player-button.jsx') }
      if (base == path.join(root, 'src/screens/PlayDetail/Vertical/components/Header')) return { path: path.join(here, 'player-header.jsx') }
      if (!request.startsWith('@/')) return null
      const resolved = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'].map(ext => base + ext).find(file => existsSync(file))
      return { path: resolved ?? require.resolve(base) }
    })
  } }],
  define: { 'process.env.NODE_ENV': '"development"', global: 'globalThis' },
})
if (!process.argv.includes('--build')) {
  const files = {
    '/': [path.join(here, 'index.html'), 'text/html; charset=utf-8'],
    '/app.js': [path.join(here, 'dist/app.js'), 'application/javascript'],
    '/icomoon.ttf': [path.join(root, 'src/resources/fonts/icomoon.ttf'), 'font/ttf'],
    ...Object.fromEntries(['night', 'city', 'coast'].map(name => [`/art/${name}.svg`, [path.join(here, `art/${name}.svg`), 'image/svg+xml']])),
  }
  createServer(async (req, res) => {
    try {
      const file = files[new URL(req.url, 'http://localhost').pathname]
      if (!file) { res.writeHead(404); res.end(); return }
      res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' })
      res.end(await readFile(file[0]))
    } catch { res.writeHead(500); res.end('Unable to load preview') }
  }).listen(4173, '127.0.0.1', () => { console.log('Native UI preview: http://127.0.0.1:4173') })
}
