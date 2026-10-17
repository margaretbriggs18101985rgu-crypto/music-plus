// Compare TypeScript diagnostics with the checked-out upstream revision,
// without overwriting working files. Existing upstream failures remain visible.
const ts = require('typescript')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
parsed.options.typeRoots = [path.join(root, 'node_modules/@types')]
const pnpmStore = path.join(root, 'node_modules/.pnpm')
if (fs.existsSync(pnpmStore)) {
  const nodeTypes = fs.readdirSync(pnpmStore).find(name => name.startsWith('@types+node@'))
  if (nodeTypes) parsed.options.typeRoots.push(path.join(pnpmStore, nodeTypes, 'node_modules/@types'))
}
const modified = execFileSync('git', ['diff', '--name-only', '--', 'src'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(file => file && !file.startsWith('src/lang/'))
const newFiles = new Set(execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'src'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean).map(file => path.resolve(root, file).toLowerCase()))
const originals = new Map(modified.map(file => [path.resolve(root, file).toLowerCase(), execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8' })]))
function diagnose(baseline) {
  const host = ts.createCompilerHost(parsed.options)
  const read = host.readFile
  if (baseline) host.readFile = file => originals.get(path.resolve(file).toLowerCase()) ?? read(file)
  const files = baseline ? parsed.fileNames.filter(file => !newFiles.has(path.resolve(file).toLowerCase())) : parsed.fileNames
  const program = ts.createProgram(files, parsed.options, host)
  return ts.getPreEmitDiagnostics(program).map(diagnostic => ({
    file: diagnostic.file ? path.relative(root, diagnostic.file.fileName).replaceAll('\\', '/') : '',
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
  }))
}
const baseline = diagnose(true)
const current = diagnose(false)
const keys = new Set(baseline.map(d => JSON.stringify(d)))
const introduced = current.filter(d => !keys.has(JSON.stringify(d)))
console.log(JSON.stringify({ upstreamDiagnostics: baseline.length, currentDiagnostics: current.length, introduced }, null, 2))
process.exitCode = introduced.length ? 1 : 0
