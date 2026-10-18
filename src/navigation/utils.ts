import { Navigation } from 'react-native-navigation'
import {
  VERSION_MODAL,
  SYNC_MODE_MODAL,
} from './screenNames'
import themeState from '@/store/theme/state'

const overlayAnimations = {
  showModal: {
    enter: {
      alpha: {
        from: 0,
        to: 1,
        duration: 190,
        interpolation: { type: 'decelerate' as const },
      },
    },
    exit: {
      alpha: {
        from: 1,
        to: 0,
        duration: 150,
        interpolation: { type: 'accelerate' as const },
      },
    },
  },
}


export const getStatusBarStyle = (isDark: boolean) => isDark ? 'light' : 'dark'

export const dismissOverlay = async(compId: string) => Navigation.dismissOverlay(compId)

export const pop = async(compId: string) => Navigation.pop(compId)
export const popToRoot = async(compId: string) => Navigation.popToRoot(compId)
export const popTo = async(compId: string) => Navigation.popTo(compId)

const showAppOverlay = (name: string) => {
  const theme = themeState.theme
  void Navigation.showOverlay({
    component: {
      name,
      options: {
        animations: overlayAnimations,
        layout: { componentBackgroundColor: 'transparent' },
        overlay: { interceptTouchOutside: true },
        statusBar: {
          drawBehind: true,
          visible: true,
          style: getStatusBarStyle(theme.isDark),
          backgroundColor: 'transparent',
        },
        navigationBar: { backgroundColor: theme['c-content-background'] },
      },
    },
  })
}

export const showVersionModal = () => { showAppOverlay(VERSION_MODAL) }
export const showSyncModeModal = () => { showAppOverlay(SYNC_MODE_MODAL) }
