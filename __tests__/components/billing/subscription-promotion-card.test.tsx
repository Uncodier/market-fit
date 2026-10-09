import React from 'react'
import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { toast } from 'sonner'
import { SubscriptionPromotionCard } from '@/app/components/billing/subscription-promotion-card'

// Exercise the real shared UI; isolate permission providers, animation, and notifications.
jest.mock('@/app/context/PermissionContext', () => ({ useOptionalPermissions: () => null }))
jest.mock('@/app/components/ui/use-btn-glass-motion', () => ({ useBtnGlassMotion: () => () => {} }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))

const originalFetch = global.fetch
const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300, status, json: async () => body,
}) as Response
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = () => act(async () => { await Promise.resolve() })
const input = () => screen.getByRole('textbox', { name: 'Promotion code' })
const button = () => screen.getByRole('button', { name: 'Apply code' })
const edit = (value: string) => fireEvent.change(input(), { target: { value } })
const submit = (value = 'SAVE20') => { edit(value); fireEvent.click(button()) }
const requestSignal = (index = 0) => mockFetch.mock.calls[index][1]?.signal as AbortSignal
const description = 'Applies to your subscription and eligible add-ons on the next invoice. Already-issued invoices are unchanged.'
const failure = 'Could not apply the promotion code. Please check the code and try again.'

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockReset().mockRejectedValue(new Error('Unexpected offline request'))
  global.fetch = mockFetch
})

afterEach(() => {
  cleanup()
  global.fetch = originalFetch
  jest.restoreAllMocks()
})

