const event = 'workspace:screen-access-changed'
const channelName = 'mf-screen-access-v1'

/** Confirmed local edits invalidate a decision; the message can never grant one. */
export function notifyScreenScopeChanged(siteId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(event, { detail: siteId }))
  try {
    if (!window.BroadcastChannel) return
    const channel = new window.BroadcastChannel(channelName)
    try { channel.postMessage(siteId) } finally { channel.close() }
  } catch { /* Cross-tab delivery is best effort. Database authorization is not. */ }
}

export function onScreenScopeChanged(siteId: string, refresh: () => void) {
  const listener = (e: Event) => { if (e instanceof CustomEvent && e.detail === siteId) refresh() }
  window.addEventListener(event, listener)
  let channel: BroadcastChannel | undefined
  try {
    if (window.BroadcastChannel) {
      channel = new window.BroadcastChannel(channelName)
      channel.onmessage = e => { if (e.data === siteId) refresh() }
    }
  } catch { /* Some browser privacy modes disallow BroadcastChannel. */ }
  return () => { window.removeEventListener(event, listener); channel?.close() }
}