import { version } from '../../package.json'
import { storageDataPrefix } from '@/config/constant'
import { getLogicalStorageSnapshot, replaceStorageSnapshot } from '@/plugins/storage'
import { hashSHA256 } from '@/utils/nativeModules/crypto'
import { readFile, stat, writeFile } from '@/utils/fs'
import listState from '@/store/list/state'
import settingState from '@/store/setting/state'
import { getListMusics } from '@/core/list'
import defaultSetting from '@/config/defaultSetting'

export type BackupKind = 'settings' | 'full'
export interface BackupPayload { kind: BackupKind, appVersion: string, createdAt: string, entries: Array<[string, unknown]> }
const MAX_BACKUP_BYTES = 50 * 1024 * 1024
const excluded: string[] = [
  storageDataPrefix.musicUrl, storageDataPrefix.musicOtherSource, storageDataPrefix.syncAuthKey,
  storageDataPrefix.openStoragePath, storageDataPrefix.selectedManagedFolder,
]
const settingsKeys: string[] = [storageDataPrefix.setting, storageDataPrefix.fontSize, storageDataPrefix.theme]
const prefixes = Object.values(storageDataPrefix).filter(key => !excluded.includes(key))
const extras = ['musicplus_recent_tracks', 'musicplus_playlist_covers']
export const isBackupKey = (key: string, kind: BackupKind) => kind == 'settings'
  ? settingsKeys.includes(key)
  : extras.includes(key) || prefixes.some(prefix => prefix.endsWith('__') ? key.startsWith(prefix) : key == prefix)

const isRecord = (value: unknown): value is Record<string, unknown> => value != null && typeof value == 'object' && !Array.isArray(value)
const validateEntries = (payload: BackupPayload) => {
  if (!['settings', 'full'].includes(payload.kind) || !Array.isArray(payload.entries) || payload.entries.length > 100000) throw new Error('备份类型或记录数量无效')
  const keys = new Set<string>()
  for (const entry of payload.entries) {
    if (!Array.isArray(entry) || entry.length != 2 || typeof entry[0] != 'string' || !isBackupKey(entry[0], payload.kind) || keys.has(entry[0])) throw new Error('备份包含无效或重复的数据键')
    keys.add(entry[0])
    const [key, value] = entry
    if (key == storageDataPrefix.setting) {
      if (!isRecord(value)) throw new Error('备份设置损坏')
      for (const [name, setting] of Object.entries(value)) {
        const original: unknown = defaultSetting[name as keyof LX.AppSetting]
        if (original === undefined) continue
        if (original === null ? setting !== null && typeof setting != 'string' : typeof setting != typeof original) throw new Error('备份设置类型无效：' + name)
        if (typeof setting == 'number' && !Number.isFinite(setting)) throw new Error('备份包含无效数值')
      }
    } else if (key == storageDataPrefix.userList) {
      if (!Array.isArray(value) || value.some(item => !isRecord(item) || typeof item.id != 'string' || typeof item.name != 'string' || ['default', 'love', 'temp'].includes(item.id))) throw new Error('歌单信息损坏')
      if (new Set(value.map(item => (item as LX.List.UserListInfo).id)).size != value.length) throw new Error('歌单 ID 重复')
    } else if (key.startsWith(storageDataPrefix.list)) {
      if (!Array.isArray(value) || value.some(item => !isRecord(item) || typeof item.id != 'string' || typeof item.name != 'string' || typeof item.source != 'string' || !isRecord(item.meta))) throw new Error('歌曲列表损坏')
    }
  }
  if (!keys.has(storageDataPrefix.setting)) throw new Error('备份缺少软件设置')
  if (payload.kind == 'full') {
    if (!keys.has(storageDataPrefix.userList)) throw new Error('备份缺少歌单信息')
    const lists = payload.entries.find(([key]) => key == storageDataPrefix.userList)![1] as LX.List.UserListInfo[]
    for (const id of ['default', 'love', ...lists.map(item => item.id)]) if (!keys.has(storageDataPrefix.list + id)) throw new Error('备份缺少歌单歌曲：' + id)
  }
}

export const createBackup = async(kind: BackupKind) => {
  const entries = new Map(await getLogicalStorageSnapshot(key => isBackupKey(key, kind)))
  entries.set(storageDataPrefix.setting, { ...settingState.setting })
  if (kind == 'full') {
    const lists = listState.userList.map(item => ({ ...item }))
    entries.set(storageDataPrefix.userList, lists)
    for (const id of ['default', 'love', 'temp', ...lists.map(item => item.id)]) entries.set(storageDataPrefix.list + id, await getListMusics(id))
  }
  const payload: BackupPayload = { kind, appVersion: version, createdAt: new Date().toISOString(), entries: [...entries].filter(([, value]) => value != null).sort(([a], [b]) => a.localeCompare(b)) }
  validateEntries(payload)
  const text = JSON.stringify(payload)
  if (Buffer.byteLength(text, 'utf8') > MAX_BACKUP_BYTES) throw new Error('备份数据超过 50 MB，请先清理不需要的歌词缓存')
  return { format: 'music-plus-backup', schema: 1, payload: text, sha256: await hashSHA256(text) }
}

export const parseBackup = async(value: unknown): Promise<BackupPayload> => {
  if (!isRecord(value) || value.format != 'music-plus-backup' || value.schema != 1 || typeof value.payload != 'string' || value.payload.length > MAX_BACKUP_BYTES || typeof value.sha256 != 'string') throw new Error('不是受支持的 MUSIC++ 备份文件')
  if (Buffer.byteLength(value.payload, 'utf8') > MAX_BACKUP_BYTES) throw new Error('备份数据超过 50 MB')
  if (await hashSHA256(value.payload) != value.sha256) throw new Error('备份校验失败，文件可能不完整或已损坏')
  const parsed: unknown = JSON.parse(value.payload)
  if (!isRecord(parsed) || typeof parsed.createdAt != 'string' || typeof parsed.appVersion != 'string') throw new Error('备份内容无效')
  const payload = parsed as unknown as BackupPayload
  validateEntries(payload)
  return payload
}

export const exportBackupFile = async(folder: string, kind: BackupKind) => {
  const data = JSON.stringify(await createBackup(kind))
  const path = `${folder}/music-plus-${kind}-${Date.now()}.json`
  await writeFile(path, data)
  if (await readFile(path) != data) throw new Error('备份写入校验失败，请更换保存目录重试')
  return path
}

export const readBackupFile = async(path: string) => {
  if (Number((await stat(path)).size) > MAX_BACKUP_BYTES * 2 + 1024) throw new Error('备份文件过大')
  return parseBackup(JSON.parse(await readFile(path)) as unknown)
}

// Caller closes the app after success; storage holds stale runtime writes until restart.
export const restoreBackup = async(payload: BackupPayload) => {
  validateEntries(payload)
  await replaceStorageSnapshot(payload.entries, key => isBackupKey(key, payload.kind))
}