describe('SubscriptionPromotionCard', () => {
  it('renders accessible English copy without requests or billing side effects on mount', () => {
    const onApplied = jest.fn()
    const storage = jest.spyOn(Storage.prototype, 'setItem')
    const events = jest.spyOn(window, 'dispatchEvent')
    render(<SubscriptionPromotionCard siteId="site-a" onApplied={onApplied} />)

    expect(screen.getByRole('heading', { name: 'Apply a promotion code' })).toBeInTheDocument()
    expect(screen.getByText(description)).toBeInTheDocument()
    expect(input()).toHaveAccessibleDescription(description)
    expect(input()).toHaveAttribute('maxlength', '100')
    expect(input()).toHaveValue('')
    expect(button()).toHaveAttribute('type', 'button')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(storage).not.toHaveBeenCalled()
    expect(events).not.toHaveBeenCalled()
    expect(onApplied).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it.each([
    ['', 'Enter a promotion code.'],
    [' \t ', 'Enter a promotion code.'],
    ['A'.repeat(101), 'Use only letters and numbers, up to 100 characters.'],
    ['SAVE-20', 'Use only letters and numbers, up to 100 characters.'],
    ['SAVE_20', 'Use only letters and numbers, up to 100 characters.'],
    ['SAVE 20', 'Use only letters and numbers, up to 100 characters.'],
    ['SAVE\t20', 'Use only letters and numbers, up to 100 characters.'],
    ['SAVÉ20', 'Use only letters and numbers, up to 100 characters.'],
    ['<script>', 'Use only letters and numbers, up to 100 characters.'],
  ])('rejects invalid code %j locally', (code, message) => {
    const onApplied = jest.fn()
    render(<SubscriptionPromotionCard siteId="site-a" onApplied={onApplied} />)
    submit(code)

    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(input()).toHaveAttribute('aria-invalid', 'true')
    expect(input()).toHaveAccessibleDescription(`${description} ${message}`)
    expect(mockFetch).not.toHaveBeenCalled()
    expect(onApplied).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it.each([false, true])('confirms success with alreadyApplied=%s only after the authenticated POST', async alreadyApplied => {
    const pending = deferred<Response>()
    mockFetch.mockReturnValueOnce(pending.promise)
    const onApplied = jest.fn()
    const storage = jest.spyOn(Storage.prototype, 'setItem')
    const events = jest.spyOn(window, 'dispatchEvent')
    render(<SubscriptionPromotionCard siteId="site-a" onApplied={onApplied} />)
    submit('  Save20  ')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/stripe/subscription/promotion', {
      method: 'POST', credentials: 'same-origin', redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: 'site-a', code: 'Save20' }),
      signal: expect.any(AbortSignal),
    })
    expect(input()).toBeDisabled()
    expect(input()).toHaveValue('  Save20  ')
    expect(screen.getByRole('button', { name: 'Applying…' })).toBeDisabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
    expect(onApplied).not.toHaveBeenCalled()

    await act(async () => { pending.resolve(response({ success: true, alreadyApplied })) })
    const message = alreadyApplied
      ? 'This promotion code is already applied to your subscription.'
      : 'Promotion code applied to your subscription.'
    expect(screen.getByRole('status')).toHaveTextContent(message)
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith(message)
    expect(onApplied).toHaveBeenCalledTimes(1)
    expect(onApplied).toHaveBeenCalledWith()
    expect(input()).toHaveValue('')
    expect(input()).toBeEnabled()
    expect(button()).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(storage).not.toHaveBeenCalled()
    expect(events).not.toHaveBeenCalled()
  })

  it('accepts 100 alphanumeric characters without requiring a callback', async () => {
    mockFetch.mockResolvedValueOnce(response({ success: true, alreadyApplied: false }))
    render(<SubscriptionPromotionCard siteId="site-a" />)
    submit('a1'.repeat(50))
    await flush()
    expect(JSON.parse(mockFetch.mock.calls[0][1]?.body as string)).toEqual({ siteId: 'site-a', code: 'a1'.repeat(50) })
    expect(screen.getByRole('status')).toHaveTextContent('Promotion code applied')
  })

  it.each([
    ['disabled', 'site-a', true],
    ['missing site', '', false],
    ['blank site', '   ', false],
  ])('does not submit when %s', (_label, siteId, disabled) => {
    render(<SubscriptionPromotionCard siteId={siteId} disabled={disabled} />)
    expect(input()).toBeDisabled()
    expect(button()).toBeDisabled()
    fireEvent.click(button())
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('preserves a draft while disabled and permits submission after re-enabling', async () => {
    const view = render(<SubscriptionPromotionCard siteId="site-a" />)
    edit('SAVE20')
    view.rerender(<SubscriptionPromotionCard siteId="site-a" disabled />)
    expect(input()).toHaveValue('SAVE20')
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(mockFetch).not.toHaveBeenCalled()
    view.rerender(<SubscriptionPromotionCard siteId="site-a" disabled={false} />)
    mockFetch.mockResolvedValueOnce(response({ success: true, alreadyApplied: false }))
    fireEvent.click(button())
    await flush()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('blocks duplicate submissions and draft changes while saving', async () => {
    const pending = deferred<Response>()
    mockFetch.mockReturnValueOnce(pending.promise)
    render(<SubscriptionPromotionCard siteId="site-a" />)
    edit('SAVE20')
    const applyButton = button()
    act(() => {
      fireEvent.click(applyButton)
      fireEvent.click(applyButton)
      fireEvent.keyDown(input(), { key: 'Enter' })
    })
    edit('OTHER')
    expect(input()).toHaveValue('SAVE20')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    await act(async () => { pending.resolve(response({ success: true, alreadyApplied: false })) })
  })

  it.each([400, 401, 403, 409, 500])('preserves the draft without success effects for HTTP %s', async status => {
    mockFetch.mockResolvedValueOnce(response({ error: 'Internal provider details', success: true, alreadyApplied: false }, status))
    const onApplied = jest.fn()
    render(<SubscriptionPromotionCard siteId="site-a" onApplied={onApplied} />)
    submit('  SAVE20  ')
    await flush()
    expect(screen.getByRole('alert')).toHaveTextContent(failure)
    expect(screen.queryByText('Internal provider details')).not.toBeInTheDocument()
    expect(input()).toHaveValue('  SAVE20  ')
    expect(button()).toBeEnabled()
    expect(onApplied).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it.each([null, [], {}, { success: false }, { success: true },
    { success: 'true', alreadyApplied: false }, { success: true, alreadyApplied: 'false' },
  ])('fails closed for malformed success body %j', async body => {
    mockFetch.mockResolvedValueOnce(response(body))
    const onApplied = jest.fn()
    render(<SubscriptionPromotionCard siteId="site-a" onApplied={onApplied} />)
    submit()
    await flush()
    expect(screen.getByRole('alert')).toHaveTextContent(failure)
    expect(input()).toHaveValue('SAVE20')
    expect(onApplied).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it.each(['network', 'json'])('preserves the draft on a %s failure and supports explicit retry', async mode => {
    if (mode === 'network') mockFetch.mockRejectedValueOnce(new Error('Offline'))
    else mockFetch.mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON') } } as unknown as Response)
    render(<SubscriptionPromotionCard siteId="site-a" />)
    submit('  Save20  ')
    await flush()
    expect(screen.getByRole('alert')).toHaveTextContent(failure)
    expect(input()).toHaveValue('  Save20  ')
    expect(mockFetch).toHaveBeenCalledTimes(1)

    mockFetch.mockResolvedValueOnce(response({ success: true, alreadyApplied: true }))
    fireEvent.click(button())
    await flush()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input()).toHaveValue('')
    expect(screen.getByRole('status')).toHaveTextContent('already applied')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('clears previous feedback when editing and resets draft and feedback on site changes', async () => {
    const view = render(<SubscriptionPromotionCard siteId="site-a" />)
    submit('!')
    edit('SAVE20')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input()).toHaveAttribute('aria-invalid', 'false')
    mockFetch.mockResolvedValueOnce(response({ success: true, alreadyApplied: false }))
    fireEvent.click(button())
    await flush()
    expect(screen.getByRole('status')).toBeInTheDocument()
    edit('NEW20')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    view.rerender(<SubscriptionPromotionCard siteId="site-b" />)
    expect(input()).toHaveValue('')
    submit('!')
    view.rerender(<SubscriptionPromotionCard siteId="site-a" />)
    expect(input()).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it.each(['success', 'failure', 'json'])('ignores stale %s after changing sites, even if cancellation is ignored', async outcome => {
    const pending = deferred<Response>()
    const body = deferred<unknown>()
    if (outcome === 'json') mockFetch.mockResolvedValueOnce({ ok: true, json: () => body.promise } as Response)
    else mockFetch.mockReturnValueOnce(pending.promise)
    const onApplied = jest.fn()
    const view = render(<SubscriptionPromotionCard siteId="site-a" onApplied={onApplied} />)
    submit('OLD20')
    await flush()
    const oldSignal = requestSignal()
    view.rerender(<SubscriptionPromotionCard siteId="site-b" onApplied={onApplied} />)
    expect(oldSignal.aborted).toBe(true)
    expect(input()).toHaveValue('')
    expect(button()).toBeEnabled()
    const current = deferred<Response>()
    mockFetch.mockReturnValueOnce(current.promise)
    submit('NEW20')

    await act(async () => {
      if (outcome === 'failure') pending.reject(new Error('Stale failure'))
      else if (outcome === 'json') body.resolve({ success: true, alreadyApplied: false })
      else pending.resolve(response({ success: true, alreadyApplied: false }))
    })
    expect(input()).toHaveValue('NEW20')
    expect(screen.getByRole('button', { name: 'Applying…' })).toBeDisabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
    expect(onApplied).not.toHaveBeenCalled()
    expect(JSON.parse(mockFetch.mock.calls[1][1]?.body as string)).toEqual({ siteId: 'site-b', code: 'NEW20' })

    await act(async () => { current.resolve(response({ success: true, alreadyApplied: false })) })
    expect(onApplied).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(input()).toHaveValue('')
  })

  it('does not resurrect an old request when returning to the same site', async () => {
    const pending = deferred<Response>()
    mockFetch.mockReturnValueOnce(pending.promise)
    const onApplied = jest.fn()
    const view = render(<SubscriptionPromotionCard siteId="site-a" onApplied={onApplied} />)
    submit()
    view.rerender(<SubscriptionPromotionCard siteId="site-b" onApplied={onApplied} />)
    view.rerender(<SubscriptionPromotionCard siteId="site-a" onApplied={onApplied} />)
    edit('NEW20')
    await act(async () => { pending.resolve(response({ success: true, alreadyApplied: false })) })
    expect(input()).toHaveValue('NEW20')
    expect(onApplied).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it.each(['success', 'failure'])('aborts on unmount and ignores a late %s', async outcome => {
    const pending = deferred<Response>()
    mockFetch.mockReturnValueOnce(pending.promise)
    const onApplied = jest.fn()
    const view = render(<SubscriptionPromotionCard siteId="site-a" onApplied={onApplied} />)
    submit()
    const signal = requestSignal()
    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => {
      if (outcome === 'failure') pending.reject(new Error('Unmounted'))
      else pending.resolve(response({ success: true, alreadyApplied: false }))
    })
    expect(onApplied).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it.each(['throw', 'reject'])('does not report API failure if onApplied callbacks %s', async mode => {
    mockFetch.mockResolvedValueOnce(response({ success: true, alreadyApplied: false }))
    const onApplied = jest.fn(() => {
      if (mode === 'throw') throw new Error('Refresh failed')
      return Promise.reject(new Error('Refresh failed'))
    })
    render(<SubscriptionPromotionCard siteId="site-a" onApplied={onApplied} />)
    submit()
    await flush()
    expect(screen.getByRole('status')).toHaveTextContent('Promotion code applied')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input()).toHaveValue('')
    expect(onApplied).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('never submits an enclosing form by click or Enter, and ignores composing Enter', async () => {
    const onSubmit = jest.fn(event => event.preventDefault())
    const onKeyDown = jest.fn()
    mockFetch.mockResolvedValue(response({ success: true, alreadyApplied: false }))
    const view = render(
      <form onSubmit={onSubmit} onKeyDown={onKeyDown}>
        <SubscriptionPromotionCard siteId="site-a" />
        <button type="submit">Save billing</button>
      </form>,
    )
    expect(view.container.querySelectorAll('form')).toHaveLength(1)
    submit()
    await flush()
    expect(onSubmit).not.toHaveBeenCalled()
    edit('NEXT20')
    const enter = createEvent.keyDown(input(), { key: 'Enter', bubbles: true, cancelable: true })
    fireEvent(input(), enter)
    await flush()
    expect(enter.defaultPrevented).toBe(true)
    expect(onKeyDown).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    edit('DRAFT20')
    fireEvent.keyDown(input(), { key: 'Enter', isComposing: true })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})