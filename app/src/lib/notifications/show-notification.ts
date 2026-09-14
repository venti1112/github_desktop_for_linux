import { focusWindow } from '../../ui/main-process-proxy'
import { supportsNotifications } from 'desktop-notifications'
import { showNotification as invokeShowNotification } from '../../ui/main-process-proxy'
import { notificationCallbacks } from './notification-handler'
import { DesktopAliveEvent } from '../stores/alive-store'

interface IShowNotificationOptions {
  title: string
  body: string
  userInfo?: DesktopAliveEvent
  onClick: () => void
}

/**
 * Shows a notification with a title, a body, and a function to handle when the
 * user clicks on the notification.
 */
export async function showNotification(options: IShowNotificationOptions) {
  // desktop-notifications implements macOS and Windows only. Linux is handled
  // by Electron's main-process Notification API, so it must use IPC as well.
  if (!__LINUX__ && !supportsNotifications()) {
    const notification = new Notification(options.title, {
      body: options.body,
    })

    notification.onclick = () => {
      focusWindow()
      options.onClick()
    }
    return
  }

  const notificationID = await invokeShowNotification(
    options.title,
    options.body,
    options.userInfo
  )
  if (notificationID !== null) {
    notificationCallbacks.set(notificationID, options.onClick)
  }
}
