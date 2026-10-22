import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ConfirmPage from '@/app/auth/confirm/page'
import EmailChangePage from '@/app/auth/confirm-email-change/page'
import ResetPage from '@/app/auth/reset-password/page'
import SetPasswordPage from '@/app/auth/set-password/page'
import InvitationPage from '@/app/auth/team-invitation/page'
import { validatePassword } from '@/app/auth/set-password/password-requirements'
import { LocalizationProvider } from '@/app/context/LocalizationContext'
import { localeMessages } from '@/app/context/locale-catalog'

const params = new URLSearchParams()
const router = { push: jest.fn(), replace: jest.fn() }
const getSession = jest.fn()
const verifyOtp = jest.fn()
const updateUser = jest.fn()
const exchangeCodeForSession = jest.fn()
const setSession = jest.fn()
const processTeamInvitation = jest.fn()
const updateProfile = jest.fn()
const profileEq = jest.fn()
const toast = { error: jest.fn(), success: jest.fn(), info: jest.fn() }
const { en, es } = localeMessages
let locale: 'en' | 'es' = 'es'
const originalLocation = window.location
const originalLanguage = document.documentElement.lang

jest.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => params }))
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession, verifyOtp, updateUser, exchangeCodeForSession, setSession },
    from: () => ({ update: updateProfile }),
  }),
}))
jest.mock('@/app/services/magic-link-invitation-service', () => ({
  processTeamInvitation: (...args: unknown[]) => processTeamInvitation(...args),
}))
jest.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toast.error(...args),
    success: (...args: unknown[]) => toast.success(...args),
    info: (...args: unknown[]) => toast.info(...args),
  },
}))
jest.mock('@/app/components/billing/billing-limit-dialog', () => ({ BillingLimitDialog: () => null }))

function renderLocalized(ui: React.ReactNode) {
  const wrap = (content: React.ReactNode) => (
    <LocalizationProvider preferredLocale={locale}>{content}</LocalizationProvider>
  )
  const view = render(wrap(ui))
  return { ...view, rerender: (content: React.ReactNode) => view.rerender(wrap(content)) }
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  for (const mock of [getSession, verifyOtp, updateUser, exchangeCodeForSession, setSession, processTeamInvitation, updateProfile, profileEq]) {
    mock.mockReset()
  }
  locale = 'es'
  Array.from(params.keys()).forEach(key => params.delete(key))
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { href: 'http://localhost/auth', hash: '', hostname: 'localhost' },
  })
  jest.spyOn(window.history, 'replaceState').mockImplementation(() => undefined)
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
  getSession.mockResolvedValue({ data: { session: { user: { email: 'test@example.invalid' } } }, error: null })
  updateUser.mockResolvedValue({ error: null })
  verifyOtp.mockResolvedValue({
    data: {
      session: { user: { email: 'test@example.invalid' } },
      user: { id: 'test-user', email: 'test@example.invalid', user_metadata: { password_set: true } },
    },
    error: null,
  })
  updateProfile.mockReturnValue({ eq: profileEq })
  profileEq.mockResolvedValue({ error: null })
})

afterEach(() => {
  cleanup()
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
  document.documentElement.lang = originalLanguage
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
})

test('confirmation stays click-gated and recovery returnTo stays intact when locale changes', async () => {
  params.set('token_hash', 'test-recovery-token')
  params.set('type', 'recovery')
  params.set('returnTo', '/buyer/orders?status=open')
  const view = renderLocalized(<ConfirmPage />)
  expect(verifyOtp).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: es['auth.flows.reset.title'] }))
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/auth/set-password?returnTo=%2Fbuyer%2Forders%3Fstatus%3Dopen'))
  expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'test-recovery-token', type: 'recovery' })
  locale = 'en'
  view.rerender(<ConfirmPage />)
  expect(screen.getByText(en['auth.flows.confirm.recoveryRedirect'])).toBeInTheDocument()
  expect(verifyOtp).toHaveBeenCalledTimes(1)
})

test('confirmation error translates at render without exposing provider text', async () => {
  params.set('token_hash', 'test-token')
  verifyOtp.mockResolvedValue({ data: {}, error: { message: 'private provider text' } })
  const view = renderLocalized(<ConfirmPage />)
  fireEvent.click(screen.getByRole('button', { name: es['auth.flows.confirm.signIn'] }))
  await screen.findByText(es['auth.flows.confirm.failedEmail'])
  locale = 'en'
  view.rerender(<ConfirmPage />)
  expect(screen.getByText(en['auth.flows.confirm.failedEmail'])).toBeInTheDocument()
  expect(screen.queryByText('private provider text')).not.toBeInTheDocument()
  expect(verifyOtp).toHaveBeenCalledTimes(1)
})

test('checkout OTP block never verifies', () => {
  params.set('token_hash', 'test-token')
  params.set('auth_channel', 'otp')
  renderLocalized(<ConfirmPage />)
  expect(screen.getByText(es['auth.flows.confirm.checkoutCodeTitle'])).toBeInTheDocument()
  expect(verifyOtp).not.toHaveBeenCalled()
})

