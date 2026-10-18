import { AppState } from 'react-native'
import { compareVer } from '@/utils'
import { downloadNewVersion, getVersionInfo, updateApp } from '@/utils/version'
import versionActions from '@/store/version/action'
import versionState, { type InitState } from '@/store/version/state'
import { getIgnoreVersion, saveIgnoreVersion } from '@/utils/data'
import { showVersionModal } from '@/navigation'
import { Navigation } from 'react-native-navigation'
import { toast } from '@/utils/tools'

const CHECK_INTERVAL = 15 * 60 * 1000
const RETRY_INTERVAL = 60 * 1000
const runtime = {
  lastCheckTime: 0,
  checking: null as Promise<void> | null,
  autoCheckStarted: false,
  promptedVersion: null as string | null,
  installing: false,
  downloadedPrompted: false,
}

export const showModal = () => {
  if (versionState.showModal) return
  versionActions.setVisibleModal(true)
  showVersionModal()
}

export const hideModal = (componentId: string) => {
  if (!versionState.showModal) return
  versionActions.setVisibleModal(false)
  void Navigation.dismissOverlay(componentId)
}

const promptUpdate = async() => {
  const { newVersion, isLatest, isUnknown } = versionState.versionInfo
  if (!newVersion || isLatest || isUnknown || AppState.currentState != 'active') return
  const ignoredVersion = await getIgnoreVersion()
  if (AppState.currentState != 'active' || runtime.promptedVersion == newVersion.version || newVersion.version == ignoredVersion) return
  runtime.promptedVersion = newVersion.version
  showModal()
}

// Manual checks bypass the cooldown and ignored version, and always show a result.
export const checkUpdate = async({ manual = false }: { manual?: boolean } = {}) => {
  if (manual) showModal()
  const { status } = versionState.versionInfo
  if (status == 'downloading' || status == 'downloaded') {
    if (status == 'downloaded' && AppState.currentState == 'active' && !runtime.downloadedPrompted) {
      runtime.downloadedPrompted = true
      showModal()
    }
    return
  }
  if (runtime.checking) return runtime.checking
  if (!manual) {
    if (AppState.currentState != 'active' || versionState.showModal) return
    const interval = versionState.versionInfo.isUnknown ? RETRY_INTERVAL : CHECK_INTERVAL
    if (runtime.lastCheckTime && Date.now() - runtime.lastCheckTime < interval) return promptUpdate()
  }

  versionActions.setVersionInfo({ status: 'checking', isLatest: false, isUnknown: false })
  runtime.checking = (async() => {
    try {
      const { version, desc, history } = await getVersionInfo()
      const ignoreVersion = await getIgnoreVersion()
      versionActions.setIgnoreVersion(ignoreVersion)
      if (manual) runtime.promptedVersion = version
      versionActions.setVersionInfo({
        newVersion: { version, desc, history },
        isLatest: compareVer(versionState.versionInfo.version, version) >= 0,
        isUnknown: false,
        status: 'idle',
      })
      if (!manual) await promptUpdate()
    } catch {
      versionActions.setVersionInfo({ newVersion: null, isLatest: false, isUnknown: true, status: 'error' })
      // Automatic network failures stay quiet; manual checks display the retry action.
    } finally {
      runtime.lastCheckTime = Date.now()
    }
  })()
  try {
    await runtime.checking
  } finally {
    runtime.checking = null
  }
}

export const startAutoUpdateCheck = () => {
  if (runtime.autoCheckStarted) return
  runtime.autoCheckStarted = true
  void checkUpdate()
  AppState.addEventListener('change', state => {
    if (state == 'active') void checkUpdate()
  })
  setInterval(() => {
    if (AppState.currentState == 'active') void checkUpdate()
  }, CHECK_INTERVAL)
}

export const installDownloadedUpdate = async() => {
  if (runtime.installing) return
  runtime.installing = true
  try {
    await updateApp()
  } catch {
    toast(global.i18n.t('version_tip_install_failed'))
  } finally {
    runtime.installing = false
  }
}

export const downloadUpdate = async() => {
  if (versionState.versionInfo.status == 'downloading') return
  const version = versionState.versionInfo.newVersion?.version
  if (!version || versionState.versionInfo.isLatest || versionState.versionInfo.isUnknown) return
  versionActions.setVersionInfo({ status: 'downloading' })
  runtime.downloadedPrompted = false
  versionActions.setProgress({ total: 0, current: 0 })
  try {
    await downloadNewVersion(version, (total: number, current: number) => {
      versionActions.setProgress({ total, current })
    })
    versionActions.setVersionInfo({ status: 'downloaded' })
    if (AppState.currentState == 'active') {
      runtime.downloadedPrompted = true
      showModal()
      await installDownloadedUpdate()
    }
  } catch {
    versionActions.setVersionInfo({ status: 'error' })
  }
}


export const setIgnoreVersion = (version: InitState['ignoreVersion']) => {
  versionActions.setIgnoreVersion(version)
  saveIgnoreVersion(version)
}
