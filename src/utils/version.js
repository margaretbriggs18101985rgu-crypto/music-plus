import { httpGet } from '@/utils/request'
import { repository, name } from '../../package.json'
import { downloadFile, hash, unlink, existsFile, temporaryDirectoryPath } from '@/utils/fs'
import { getInstalledApkAbi, installApk, canInstallPackages, requestPackageInstallPermission } from '@/utils/nativeModules/utils'
import { APP_PROVIDER_NAME } from '@/config/constant'

const abis = [
  'arm64-v8a',
  'armeabi-v7a',
  'x86_64',
  'x86',
  'universal',
]

const repositoryUrl = repository.url.replace(/^git\+/, '').replace(/\.git$/, '')
const repositoryPath = repositoryUrl.replace('https://github.com/', '')
const validVersion = version => typeof version == 'string' && /^\d+\.\d+\.\d+$/.test(version)


const request = (url, format = 'json') => new Promise((resolve, reject) => {
  httpGet(url, { timeout: 10000, format }, (err, resp, body) => {
    if (err || resp?.statusCode != 200) return reject(err || new Error(`HTTP ${resp?.statusCode}`))
    resolve(body)
  })
})

/** @returns {Promise<{version: string, desc: string, history: Array<{version: string, desc: string}>}>} */
export const getVersionInfo = async() => {
  try {
    // Published Releases remain current even when the legacy manifest is stale.
    const release = await request(`https://api.github.com/repos/${repositoryPath}/releases/latest`)
    const version = release.tag_name?.replace(/^v/, '')
    if (!validVersion(version) || release.draft || release.prerelease) throw new Error('Invalid release')
    const files = new Set(release.assets?.filter(asset => asset.size > 0).map(asset => asset.name))
    if (!files.has('SHA256SUMS.txt') || !abis.every(abi => files.has(`${name}-v${version}-${abi}.apk`))) {
      throw new Error('Release assets are incomplete')
    }
    return { version, desc: release.body || '', history: [] }
  } catch {
    // Fallback for networks where GitHub API access is unavailable.
    const info = await request(`https://raw.githubusercontent.com/${repositoryPath}/main/publish/version.json`)
    if (!validVersion(info?.version) || typeof info.desc != 'string') throw new Error('Invalid version manifest')
    return { version: info.version, desc: info.desc, history: Array.isArray(info.history) ? info.history : [] }
  }
}

const runtime = { downloading: false }
let apkSavePath

export const downloadNewVersion = async(version, onDownload = (total, current) => {}) => {
  if (!validVersion(version)) throw new Error('Invalid version')
  if (runtime.downloading) throw new Error('An update is already downloading')
  runtime.downloading = true
  apkSavePath = null
  const savePath = `${temporaryDirectoryPath}/music-plus-update.apk`
  try {
    // Preserve the installed variant and its version-code range when updating.
    const abi = await getInstalledApkAbi()
    if (!abis.includes(abi)) throw new Error('Unknown installed APK architecture')
    const filename = `${name}-v${version}-${abi}.apk`
    const baseUrl = `${repositoryUrl}/releases/download/v${version}`
    const checksums = await request(`${baseUrl}/SHA256SUMS.txt`, 'text')
    const checksum = String(checksums).split(/\r?\n/).map(line => line.trim().split(/\s+\*?/))
      .find(parts => parts[1] == filename)?.[0]
    if (!/^[a-f\d]{64}$/i.test(checksum || '')) throw new Error('Missing APK checksum')
    const { promise } = downloadFile(`${baseUrl}/${filename}`, savePath, {
      progressInterval: 500,
      connectionTimeout: 20000,
      readTimeout: 30000,
      begin({ contentLength }) { onDownload(contentLength, 0) },
      progress({ contentLength, bytesWritten }) { onDownload(contentLength, bytesWritten) },
    })
    const result = await promise
    if (result.statusCode != 200 || result.bytesWritten <= 0) throw new Error('APK download failed')
    if ((await hash(savePath, 'sha256')).toLowerCase() != checksum.toLowerCase()) throw new Error('APK checksum mismatch')
    apkSavePath = savePath
  } catch (error) {
    if (await existsFile(savePath)) await unlink(savePath).catch(() => {})
    throw error
  } finally {
    runtime.downloading = false
  }
}

export const updateApp = async() => {
  if (!apkSavePath || !await existsFile(apkSavePath)) throw new Error('Downloaded APK is unavailable')
  if (!await canInstallPackages() && !await requestPackageInstallPermission()) throw new Error('Install permission denied')
  await installApk(apkSavePath, APP_PROVIDER_NAME)
}