test('email change profile update and verification do not replay on locale switch', async () => {
  params.set('token_hash', 'test-email-token')
  params.set('type', 'email_change')
  const view = renderLocalized(<EmailChangePage />)
  await screen.findByText(es['auth.flows.emailChange.successTitle'])
  expect(profileEq).toHaveBeenCalledWith('id', 'test-user')
  expect(updateProfile).toHaveBeenCalledWith({ email: 'test@example.invalid' })
  expect(toast.success).toHaveBeenCalledWith(es['auth.flows.emailChange.success'])
  locale = 'en'
  view.rerender(<EmailChangePage />)
  expect(screen.getByText(en['auth.flows.emailChange.successTitle'])).toBeInTheDocument()
  expect(verifyOtp).toHaveBeenCalledTimes(1)
  expect(updateProfile).toHaveBeenCalledTimes(1)
  act(() => jest.advanceTimersByTime(2000))
  expect(router.push).toHaveBeenCalledWith('/profile')
})

test('reset OTP keeps tokens, returnTo, history cleanup and delayed redirect intact', async () => {
  params.set('token_hash', 'test-reset-token')
  params.set('type', 'recovery')
  params.set('returnTo', '/buyer/orders?status=open')
  getSession.mockResolvedValue({ data: { session: null }, error: null })
  const view = renderLocalized(<ResetPage />)
  await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'test-reset-token', type: 'recovery' }))
  locale = 'en'
  view.rerender(<ResetPage />)
  expect(verifyOtp).toHaveBeenCalledTimes(1)
  act(() => jest.advanceTimersByTime(200))
  expect(window.location.href).toBe('/auth/set-password?redirect_to=%2Fbuyer%2Forders%3Fstatus%3Dopen')
  expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/auth/reset-password?returnTo=%2Fbuyer%2Forders%3Fstatus%3Dopen')
})

test('reset invalid-link error follows locale without replay and localizes redirect message', async () => {
  getSession.mockResolvedValue({ data: { session: null }, error: null })
  const view = renderLocalized(<ResetPage />)
  await screen.findByText(es['auth.flows.reset.invalidLink'])
  locale = 'en'
  view.rerender(<ResetPage />)
  expect(screen.getByText(en['auth.flows.reset.invalidLink'])).toBeInTheDocument()
  expect(getSession).toHaveBeenCalledTimes(1)
  act(() => jest.advanceTimersByTime(3000))
  expect(router.push).toHaveBeenCalledWith('/auth?error=' + encodeURIComponent(en['auth.flows.reset.invalidLink']))
})

test('password validation is unchanged and password aria/placeholders translate', async () => {
  expect(validatePassword('short')).toBe('auth.flows.password.tooShort')
  expect(validatePassword('ABCDEFG1')).toBe('auth.flows.password.needsLowercase')
  expect(validatePassword('abcdefg1')).toBe('auth.flows.password.needsUppercase')
  expect(validatePassword('Abcdefgh')).toBe('auth.flows.password.needsNumber')
  expect(validatePassword('Abcdefg1')).toBeNull()
  const view = renderLocalized(<SetPasswordPage />)
  await screen.findByPlaceholderText(es['auth.passwordPlaceholder'])
  fireEvent.click(screen.getByRole('button', { name: es['auth.flows.password.show'] }))
  expect(screen.getByRole('button', { name: es['auth.flows.password.hide'] })).toBeInTheDocument()
  locale = 'en'
  view.rerender(<SetPasswordPage />)
  expect(screen.getByRole('button', { name: en['auth.flows.password.hide'] })).toBeInTheDocument()
  expect(getSession).toHaveBeenCalledTimes(1)
})

test('password API error is localized while update metadata remains intact', async () => {
  updateUser.mockResolvedValue({ error: { code: 'same_password', message: 'New password should be different from the old password.' } })
  const view = renderLocalized(<SetPasswordPage />)
  await screen.findByPlaceholderText(es['auth.flows.password.confirmPlaceholder'])
  fireEvent.change(screen.getByPlaceholderText(es['auth.passwordPlaceholder']), { target: { value: 'Abcdefg1' } })
  fireEvent.change(screen.getByPlaceholderText(es['auth.flows.password.confirmPlaceholder']), { target: { value: 'Abcdefg1' } })
  fireEvent.click(screen.getByRole('button', { name: es['auth.flows.password.submit'] }))
  await screen.findByText(es['auth.flows.password.samePassword'])
  expect(updateUser).toHaveBeenCalledWith({ password: 'Abcdefg1', data: { password_set: true } })
  locale = 'en'
  view.rerender(<SetPasswordPage />)
  expect(screen.getByText(en['auth.flows.password.samePassword'])).toBeInTheDocument()
  expect(updateUser).toHaveBeenCalledTimes(1)
})

test('invitation errors translate without changing role payload or repeating acceptance', async () => {
  params.set('siteId', 'test-site')
  params.set('siteName', 'Test site')
  params.set('role', 'create')
  processTeamInvitation.mockResolvedValue({ success: false, error: 'This invitation was not issued to your account' })
  const view = renderLocalized(<InvitationPage />)
  await screen.findByText(es['auth.flows.invitation.wrongAccount'])
  expect(processTeamInvitation).toHaveBeenCalledWith(expect.objectContaining({
    siteId: 'test-site', siteName: 'Test site', role: 'create', userEmail: '',
  }))
  expect(toast.error).toHaveBeenCalledWith(es['auth.flows.invitation.wrongAccount'])
  locale = 'en'
  view.rerender(<InvitationPage />)
  expect(screen.getByText(en['auth.flows.invitation.wrongAccount'])).toBeInTheDocument()
  expect(processTeamInvitation).toHaveBeenCalledTimes(1)
})