import AsyncStorage from '@react-native-async-storage/async-storage'
import { log } from '@/utils/log'

const partKeyPrefix = '@___PART___'
const partKeyArrPrefix = '@___PART_A___'
const partKeyPrefixRxp = /^@___PART___/
const partKeyArrPrefixRxp = /^@___PART_A___/
const keySplit = ','
const limit = 500000
const restoreJournalKey = '@musicplus_restore_journal'
const writes = { pending: Promise.resolve() as Promise<unknown>, frozen: false }
const queueWrite = async <T>(action: () => Promise<T>): Promise<T> => {
  const result = writes.pending.then(async() => {
    // A successful restore must restart before old in-memory state can write again.
    if (writes.frozen) return new Promise<T>(() => {})
    return action()
  })
  writes.pending = result.catch(() => {})
  return result
}

const buildData = (key: string, value: any, datas: Array<[string, string]>) => {
  let valueStr = JSON.stringify(value)
  if (valueStr.length <= limit) {
    datas.push([key, valueStr])
    return
  }

  const partKeys = []
  for (let i = 0, len = Math.floor(valueStr.length / limit); i <= len; i++) {
    let partKey = `${partKeyArrPrefix}${key}${i}`
    partKeys.push(partKey)
    datas.push([partKey, valueStr.substring(i * limit, (i + 1) * limit)])
  }
  datas.push([key, partKeyArrPrefix + JSON.stringify(partKeys)])
}

// 1.4.0 之前的数据分片存储方式，存在key的内容与分隔符冲突的问题
// 1.4.0 开始改用数组存储，不再使用分隔符的方式
const handleGetDataOld = async<T>(partKeys: string): Promise<T> => {
  const keys = partKeys.replace(partKeyPrefixRxp, '').split(keySplit)

  return AsyncStorage.multiGet(keys).then(datas => {
    return JSON.parse(datas.map(data => data[1]).join(''))
  })
}

const handleGetData = async<T>(partKeys: string): Promise<T> => {
  if (partKeys.startsWith(partKeyPrefix)) return handleGetDataOld<T>(partKeys)

  const keys = JSON.parse(partKeys.replace(partKeyArrPrefixRxp, '')) as string[]
  return AsyncStorage.multiGet(keys).then(datas => {
    return JSON.parse(datas.map(data => data[1]).join(''))
  })
}

const writeData = async(key: string, value: any) => {
  const datas: Array<[string, string]> = []
  buildData(key, value, datas)

  try {
    await removeDataNow(key)
    await AsyncStorage.multiSet(datas)
  } catch (e: any) {
    // saving error
    log.error('storage error[saveData]:', key, e.message)
    throw e
  }
}

export const getData = async<T = unknown>(key: string): Promise<T | null> => {
  let value: string | null
  try {
    value = await AsyncStorage.getItem(key)
  } catch (e: any) {
    // error reading value
    log.error('storage error[getData]:', key, e.message)
    throw e
  }
  if (value && (partKeyPrefixRxp.test(value) || partKeyArrPrefixRxp.test(value))) {
    return handleGetData<T>(value)
  } else if (value == null) return value
  return JSON.parse(value)
}

const removeDataNow = async(key: string) => {
  let value: string | null
  try {
    value = await AsyncStorage.getItem(key)
  } catch (e: any) {
    // error reading value
    log.error('storage error[removeData]:', key, e.message)
    throw e
  }
  if (value) {
    if (partKeyPrefixRxp.test(value)) {
      let partKeys = value.replace(partKeyPrefixRxp, '').split(keySplit)
      partKeys.push(key)
      try {
        await AsyncStorage.multiRemove(partKeys)
      } catch (e: any) {
        // remove error
        log.error('storage error[removeData]:', key, e.message)
        throw e
      }
      return
    } else if (partKeyArrPrefixRxp.test(value)) {
      let partKeys = JSON.parse(value.replace(partKeyArrPrefixRxp, '')) as string[]
      partKeys.push(key)
      try {
        await AsyncStorage.multiRemove(partKeys)
      } catch (e: any) {
        // remove error
        log.error('storage error[removeData]:', key, e.message)
        throw e
      }
      return
    }
  }

  try {
    await AsyncStorage.removeItem(key)
  } catch (e: any) {
    // remove error
    log.error('storage error[removeData]:', key, e.message)
    throw e
  }
}

export const getAllKeys = async() => {
  let keys
  try {
    keys = await AsyncStorage.getAllKeys()
  } catch (e: any) {
    // read key error
    log.error('storage error[getAllKeys]:', e.message)
    throw e
  }

  return keys
}


export const getDataMultiple = async<T extends readonly string[]>(keys: T) => {
  type RawData = { [K in keyof T]: [T[K], string | null] }
  let datas: RawData
  try {
    datas = await AsyncStorage.multiGet(keys) as RawData
  } catch (e: any) {
    // read error
    log.error('storage error[getDataMultiple]:', e.message)
    throw e
  }
  const promises: Array<Promise<ReadonlyArray<[unknown | null]>>> = []
  for (const [, value] of datas) {
    if (value && (partKeyPrefixRxp.test(value) || partKeyArrPrefixRxp.test(value))) {
      promises.push(handleGetData(value))
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      promises.push(Promise.resolve(value ? JSON.parse(value) : value))
    }
  }
  return Promise.all(promises).then(values => {
    return datas.map(([key], index) => ([key, values[index]])) as { [K in keyof T]: [T[K], unknown] }
  })
}

