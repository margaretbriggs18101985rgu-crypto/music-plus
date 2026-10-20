const fs = require('node:fs')
const ts = require('typescript')
function load(file, imports = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { allowJs: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(module, module.exports, id => {
    if (Object.hasOwn(imports, id)) return imports[id]
    throw new Error(`Unexpected import ${id} in ${file}`)
  })
  return module.exports
}
const chinese = load('src/utils/simplify-chinese-main/index.js', { './chinese': load('src/utils/simplify-chinese-main/chinese.js') })
const versions = load('src/utils/musicVersionMatch.ts')
const ranking = load('src/core/search/ranking.ts', { '@/utils/simplify-chinese-main': chinese, '@/utils/musicVersionMatch': versions })
module.exports = { load, ranking, versions }
