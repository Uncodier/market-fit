import React from 'react'
import { act, render } from '@testing-library/react'
import TrackingInit from '@/app/components/TrackingInit'

type TrackerWindow = Window & {
  Makinari?: { siteId?: string; init?: jest.Mock }
  MarketFit?: { siteId?: string; init?: jest.Mock }
}

describe('tracking script head reference', () => {
  const trackerWindow = window as TrackerWindow
  beforeEach(() => {
    jest.useFakeTimers()
    delete trackerWindow.Makinari
    delete trackerWindow.MarketFit
  })
  afterEach(() => {
    document.head.querySelectorAll('script[src*="files.uncodie.com/tracking.min.js"]').forEach(script => script.remove())
    delete trackerWindow.Makinari
    delete trackerWindow.MarketFit
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('injects the newly compiled cache-busted version into the head', () => {
    render(<TrackingInit />)
    act(() => { jest.advanceTimersByTime(2500) })
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="tracking.min.js"]')
    expect(script?.src).toBe('https://files.uncodie.com/tracking.min.js?v=1.965')
    expect(script?.async).toBe(true)
    const init = jest.fn()
    trackerWindow.Makinari!.init = init
    act(() => { script!.dispatchEvent(new Event('load')) })
    expect(init).toHaveBeenCalledWith(expect.objectContaining({
      trackVisitors: true, trackActions: true,
      chat: expect.objectContaining({ requireIdentityToken: true, allowAnonymousMessages: false }),
    }))
  })

  it('does not reinitialize an already loaded tracker during client navigation', () => {
    trackerWindow.Makinari = { init: jest.fn() }
    render(<TrackingInit />)
    act(() => { jest.advanceTimersByTime(2500) })
    expect(document.head.querySelector('script[src*="tracking.min.js"]')).toBeNull()
    expect(trackerWindow.Makinari.init).not.toHaveBeenCalled()
  })
})