const writeDataMultiple = async(datas: Array<[string, any]>) => {
  const allData: Array<[string, string]> = []
  for (const [key, value] of datas) {
    buildData(key, value, allData)
  }
  try {
    await removeDataMultipleNow(datas.map(k => k[0]))
    await AsyncStorage.multiSet(allData)
  } catch (e: any) {
    // save error
    log.error('storage error[saveDataMultiple]:', e.message)
    throw e
  }
}


const removeDataMultipleNow = async(keys: string[]) => {
  if (!keys.length) return
  const datas = await AsyncStorage.multiGet(keys)
  let allKeys = []
  for (const [key, value] of datas) {
    allKeys.push(key)
    if (value) {
      if (partKeyPrefixRxp.test(value)) {
        allKeys.push(...value.replace(partKeyPrefixRxp, '').split(keySplit))
      } else if (partKeyArrPrefixRxp.test(value)) {
        allKeys.push(...JSON.parse(value.replace(partKeyArrPrefixRxp, '')) as string[])
      }
    }
  }
  try {
    await AsyncStorage.multiRemove(allKeys)
  } catch (e: any) {
    // remove error
    log.error('storage error[removeDataMultiple]:', e.message)
    throw e
  }
}

const clearAllNow = async() => {
  try {
    await AsyncStorage.clear()
  } catch (e: any) {
    // clear error
    log.error('storage error[clearAll]:', e.message)
    throw e
  }
}

export const saveData = async(key: string, value: any) => queueWrite(async() => writeData(key, value))
export const removeData = async(key: string) => queueWrite(async() => removeDataNow(key))
export const saveDataMultiple = async(datas: Array<[string, any]>) => queueWrite(async() => writeDataMultiple(datas))
export const removeDataMultiple = async(keys: string[]) => queueWrite(async() => removeDataMultipleNow(keys))
export const clearAll = async() => queueWrite(clearAllNow)

export const getLogicalStorageSnapshot = async(include: (key: string) => boolean) => queueWrite(async() => {
  const keys = (await getAllKeys()).filter(key => !key.startsWith(partKeyPrefix) && !key.startsWith(partKeyArrPrefix) && include(key)).sort()
  return getDataMultiple(keys)
})

interface RestoreJournal { before: Array<[string, string]>, replacementKeys: string[] }
const rollbackRestore = async(journal: RestoreJournal) => {
  if (!Array.isArray(journal.before) || !Array.isArray(journal.replacementKeys)) throw new Error('恢复日志损坏')
  if (journal.replacementKeys.length) await AsyncStorage.multiRemove(journal.replacementKeys)
  if (journal.before.length) await AsyncStorage.multiSet(journal.before)
  await removeDataNow(restoreJournalKey)
}

// Run before any startup reads. An interrupted restore returns to the previous snapshot.
export const recoverPendingStorageRestore = async() => queueWrite(async() => {
  const journal = await getData<RestoreJournal>(restoreJournalKey)
  if (journal) await rollbackRestore(journal)
})

export const replaceStorageSnapshot = async(records: Array<[string, unknown]>, include: (key: string) => boolean) => queueWrite(async() => {
  const currentKeys = (await getAllKeys()).filter(key => !key.startsWith(partKeyPrefix) && !key.startsWith(partKeyArrPrefix) && include(key))
  if (new Set(records.map(([key]) => key)).size != records.length || records.some(([key]) => !include(key))) throw new Error('备份包含无效或重复的数据键')
  const encoded: Array<[string, string]> = []
  for (const [key, value] of records) buildData(key, value, encoded)
  const oldRaw = await AsyncStorage.multiGet(await getAllKeys())
  const affected = new Set(currentKeys)
  for (const [key, value] of oldRaw) {
    if (!affected.has(key) || !value) continue
    if (value.startsWith(partKeyArrPrefix)) for (const part of JSON.parse(value.slice(partKeyArrPrefix.length)) as string[]) affected.add(part)
    else if (value.startsWith(partKeyPrefix)) for (const part of value.slice(partKeyPrefix.length).split(keySplit)) affected.add(part)
  }
  const journal: RestoreJournal = {
    before: oldRaw.filter((pair): pair is [string, string] => affected.has(pair[0]) && pair[1] != null),
    replacementKeys: encoded.map(([key]) => key),
  }
  await writeData(restoreJournalKey, journal)
  try {
    if (affected.size) await AsyncStorage.multiRemove([...affected])
    if (encoded.length) await AsyncStorage.multiSet(encoded)
    const verified = await AsyncStorage.multiGet(encoded.map(([key]) => key))
    if (verified.some(([key, value], index) => key != encoded[index][0] || value != encoded[index][1])) throw new Error('恢复数据校验失败')
    await removeDataNow(restoreJournalKey)
    writes.frozen = true
  } catch (error) {
    try { await rollbackRestore(journal) } catch {
      writes.frozen = true
      const recoveryError = new Error('恢复失败，旧数据恢复尚未完成；重新打开软件会再次尝试恢复旧数据')
      recoveryError.name = 'StorageRestoreRecoveryError'
      throw recoveryError
    }
    throw error
  }
})
