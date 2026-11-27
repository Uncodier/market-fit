// Development-only, tab-local counters. Never collect topics, URLs, payloads or identities.
type Client = { getChannels(): readonly unknown[]; realtime: { isConnected(): boolean } }
type ResourceSignal = 'local' | 'broadcast' | 'realtime'
let counts: Record<ResourceSignal | 'readsStarted', number> | undefined

export function recordResourceSignal(source: ResourceSignal | 'readsStarted') {
  if (counts) counts[source]++
}

export function localRealtimeOptions(client: () => Client | null) {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined' || typeof WebSocket === 'undefined') return {}
  try {
    if (window.sessionStorage.getItem('mf:realtime-diagnostics') !== '1') return {}
  } catch { return {} }

  const resources = { local: 0, broadcast: 0, realtime: 0, readsStarted: 0 }
  let attempts = 0
  let opens = 0
  class DiagnosticSocket extends WebSocket {
    constructor(address: string | URL, protocols?: string | string[]) {
      super(address, protocols)
      attempts++
      this.addEventListener('open', () => { opens++ }, { once: true })
    }
  }
  Object.assign(window, { mfRealtimeSnapshot: () => {
    const sdk = client()
    return { connectedSockets: Number(sdk?.realtime.isConnected() ?? false), channels: sdk?.getChannels().length ?? 0,
      socketAttempts: attempts, socketOpens: opens, siteResources: { ...resources } }
  } })
  counts = resources
  return { transport: DiagnosticSocket }
}