import React from 'react'
import { createHash, randomBytes } from 'node:crypto'
import '@testing-library/jest-dom'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AutoTopUpCard } from '@/app/components/billing/auto-top-up-card'
import { readTopUpSettings, TOP_UP_REQUEST_TIMEOUT_MS, type TopUpSettings } from '@/app/components/billing/auto-top-up-state'

// Keep the real inputs, Radix switch/checkbox, and card; isolate permission/animation infrastructure.
jest.mock('@/app/components/ui/button', () => ({
  Button: ({ variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => <button data-variant={variant} data-size={size} {...props} />,
}))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))

const initial: TopUpSettings = {
  enabled: false, minimumCredits: 5, targetCredits: 20, maxMonthlySpendCents: 10000,
  paymentMethodReady: true, state: 'ready',
}
const originalFetch = global.fetch
const originalLocation = window.location
const mockFetch = jest.fn()
const mockAssign = jest.fn()
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = () => act(async () => { await Promise.resolve() })
const toggle = () => screen.getByRole('switch', { name: 'Enable automatic top-up' })
const save = () => screen.getByRole('button', { name: 'Save top-up settings' })
const consent = () => screen.getByRole('checkbox', { name: /I authorize automatic charges/ })
const minimum = () => screen.getByRole('spinbutton', { name: 'Minimum credits' })
const target = () => screen.getByRole('spinbutton', { name: 'Target credits' })
const cap = () => screen.getByRole('spinbutton', { name: 'Monthly spend cap (USD)' })
const reload = () => screen.getByRole('button', { name: 'Reload saved settings' })
const payload = (index = 1) => JSON.parse(mockFetch.mock.calls[index][1].body)
const signal = (index: number): AbortSignal => mockFetch.mock.calls[index][1].signal
function expectFooterActions() {
  const footer = screen.getByTestId('auto-top-up-footer')
  expect(footer).toHaveClass('flex', 'flex-wrap')
  for (const button of screen.getAllByRole('button').filter(button => !button.getAttribute('aria-label')?.startsWith('Help:'))) {
    expect(footer).toContainElement(button)
    expect(screen.getByTestId('auto-top-up-content')).not.toContainElement(button)
    expect(button).toHaveAttribute('data-variant', 'outline')
    expect(button).toHaveAttribute('data-size', 'sm')
  }
}
async function mount(overrides: Partial<TopUpSettings> = {}) {
  mockFetch.mockResolvedValueOnce(response({ settings: { ...initial, ...overrides } }))
  const view = render(<AutoTopUpCard siteId="site-a" />)
  await flush()
  return view
}
beforeEach(() => {
  mockFetch.mockReset().mockRejectedValue(new Error('Unexpected offline request'))
  mockAssign.mockReset()
  global.fetch = mockFetch
  Object.defineProperty(window, 'location', { configurable: true, value: { assign: mockAssign } })
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
  global.fetch = originalFetch
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
})

