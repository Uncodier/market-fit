jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
import { render, screen, fireEvent } from '@testing-library/react'
import { CredentialManager } from '@/app/home/profile/credential-manager'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import useSWR from 'swr'

jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: jest.fn() }))
const auth = jest.mocked(useAuthContext)
const swr = jest.mocked(useSWR)
beforeEach(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver
  auth.mockReturnValue({ user: { id: 'account-a' } } as never)
  swr.mockReturnValue({ data: { credentials: [], assessment: { status: 'pending', reason: 'No report exists.' } }, mutate: jest.fn(), isLoading: false } as never)
  const header = document.createElement('header')
  header.id = 'page-primary-actions'
  document.body.appendChild(header)
})
afterEach(() => document.getElementById('page-primary-actions')?.remove())
test('upload lives in the shared account header while the dialog submits from its footer', () => {
  render(<CredentialManager />)
  const upload = screen.getByRole('button', { name: 'Upload credential' })
  expect(document.getElementById('page-primary-actions')).toContainElement(upload)
  fireEvent.click(upload)
  expect(screen.getByRole('dialog')).toContainElement(screen.getByRole('button', { name: 'Save revision' }))
  expect(document.getElementById('page-primary-actions')).not.toContainElement(screen.getByRole('button', { name: 'Save revision' }))
})
test('private profile marks evidence unverified and pending, not accepted by invented AI', () => {
  render(<CredentialManager />)
  expect(screen.getByText(/Provisional assessment: pending/)).toHaveTextContent('No report exists.')
  expect(screen.getByText('No credentials uploaded yet.')).toBeInTheDocument()
  expect(swr).toHaveBeenCalledWith(['personal-credentials', 'account-a'], expect.any(Function))
})
test('account changes unmount an open personal credential editor', () => {
  const view = render(<CredentialManager />)
  fireEvent.click(screen.getByRole('button', { name: 'Upload credential' }))
  fireEvent.change(screen.getByLabelText('Your legal name'), { target: { value: 'Private Account A' } })
  auth.mockReturnValue({ user: { id: 'account-b' } } as never)
  view.rerender(<CredentialManager />)
  expect(screen.queryByDisplayValue('Private Account A')).not.toBeInTheDocument()
  expect(screen.queryByText('Upload personal credential')).not.toBeInTheDocument()
})

test('closing a credential dialog retains its draft on reopening', () => {
  render(<CredentialManager />)
  fireEvent.click(screen.getByRole('button', { name: 'Upload credential' }))
  fireEvent.change(screen.getByLabelText('Your legal name'), { target: { value: 'Draft holder' } })
  fireEvent.click(screen.getByRole('button', { name: 'Close and keep draft' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Upload credential' }))
  expect(screen.getByLabelText('Your legal name')).toHaveValue('Draft holder')
  expect(screen.getByRole('dialog').querySelector('input[type="date"]')).toBeNull()
})
test('renewals show ready private download links without overwriting old evidence', () => {
  swr.mockReturnValue({ data: { credentials: [{ id: 'credential', version: 1, archived_at: null, revisions: [{ id: 'revision', revision: 1,
    metadata: { title: 'License', issuer: 'Board', type: 'professional_license', holder_name: 'Holder', expires_on: null, non_expiring: false },
    original_name: 'license.pdf', byte_size: 10, state: 'ready' }] }], assessment: { reason: 'No report exists.' } }, mutate: jest.fn() } as never)
  render(<CredentialManager />)
  expect(screen.getByText(/Uploaded, not verified/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Download private evidence' })).toHaveAttribute('href', '/api/procurement/credentials/revisions/revision/file')
  expect(screen.getByRole('button', { name: 'Add revision' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Archive and retain history' })).toBeInTheDocument()
})