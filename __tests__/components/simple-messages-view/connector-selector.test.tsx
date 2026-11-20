import { fireEvent, render, screen } from '@testing-library/react'
import { ConnectorSelector } from '@/app/components/simple-messages-view/components/ConnectorSelector'
import { connectorRequest } from '@/app/connectors/connector-request'

jest.mock('@/app/connectors/connector-request', () => ({
  ...jest.requireActual('@/app/connectors/connector-request'), connectorRequest: jest.fn(),
}))

const request = jest.mocked(connectorRequest)
const first = 'ab1a0a11-0000-4000-8000-000000000001'
const second = 'ab1a0a11-0000-4000-8000-000000000002'
const base = { toolkit_slug: 'github', verified_at: null, revision: 1, enabled: true, can_use: true,
  provider_status: 'ACTIVE', revocation_pending: false }
beforeEach(() => request.mockReset())

it('loads connected accounts on demand, filters by usability and chooses the exact account', async () => {
  request.mockResolvedValue({ items: [
    { ...base, id: first, display_name: 'Engineering' },
    { ...base, id: second, display_name: 'Personal' },
    { ...base, id: first.replace(/1$/, '3'), display_name: 'View only', can_use: false },
    { ...base, id: first.replace(/1$/, '4'), display_name: 'Disabled', enabled: false },
    { ...base, id: first.replace(/1$/, '5'), display_name: 'Revoking', revocation_pending: true },
    { ...base, id: first.replace(/1$/, '6'), display_name: 'Expired', provider_status: 'EXPIRED' },
  ] })
  const onChange = jest.fn()
  render(<ConnectorSelector siteId="site" canSelect onChange={onChange} />)
  expect(request).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Select connector' }))
  expect(await screen.findAllByRole('radio')).toHaveLength(2)
  expect(screen.getByRole('radio', { name: /Personal/ }).closest('label')?.querySelector('img'))
    .toHaveAttribute('src', 'https://logos.composio.dev/api/github')
  expect(request).toHaveBeenCalledWith('/api/connectors/connections?site_id=site', expect.anything(), expect.anything())
  fireEvent.change(screen.getByRole('textbox', { name: 'Filter connectors' }), { target: { value: 'personal' } })
  fireEvent.click(screen.getByRole('radio', { name: /Personal/ }))
  expect(onChange).toHaveBeenCalledWith(second)
})

it('offers Add New when accounts cannot be listed and lets the user clear an invalid link explicitly', () => {
  const onChange = jest.fn()
  render(<ConnectorSelector siteId="site" canSelect={false} selectedId={null} onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Select connector' }))
  expect(screen.getByRole('link', { name: 'Add New Connector' })).toHaveAttribute('href', '/connectors')
  expect(screen.getByText('Connectors are unavailable in this conversation.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear connector selection' }))
  expect(onChange).toHaveBeenCalledWith()
  expect(request).not.toHaveBeenCalled()
})