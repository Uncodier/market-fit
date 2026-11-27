/** @jest-environment jsdom */
import { localRealtimeOptions, recordResourceSignal } from '@/lib/supabase/realtime-diagnostics'

it('requires opt-in and reports only tab-local aggregate counts', () => {
  const native = window.WebSocket
  const key = 'mf:realtime-diagnostics'
  const target = window as Window & { mfRealtimeSnapshot?: () => unknown }
  const client = () => ({ realtime: { isConnected: () => true }, getChannels: () => ['private-topic'] })
  try {
    expect(localRealtimeOptions(client)).toEqual({})
    expect(target.mfRealtimeSnapshot).toBeUndefined()
    window.sessionStorage.setItem(key, '1')
    window.WebSocket = EventTarget as unknown as typeof WebSocket
    const { transport: Socket } = localRealtimeOptions(client)
    if (!Socket) throw new Error('Diagnostic transport missing')
    new Socket('wss://example.invalid').dispatchEvent(new Event('open'))
    new Socket('wss://example.invalid')
    recordResourceSignal('realtime')
    recordResourceSignal('readsStarted')
    expect(target.mfRealtimeSnapshot?.()).toEqual({ connectedSockets: 1, channels: 1,
      socketAttempts: 2, socketOpens: 1, siteResources: { local: 0, broadcast: 0, realtime: 1, readsStarted: 1 } })
  } finally {
    window.WebSocket = native
    window.sessionStorage.removeItem(key)
    delete target.mfRealtimeSnapshot
  }
})