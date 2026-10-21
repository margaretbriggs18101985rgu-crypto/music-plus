import { DeviceEventEmitter } from 'react-native'

export const LIBRARY_ROUTE_EVENT = 'LXLibraryRoute'
type LibraryRoute = 'recent'
let pendingRoute: LibraryRoute | null = null

export const requestLibraryRoute = (route: LibraryRoute) => {
  pendingRoute = route
  DeviceEventEmitter.emit(LIBRARY_ROUTE_EVENT)
}

export const consumeLibraryRoute = () => {
  const route = pendingRoute
  pendingRoute = null
  return route
}
