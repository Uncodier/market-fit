import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ProcurementOrdersPanel } from '@/app/purchases/procurement/commerce/ProcurementOrdersPanel'
import { DocumentDialog } from '@/app/purchases/procurement/commerce/document-ui'
import { AuthContext, type AuthContextValue } from '@/app/components/auth/auth-context'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/purchases/procurement/commerce/document-ui', () => {
  const actual = jest.requireActual('@/app/purchases/procurement/commerce/document-ui')
  return { ...actual, DocumentDialog: jest.fn(actual.DocumentDialog) }
})

const fetchMock = jest.mocked(fetch)
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response
const orders = ['first', 'second'].map(id => ({ id, supplier_name: `${id} supplier`, currency: 'USD', net_amount_minor: 100,
  created_at: '2026-10-01', lines: [{ id, name: id, quantity: 2, received_quantity: 0 }] }))
const open = (id: string) => fireEvent.click(screen.getByRole('button', { name: id }))
function asActor(actor: string, children: ReactNode) {
  return <AuthContext.Provider value={{ user: { id: actor } } as AuthContextValue}>{children}</AuthContext.Provider>
}
beforeEach(() => { fetchMock.mockReset(); jest.mocked(DocumentDialog).mockClear() })

test('does not construct hidden dialogs and keeps only the selected order’s own draft on reopen', async () => {
  fetchMock.mockResolvedValue(response({ data: orders }))
  const view = render(<ProcurementOrdersPanel siteId="buyer-a" />)
  await screen.findByText('second supplier')
  expect(DocumentDialog).not.toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledTimes(1)
  open('first')
  expect(jest.mocked(DocumentDialog).mock.calls.every(([props]) => props.open)).toBe(true)
  fireEvent.change(screen.getByLabelText('Acceptance note'), { target: { value: 'First draft only' } })
  fireEvent.click(screen.getByRole('button', { name: 'Close and keep draft' }))
  open('second')
  expect(screen.getByLabelText('Acceptance note')).toHaveValue('')
  fireEvent.click(screen.getByRole('button', { name: 'Close and keep draft' }))
  open('first')
  expect(screen.getByLabelText('Acceptance note')).toHaveValue('First draft only')
  expect(fetch).toHaveBeenCalledTimes(1)
  view.rerender(<ProcurementOrdersPanel siteId="buyer-b" />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await screen.findByText('first supplier')
  open('first')
  expect(screen.getByLabelText('Acceptance note')).toHaveValue('')
})

test('changing accounts at the same URL closes the draft, and late order results cannot restore access', async () => {
  let finish!: (value: Response) => void
  fetchMock.mockResolvedValueOnce(response({ data: orders })).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    .mockResolvedValue(response({ error: 'Forbidden' }, false))
  const panel = <ProcurementOrdersPanel siteId="buyer-a" />
  const view = render(asActor('first', panel))
  await screen.findByText('second supplier')
  open('first')
  fireEvent.change(screen.getByLabelText('Acceptance note'), { target: { value: 'Private note' } })
  view.rerender(asActor('second', panel))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByText('first supplier')).not.toBeInTheDocument()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  const signal = fetchMock.mock.calls[1][1]!.signal!
  view.rerender(asActor('third', panel))
  expect(signal.aborted).toBe(true)
  expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden')
  await act(async () => finish(response({ data: orders })))
  expect(screen.queryByText('first supplier')).not.toBeInTheDocument()
  expect(screen.queryByDisplayValue('Private note')).not.toBeInTheDocument()
  expect(fetchMock.mock.calls.every(([, init]) => !init?.method)).toBe(true)
})