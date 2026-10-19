const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')

function load(file, dependencies = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(module, module.exports, id => {
    if (id.includes('/images/')) return 1
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency ${id}`)
    return dependencies[id]
  })
  return module.exports
}
const appearance = load('src/utils/pageAppearance.ts')
const theme = { isDark: true, 'c-font': '#F3F3F5', 'c-font-label': '#929298', 'c-primary-font': '#F3F3F5', 'c-button-font': '#F3F3F5' }
const jsx = (type, props) => ({ type, props })
const walk = node => !node || typeof node != 'object' ? [] : [node, ...[node.props?.children].flat().flatMap(walk)]

test('page colors preserve semantic accents and secondary text hierarchy', () => {
  assert.equal(appearance.resolvePageTextColor('#F3F3F5', '#AABBCC', theme), '#AABBCC')
  assert.equal(appearance.resolvePageTextColor('#929298', '#AABBCC', theme), '#AABBCCA3')
  assert.equal(appearance.resolvePageTextColor('#FF4055', '#AABBCC', theme), '#FF4055')
  assert.equal(appearance.resolvePageTextColor('#F3F3F5', '', theme), '#F3F3F5')
  assert.equal(appearance.normalizePageColor('rgba(0,0,0,1)'), '')
})

test('only dark vinyl and white are available and both have readable contrasting surfaces', async() => {
  const generated = load('src/theme/themes/themes.ts').default
  const state = { setting: { 'theme.id': 'white' } }
  const themes = load('src/theme/themes/index.ts', {
    '@/utils/data': { getUserTheme: async() => [{ id: 'old-custom' }], saveUserTheme: async() => {} },
    '@/theme/themes/themes': { default: generated },
    '@/store/setting/state': { default: state },
    '@/utils': { isUrl: () => false },
    '@/utils/fs': { privateStorageDirectoryPath: '/private' },
    'react-native': {},
    '@/theme/design': load('src/theme/design.ts'),
  })
  assert.deepEqual((await themes.getAllThemes()).themes.map(item => item.id), ['mineradio', 'white'])
  assert.deepEqual((await themes.getAllThemes()).userThemes, [])
  const light = themes.buildActiveThemeColors(await themes.getTheme())
  assert.equal(light.isDark, false)
  assert.equal(light['c-font'], '#1B1B20')
  assert.equal(light['c-content-background'], '#FAFAFC')
  state.setting['theme.id'] = 'green'
  const dark = themes.buildActiveThemeColors(await themes.getTheme())
  assert.equal(dark.id, 'mineradio')
  assert.equal(dark['c-font'], '#F3F3F5')
})

test('color wheel changes are drafts until Apply, cancellation and Android Back do not save', () => {
  const slots = []
  let cursor = 0
  const changes = []
  const component = load('src/components/common/ColorPickerButton.tsx', {
    react: {
      useState: value => { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], next => { slots[index] = next }] },
      useRef: value => { const index = cursor++; slots[index] ??= { current: value }; return slots[index] },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Modal: 'Modal', View: 'View', TouchableOpacity: 'Button', ScrollView: 'ScrollView', useWindowDimensions: () => ({ width: 400, height: 850 }) },
    'react-native-wheel-color-picker': { default: 'Wheel' },
    './Text': { default: 'Text' },
    '@/store/theme/hook': { useTheme: () => theme },
    '@/theme/design': load('src/theme/design.ts'),
    '@/utils/pageAppearance': appearance,
  }).default
  const render = () => { cursor = 0; return walk(component({ value: '#A8F6FF', label: '页面文字色盘', onChange: color => changes.push(color) })) }
  const button = label => render().find(node => node.props?.accessibilityLabel == label)
  button('打开页面文字色盘').props.onPress()
  render().find(node => node.type == 'Wheel').props.onColorChange('#123abc')
  assert.deepEqual(changes, [])
  button('取消页面文字色盘').props.onPress()
  assert.equal(render().find(node => node.type == 'Modal').props.visible, false)
  button('打开页面文字色盘').props.onPress()
  assert.equal(render().find(node => node.type == 'Wheel').props.color, '#A8F6FF')
  render().find(node => node.type == 'Wheel').props.onColorChangeComplete('#deab01')
  button('应用页面文字色盘').props.onPress()
  assert.deepEqual(changes, ['#DEAB01'])
  button('打开页面文字色盘').props.onPress()
  render().find(node => node.type == 'Modal').props.onRequestClose()
  assert.deepEqual(changes, ['#DEAB01'])
})

test('page font and color controls update page settings only', () => {
  const updates = []
  const component = load('src/screens/Home/Views/Setting/settings/Theme/PageTypography.tsx', {
    react: { memo: fn => fn }, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', TouchableOpacity: 'Button' },
    '../../components/SubTitle': { default: 'SubTitle' },
    '@/components/common/Text': { default: 'Text' }, '@/components/common/Button': { default: 'Button' },
    '@/components/common/ColorPickerButton': { default: 'ColorPicker' },
    '@/store/theme/hook': { useTheme: () => theme },
    '@/store/setting/hook': { useSettingValue: key => key.endsWith('Family') ? 'system' : '' },
    '@/core/common': { updateSetting: value => updates.push(value) }, '@/utils/pageAppearance': appearance,
  }).default
  const nodes = walk(component())
  nodes.find(node => node.props?.accessibilityLabel == '页面字体：霞鹜文楷').props.onPress()
  nodes.find(node => node.type == 'ColorPicker').props.onChange('#AABBCC')
  assert.deepEqual(updates, [{ 'theme.pageFontFamily': 'wenkai' }, { 'theme.pageFontColor': '#AABBCC' }])
})