describe('automatic top-up settings and consent', () => {
  it('keeps legacy DTOs compatible with optional card defaults and puts every action in the footer', async () => {
    expect(readTopUpSettings({ settings: initial })).toMatchObject({ billingCardAvailable: false, paymentMethod: null, paymentMethodSource: null })
    await mount()
    expectFooterActions()
    expect(screen.queryByText('Billing card (default)')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reload saved settings' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry loading settings' })).not.toBeInTheDocument()
  })

  it.each([
    { paymentMethodReady: false, paymentMethodSource: 'billing' as const },
    { paymentMethodReady: true, paymentMethodSource: 'billing' as const },
    { paymentMethodReady: false, paymentMethodSource: null },
  ])('uses the default Billing card with explicit consent and no setup POST: %j', async cardState => {
    const billingCardFingerprint = createHash('sha256').update(randomBytes(32)).digest('hex')
    await mount({ ...cardState, billingCardAvailable: true, billingCardFingerprint,
      paymentMethod: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 } })
    expect(screen.getByText('Billing card (default)')).toBeVisible()
    expect(screen.getByText('visa •••• 4242')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Help: Automatic credit top-up' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Your primary Billing card is used by default/)
    expect(screen.getByRole('button', { name: 'Use another card' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Authorize a card for top-ups' })).not.toBeInTheDocument()
    expectFooterActions()
    fireEvent.click(toggle())
    expect(consent()).not.toBeChecked()
    expect(save()).toBeDisabled()
    fireEvent.click(save())
    expect(mockFetch).toHaveBeenCalledTimes(1)
    mockFetch.mockResolvedValueOnce(response({ success: true }))
    fireEvent.click(consent())
    expect(save()).toBeEnabled()
    fireEvent.click(save())
    await flush()
    expect(payload()).toEqual({ siteId: 'site-a', enabled: true, minimumCredits: 5, targetCredits: 20, maxMonthlySpendCents: 10000, consentAccepted: true, billingCardFingerprint })
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[1][0]).toBe('/api/stripe/auto-top-up')
    expect(mockAssign).not.toHaveBeenCalled()
    expect(consent()).not.toBeChecked()
  })

  it('opens optional setup only when Use another card is clicked, without a card summary', async () => {
    await mount({ paymentMethodReady: false, billingCardAvailable: true })
    expect(screen.queryByText('Billing card (default)')).not.toBeInTheDocument()
    const otherCard = screen.getByRole('button', { name: 'Use another card' })
    expect(otherCard).toHaveAccessibleDescription(/immediately disables future automatic top-ups/)
    expectFooterActions()
    mockFetch.mockResolvedValueOnce(response({ url: 'https://checkout.example.test/another-card' }))
    fireEvent.click(otherCard)
    await flush()
    expect(mockFetch.mock.calls[1][0]).toBe('/api/stripe/auto-top-up/setup')
    expect(payload()).toEqual({ siteId: 'site-a' })
    expect(mockAssign).toHaveBeenCalledWith('https://checkout.example.test/another-card')
    expect(save()).toBeDisabled()
  })

  it('labels an explicit top-up card separately and never submits a Billing fingerprint for it', async () => {
    await mount({ billingCardAvailable: true, paymentMethodSource: 'top_up',
      billingCardFingerprint: createHash('sha256').update(randomBytes(32)).digest('hex'),
      paymentMethod: { brand: 'mastercard', last4: '4444', expMonth: 6, expYear: 2031 } })
    expect(screen.getByText('Selected top-up card')).toBeVisible()
    expect(screen.getByText('mastercard •••• 4444')).toBeVisible()
    expect(screen.queryByText('Billing card (default)')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Use another card' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace top-up card' })).toBeEnabled()
    expectFooterActions()
    fireEvent.click(toggle())
    fireEvent.click(consent())
    mockFetch.mockResolvedValueOnce(response({ success: true }))
    fireEvent.click(save())
    await flush()
    expect(payload()).not.toHaveProperty('billingCardFingerprint')
    expect(payload()).toMatchObject({ enabled: true, consentAccepted: true })
  })

  it('loads site-scoped settings without caching and renders English when translations return keys', async () => {
    await mount()
    expect(mockFetch).toHaveBeenCalledWith('/api/stripe/auto-top-up?siteId=site-a', expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }))
    expect(screen.getByText('Automatic credit top-up')).toBeInTheDocument()
    expect(toggle()).not.toBeChecked()
    expect(minimum()).toHaveValue(5)
    expect(target()).toHaveValue(20)
    expect(cap()).toHaveValue(100)
    expect(screen.queryByText(/payment is pending/)).not.toBeInTheDocument()
    expect(screen.queryByText(/paused and need attention/)).not.toBeInTheDocument()
  })

  it('uses defaults only for explicit null settings and never treats them as saved consent', async () => {
    mockFetch.mockResolvedValueOnce(response({ settings: null }))
    render(<AutoTopUpCard siteId="site-a" />)
    await flush()
    expect(toggle()).not.toBeChecked()
    fireEvent.click(toggle())
    expect(consent()).not.toBeChecked()
    fireEvent.click(consent())
    fireEvent.click(save())
    expect(screen.getByRole('alert')).toHaveTextContent('Set up a card')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('requires explicit opt-in, does not enable on toggle alone, and posts consentAccepted:true', async () => {
    await mount()
    fireEvent.click(toggle())
    expect(consent()).not.toBeChecked()
    expect(save()).toBeDisabled()
    fireEvent.click(save())
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Saved setting: automatic top-up is disabled.')).toBeInTheDocument()
    mockFetch.mockResolvedValueOnce(response({ success: true }))
    fireEvent.click(consent())
    fireEvent.click(save())
    await flush()
    expect(payload()).toEqual({ siteId: 'site-a', enabled: true, minimumCredits: 5, targetCredits: 20, maxMonthlySpendCents: 10000, consentAccepted: true })
    expect(screen.getByText('Saved setting: automatic top-up is enabled.')).toBeInTheDocument()
    expect(screen.getByText('Automatic top-up settings saved.')).toBeInTheDocument()
    expect(consent()).not.toBeChecked()
  })

  it('requires fresh consent for updates to enabled settings and clears consent when limits change', async () => {
    await mount({ enabled: true })
    expect(consent()).not.toBeChecked()
    expect(save()).toBeDisabled()
    fireEvent.click(consent())
    fireEvent.change(target(), { target: { value: '30' } })
    expect(consent()).not.toBeChecked()
    expect(save()).toBeDisabled()
    mockFetch.mockResolvedValueOnce(response({ success: true }))
    fireEvent.click(consent())
    fireEvent.click(save())
    await flush()
    expect(payload()).toMatchObject({ enabled: true, targetCredits: 30, consentAccepted: true })
    fireEvent.change(target(), { target: { value: '40' } })
    expect(screen.queryByText('Automatic top-up settings saved.')).not.toBeInTheDocument()
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument()
  })

  it.each(['', '5', '10001'])('rejects invalid target %j without posting or claiming success', async value => {
    await mount()
    fireEvent.change(target(), { target: { value } })
    fireEvent.click(save())
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a minimum below the target')
    expect(screen.queryByRole('button', { name: 'Reload saved settings' })).not.toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Automatic top-up settings saved.')).not.toBeInTheDocument()
  })

  it('allows valid disabled configuration edits without consent', async () => {
    await mount()
    fireEvent.change(target(), { target: { value: '30' } })
    mockFetch.mockResolvedValueOnce(response({ success: true }))
    fireEvent.click(save())
    await flush()
    expect(payload()).toMatchObject({ enabled: false, targetCredits: 30, consentAccepted: false })
    expect(screen.queryByRole('button', { name: 'Reload saved settings' })).not.toBeInTheDocument()
  })

  it.each([
    { state: 'paused', pending: true, needsAttention: true },
    { state: 'ready', pending: true, needsAttention: false },
    { state: 'ready', needsAttention: true },
    { state: 'ready' },
  ])('immediately disables enabled settings using stored limits, even with invalid edits: %j', async status => {
    await mount({ enabled: true, ...status })
    fireEvent.change(minimum(), { target: { value: '900' } })
    fireEvent.change(target(), { target: { value: '' } })
    fireEvent.change(cap(), { target: { value: '0' } })
    expect(toggle()).toBeEnabled()
    mockFetch.mockResolvedValueOnce(response({ success: true }))
    fireEvent.click(toggle())
    await flush()
    expect(payload()).toEqual({ siteId: 'site-a', enabled: false, minimumCredits: 5, targetCredits: 20, maxMonthlySpendCents: 10000, consentAccepted: false })
    expect(toggle()).not.toBeChecked()
    expect(minimum()).toHaveValue(5)
    expect(target()).toHaveValue(20)
    expect(cap()).toHaveValue(100)
    expect(screen.getByText(/does not cancel an in-flight payment/)).toBeInTheDocument()
    if (status.pending) expect(screen.getByText(/A top-up payment is pending. Do not repeat the payment./)).toBeInTheDocument()
  })

  it.each([{ state: 'paused' }, { needsAttention: true }, { pending: true }])('blocks re-enabling while unresolved: %j', async status => {
    await mount(status)
    expect(toggle()).toBeDisabled()
    if (status.pending) expect(screen.getByText(/No new automatic charge will be started while it is pending/)).toBeInTheDocument()
    else expect(screen.getByText(/paused and need attention. Do not repeat the payment/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reload saved settings' })).not.toBeInTheDocument()
  })
})

describe('busy states and unconfirmed requests', () => {
  it('locks every control during saving and confirms only the submitted snapshot', async () => {
    await mount({ enabled: true })
    fireEvent.change(target(), { target: { value: '30' } })
    fireEvent.click(consent())
    const pending = deferred<Response>()
    mockFetch.mockReturnValueOnce(pending.promise)
    fireEvent.click(save())
    for (const control of [minimum(), target(), cap(), consent(), toggle(), save(), screen.getByRole('button', { name: 'Replace top-up card' })]) expect(control).toBeDisabled()
    expect(screen.getByText('Saving top-up settings…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reload saved settings' })).not.toBeInTheDocument()
    // Even synthetic events cannot alter the submitted snapshot or start duplicate requests.
    fireEvent.change(target(), { target: { value: '50' } })
    fireEvent.click(save())
    expect(target()).toHaveValue(30)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    await act(async () => { pending.resolve(response({ success: true })) })
    expect(payload()).toMatchObject({ targetCredits: 30 })
    expect(target()).toHaveValue(30)
    expect(target()).toBeEnabled()
    expect(screen.queryByText('You have unsaved changes.')).not.toBeInTheDocument()
  })

  it.each([true, false])('warns that card setup disables future top-ups and discards edits (card ready: %s)', async paymentMethodReady => {
    await mount({ paymentMethodReady })
    const button = screen.getByRole('button', { name: paymentMethodReady ? 'Replace top-up card' : 'Authorize a card for top-ups' })
    expect(button).toHaveAccessibleDescription(/immediately disables future automatic top-ups and discards unsaved edits/)
    expect(screen.getByText(/Top-ups stay disabled until you explicitly re-enable them with new consent/)).toBeVisible()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('requires reload after setup failure, then explicit consent to save enabled settings again', async () => {
    await mount({ enabled: true })
    fireEvent.change(target(), { target: { value: '30' } })
    fireEvent.click(consent())
    const pending = deferred<Response>()
    mockFetch.mockReturnValueOnce(pending.promise)
    fireEvent.click(screen.getByRole('button', { name: 'Replace top-up card' }))
    expect(screen.getByText('Opening payment setup…')).toBeInTheDocument()
    expect(consent()).not.toBeChecked()
    expect(screen.queryByText('Saved setting: automatic top-up is enabled.')).not.toBeInTheDocument()
    for (const control of [minimum(), target(), cap(), consent(), toggle(), save()]) expect(control).toBeDisabled()
    await act(async () => { pending.reject(new Error('Offline')) })
    expect(screen.getByRole('alert')).toHaveTextContent('Payment setup could not be opened')
    expect(screen.getByRole('alert')).toHaveTextContent('Automatic top-up may already have been disabled. Reload saved settings')
    expect(screen.getByText(/Saved status is unconfirmed/)).toBeInTheDocument()
    for (const control of [minimum(), target(), cap(), consent(), toggle(), save(), screen.getByRole('button', { name: 'Replace top-up card' })]) expect(control).toBeDisabled()
    expect(reload()).toBeEnabled()
    fireEvent.click(save())
    fireEvent.click(screen.getByRole('button', { name: 'Replace top-up card' }))
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockAssign).not.toHaveBeenCalled()
    mockFetch.mockResolvedValueOnce(response({ settings: initial }))
    fireEvent.click(reload())
    await flush()
    expect(screen.getByText('Saved setting: automatic top-up is disabled.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reload saved settings' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Saved status is unconfirmed/)).not.toBeInTheDocument()
    expect(toggle()).not.toBeChecked()
    expect(target()).toHaveValue(20)
    expect(target()).toBeEnabled()
    fireEvent.click(toggle())
    expect(consent()).not.toBeChecked()
    expect(save()).toBeDisabled()
    mockFetch.mockResolvedValueOnce(response({ success: true }))
    fireEvent.click(consent())
    fireEvent.click(save())
    await flush()
    expect(payload(3)).toMatchObject({ enabled: true, targetCredits: 20, consentAccepted: true })
    expect(screen.getByText('Automatic top-up settings saved.')).toBeInTheDocument()
    mockFetch.mockResolvedValueOnce(response({ url: 'https://checkout.example.test/setup' }))
    fireEvent.click(screen.getByRole('button', { name: 'Replace top-up card' }))
    await flush()
    expect(mockAssign).toHaveBeenCalledWith('https://checkout.example.test/setup')
    expect(screen.queryByText('Automatic top-up settings saved.')).not.toBeInTheDocument()
    expect(screen.queryByText('Saved setting: automatic top-up is enabled.')).not.toBeInTheDocument()
    expect(save()).toBeDisabled()
  })

  it.each([response({ error: 'Unavailable' }, false), response({ success: false }), response({})])('does not optimistically disable or confirm failed/malformed saves', async result => {
    await mount({ enabled: true, state: 'paused' })
    mockFetch.mockResolvedValueOnce(result)
    fireEvent.click(toggle())
    await flush()
    expect(toggle()).toBeChecked()
    expect(screen.getByRole('alert')).toHaveTextContent('No change was confirmed')
    expect(screen.queryByText('Automatic top-up settings saved.')).not.toBeInTheDocument()
    expect(save()).toBeDisabled()
    mockFetch.mockResolvedValueOnce(response({ settings: { ...initial, enabled: false, state: 'paused', pending: true } }))
    fireEvent.click(reload())
    await flush()
    expect(toggle()).not.toBeChecked()
    expect(screen.getByText(/A top-up payment is pending/)).toBeInTheDocument()
    expect(mockFetch.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Reload saved settings' })).not.toBeInTheDocument()
  })

  it.each(['save', 'setup'])('bounds hung %s requests, ignores late completion, and never automatically retries POST', async operation => {
    jest.useFakeTimers()
    await mount()
    const pending = deferred<Response>()
    mockFetch.mockReturnValueOnce(pending.promise)
    fireEvent.click(operation === 'save' ? save() : screen.getByRole('button', { name: 'Replace top-up card' }))
    await act(async () => { jest.advanceTimersByTime(TOP_UP_REQUEST_TIMEOUT_MS) })
    expect(signal(1).aborted).toBe(true)
    expect(screen.getByRole('alert')).toHaveTextContent(operation === 'save' ? 'No change was confirmed' : 'Payment setup could not be opened')
    expect(reload()).toBeEnabled()
    expect(target()).toBeDisabled()
    expect(toggle()).toBeDisabled()
    expect(save()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Replace top-up card' })).toBeDisabled()
    expect(screen.getByText(/Saved status is unconfirmed/)).toBeInTheDocument()
    expect(screen.queryByText('Saved setting: automatic top-up is disabled.')).not.toBeInTheDocument()
    await act(async () => { pending.resolve(response({ success: true, url: 'https://checkout.example.test/late' })) })
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockAssign).not.toHaveBeenCalled()
    expect(screen.queryByText('Automatic top-up settings saved.')).not.toBeInTheDocument()
    mockFetch.mockResolvedValueOnce(response({ settings: initial }))
    fireEvent.click(reload())
    await flush()
    expect(target()).toBeEnabled()
    expect(toggle()).toBeEnabled()
    expect(screen.queryByText(/Saved status is unconfirmed/)).not.toBeInTheDocument()
  })
})

describe('loading, retries, and request lifecycle', () => {
  it.each([response({}, false), response({}), ...[
    { pending: 'yes' }, { billingCardAvailable: 'yes' }, { paymentMethodSource: 'other' },
    { paymentMethod: { brand: 'visa', last4: '4242', expMonth: 13, expYear: 2030 } },
    { billingCardFingerprint: 'invalid' },
  ].map(settings => response({ settings: { ...initial, ...settings } }))])('ends loading on errors/malformed settings and allows retry', async result => {
    mockFetch.mockResolvedValueOnce(result)
    render(<AutoTopUpCard siteId="site-a" />)
    await flush()
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load')
    expect(screen.queryByText('Loading settings…')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expectFooterActions()
    expect(screen.getAllByRole('button', { name: 'Retry loading settings' })).toHaveLength(1)
    mockFetch.mockResolvedValueOnce(response({ settings: initial }))
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading settings' }))
    await flush()
    expect(toggle()).not.toBeChecked()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each(['fetch', 'body'])('bounds a hung GET %s and ignores late stale data after retry', async phase => {
    jest.useFakeTimers()
    const pending = deferred<Response | Record<string, unknown>>()
    mockFetch.mockReturnValueOnce(phase === 'fetch' ? pending.promise : Promise.resolve({ ok: true, json: () => pending.promise }))
    render(<AutoTopUpCard siteId="site-a" />)
    await flush()
    await act(async () => { jest.advanceTimersByTime(TOP_UP_REQUEST_TIMEOUT_MS) })
    expect(signal(0).aborted).toBe(true)
    expect(screen.queryByText('Loading settings…')).not.toBeInTheDocument()
    mockFetch.mockResolvedValueOnce(response({ settings: { ...initial, targetCredits: 40 } }))
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading settings' }))
    await flush()
    const oldBody = { settings: { ...initial, targetCredits: 70 } }
    await act(async () => { pending.resolve(phase === 'fetch' ? response(oldBody) : oldBody) })
    expect(target()).toHaveValue(40)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not reuse old settings, drafts, consent, or messages across site changes', async () => {
    const view = await mount({ enabled: true })
    fireEvent.click(consent())
    mockFetch.mockResolvedValueOnce(response({ success: true }))
    fireEvent.click(save())
    await flush()
    expect(screen.getByText('Automatic top-up settings saved.')).toBeInTheDocument()
    fireEvent.click(consent())
    const pending = deferred<Response>()
    mockFetch.mockReturnValueOnce(pending.promise)
    view.rerender(<AutoTopUpCard siteId="site-b" />)
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.queryByText('Automatic top-up settings saved.')).not.toBeInTheDocument()
    await act(async () => { pending.resolve(response({ settings: { ...initial, enabled: true, minimumCredits: 8 } })) })
    expect(minimum()).toHaveValue(8)
    expect(consent()).not.toBeChecked()
    expect(mockFetch.mock.calls[2][0]).toContain('siteId=site-b')
  })

  it('ignores a late GET body across A → B → A, even if fetch ignores abort', async () => {
    const oldBody = deferred<Record<string, unknown>>()
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => oldBody.promise })
    const view = render(<AutoTopUpCard siteId="site-a" />)
    await flush()
    mockFetch.mockResolvedValueOnce(response({ settings: { ...initial, minimumCredits: 7 } }))
    view.rerender(<AutoTopUpCard siteId="site-b" />)
    await flush()
    expect(signal(0).aborted).toBe(true)
    mockFetch.mockResolvedValueOnce(response({ settings: { ...initial, minimumCredits: 9 } }))
    view.rerender(<AutoTopUpCard siteId="site-a" />)
    await flush()
    await act(async () => { oldBody.resolve({ settings: { ...initial, minimumCredits: 1 } }) })
    expect(minimum()).toHaveValue(9)
  })

  it('survives StrictMode cleanup without accepting the first load', async () => {
    const old = deferred<Response>()
    mockFetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response({ settings: { ...initial, targetCredits: 40 } }))
    render(<React.StrictMode><AutoTopUpCard siteId="site-a" /></React.StrictMode>)
    await flush()
    expect(signal(0).aborted).toBe(true)
    await act(async () => { old.resolve(response({ settings: initial })) })
    expect(target()).toHaveValue(40)
  })

  it.each(['load', 'save', 'setup'])('aborts %s on unmount and ignores late fulfillment', async operation => {
    const pending = deferred<Response>()
    const view = operation === 'load'
      ? (mockFetch.mockReturnValueOnce(pending.promise), render(<AutoTopUpCard siteId="site-a" />))
      : await mount()
    if (operation !== 'load') {
      mockFetch.mockReturnValueOnce(pending.promise)
      fireEvent.click(operation === 'save' ? save() : screen.getByRole('button', { name: 'Replace top-up card' }))
    }
    const activeSignal = signal(operation === 'load' ? 0 : 1)
    view.unmount()
    expect(activeSignal.aborted).toBe(true)
    await act(async () => { pending.resolve(response({ settings: initial, success: true, url: 'https://checkout.example.test/old' })) })
    expect(mockAssign).not.toHaveBeenCalled()
    expect(screen.queryByText('Automatic top-up settings saved.')).not.toBeInTheDocument()
  })

  it.each(['save', 'setup'])('ignores late %s completions after a site change', async operation => {
    const view = await mount()
    const pending = deferred<Response>()
    mockFetch.mockReturnValueOnce(pending.promise)
    fireEvent.click(operation === 'save' ? save() : screen.getByRole('button', { name: 'Replace top-up card' }))
    mockFetch.mockResolvedValueOnce(response({ settings: { ...initial, targetCredits: 60 } }))
    view.rerender(<AutoTopUpCard siteId="site-b" />)
    await flush()
    expect(signal(1).aborted).toBe(true)
    await act(async () => { pending.resolve(response({ success: true, url: 'https://checkout.example.test/old' })) })
    expect(target()).toHaveValue(60)
    expect(target()).toBeEnabled()
    expect(mockAssign).not.toHaveBeenCalled()
    expect(screen.queryByText('Automatic top-up settings saved.')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})