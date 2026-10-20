import { NativeModules } from 'react-native'
import { version as bundledVersion } from '../../package.json'

// The installed APK is authoritative. package.json can be stale in an
// incrementally cached JS bundle, or differ from a Metro development client.
const installedVersion: unknown = NativeModules.UtilsModule?.appVersion
export const appVersion = typeof installedVersion == 'string' && installedVersion.trim()
  ? installedVersion.trim()
  : bundledVersion
