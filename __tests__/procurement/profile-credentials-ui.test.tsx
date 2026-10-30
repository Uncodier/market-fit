import { fireEvent, render, screen, within } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { CredentialManager } from '@/app/home/profile/credential-manager'
import { PortalDemoProvider } from '@/app/home/demo-context'
import { AccountSearchSlot, AccountSearchActionsSlot } from '@/app/buyer/components/AccountSearch'

let user: { id: string } | null = null
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user }) }))
jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string) => key, locale: 'en' }),
}))

function mount(demo = true) {
  return render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
    <PortalDemoProvider demo={demo}><header data-testid="main-bar"><AccountSearchSlot /><AccountSearchActionsSlot /></header><main><CredentialManager /></main></PortalDemoProvider>
  </SWRConfig>)
}

beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })
beforeEach(() => { jest.clearAllMocks(); user = null })

test('places upload beside the section title and preserves read-only demo evidence', () => {
  mount()
  const title = screen.getByRole('heading', { name: 'Private credentials' })
  expect(within(title.parentElement!).getByRole('button', { name: 'Upload credential' })).toBeDisabled()
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(screen.getAllByRole('row')).toHaveLength(3)
  expect(screen.getAllByText('Professional license')).toHaveLength(2)
  expect(screen.getByRole('button', { name: 'Archive and retain history' })).toBeDisabled()
  expect(screen.getByText(/Fictional evidence preview/)).toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})

test('keeps preview actions in the credential heading and opens the read-only form', () => {
  mount()
  const heading = screen.getByRole('heading', { name: 'Workplace technology professional certificate' })
  const preview = within(heading.closest('header')!).getByRole('button', { name: 'Preview credential' })
  fireEvent.click(preview)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByText(/Read-only demo credential/)).toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})

test('live accounts can open upload without demo fixtures', async () => {
  user = { id: 'account' }
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ credentials: [], assessment: { status: 'pending', reason: '' } }) } as Response)
  mount(false)
  expect(await screen.findByText('No credentials uploaded yet.')).toBeInTheDocument()
  const upload = screen.getByRole('button', { name: 'Upload credential' })
  expect(upload).toBeEnabled()
  fireEvent.click(upload)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.queryByText('Workplace technology professional certificate')).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/api/procurement/credentials', { cache: 'no-store' })
})

test.each(['technology', 'EXAMPLE TECHNOLOGY INSTITUTE', 'Alex Morgan', 'DEMO-CERT-1', 'technical support', 'Professional license', 'example-professional-certificate-v1.pdf'])(
  'searches credential metadata and revision history from the main bar: %s', query => {
    mount()
    const input = within(screen.getByTestId('main-bar')).getByRole('textbox', { name: 'Search Credentials' })
    expect(within(screen.getByRole('main')).queryByRole('textbox')).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: query } })
    expect(screen.getByRole('heading', { name: 'Workplace technology professional certificate' })).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'unmatched credential' } })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText('No matching choices')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  },
)

test('mobile credential search shares the main-bar query', () => {
  const { container } = mount()
  fireEvent.click(screen.getByRole('button', { name: 'Search Credentials' }))
  fireEvent.change(container.querySelector<HTMLInputElement>('#mobile-search-input')!, { target: { value: 'unmatched' } })
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.getByRole('textbox')).toHaveValue('unmatched')
})