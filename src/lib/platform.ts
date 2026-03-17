/**
 * Platform detection — determines if we're running in Tauri, Capacitor, or plain web.
 */

export type Platform = 'tauri' | 'capacitor' | 'web'

export function getPlatform(): Platform {
  // Tauri injects __TAURI_INTERNALS__ on the window object
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    return 'tauri'
  }
  // Capacitor injects Capacitor on the window object
  if (typeof window !== 'undefined' && 'Capacitor' in window) {
    return 'capacitor'
  }
  return 'web'
}

export const isTauri = () => getPlatform() === 'tauri'
export const isCapacitor = () => getPlatform() === 'capacitor'
export const isNative = () => getPlatform() !== 'web'
export const isWeb = () => getPlatform() === 'web'

/**
 * Open a URL in the system browser.
 * - Tauri: uses @tauri-apps/plugin-opener
 * - Capacitor: uses @capacitor/browser (when installed) or falls back to window.open
 * - Web: window.open
 */
export async function openExternal(url: string): Promise<void> {
  const platform = getPlatform()

  if (platform === 'tauri') {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(url)
      return
    } catch { /* fall through */ }
  }

  // Capacitor Browser plugin or plain web
  window.open(url, '_blank')
}
