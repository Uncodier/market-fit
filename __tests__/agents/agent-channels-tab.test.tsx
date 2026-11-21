import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { AgentChannelsTab } from "@/app/components/agents/agent-channels-tab"
import { LocalizationProvider } from "@/app/context/LocalizationContext"

jest.mock("@/app/components/agents/agent-channel-setup", () => ({ AgentChannelSetup: () => <button>Set up a connection</button> }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => null }))
jest.mock("sonner", () => ({ toast: { success: jest.fn() } }))

const agentId = 'aaaaaaaa-0000-4000-8000-000000000001', other = 'aaaaaaaa-0000-4000-8000-000000000002'
const siteId = 'bbbbbbbb-0000-4000-8000-000000000001'
const endpoint = `/api/agent-channels/${siteId}/assignments`
const connections = [
  { id: 'website', type: 'website', label: '', account: '', status: 'active' },
  { id: 'account-a', type: 'whatsapp', label: 'North', account: '+1 (555) 555-0100', status: 'active' },
  { id: 'account-b', type: 'whatsapp', label: 'South', account: '+1 (555) 555-0101', status: 'inactive' },
  { id: 'voice', type: 'voice', label: 'Voice line', account: '+1 (555) 555-0102', status: 'active' },
  { id: 'sms', type: 'sms', label: 'SMS line', account: '+1 (555) 555-0103', status: 'active' },
]
const directory = { connections, connectionIds: connections.map(c => c.id), canManage: true,
  defaultAgentId: other, voiceDefaultAgentId: other, voiceAgentIdsByConnection: { voice: agentId },
  agents: [{ id: agentId, name: 'Balmer', role: 'Sales', status: 'active' }, { id: other, name: 'Support', role: 'Customer Support', status: 'active' }],
  assignments: [{ connectionId: 'account-a', agentId, revision: 3 }, { connectionId: 'account-b', agentId: other, revision: 7 }],
}
const response = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body }) as Response
const fetcher = jest.mocked(fetch)
function show(id = agentId) {
  return render(<LocalizationProvider preferredLocale="en"><AgentChannelsTab siteId={siteId} agentId={id} /></LocalizationProvider>)
}
beforeEach(() => { fetcher.mockReset().mockResolvedValue(response(directory)) })

it('replaces only the pending panel and keeps the loaded channels visible during a background refresh', async () => {
  let first!: (r: Response) => void, refresh!: (r: Response) => void
  fetcher.mockReturnValueOnce(new Promise(resolve => { first = resolve }))
    .mockReturnValueOnce(new Promise(resolve => { refresh = resolve }))
  show()
  const busy = screen.getByRole('status')
  expect(busy).toHaveAttribute('aria-busy', 'true')
  expect(busy.querySelector('.animate-pulse')).not.toBeNull()
  expect(busy.querySelector('button, a, input, select')).toBeNull()
  await act(async () => first(response(directory)))
  expect(screen.queryByRole('status')).toBeNull()
  fireEvent.focus(window)
  expect(screen.getByRole('group', { name: /North/ })).toBeVisible()
  await act(async () => refresh(response({ error: 'Unavailable' }, 503)))
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load channel agents.')
  expect(screen.queryByRole('status')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('group', { name: /North/ })).toBeVisible()
})

it('shows selected and current connections separately; other accounts, SMS and website are not attributed by role', async () => {
  show()
  const north = await screen.findByRole('group', { name: 'North · +1 (555) 555-0100' })
  expect(north).toHaveTextContent('Saved assignment: Balmer')
  expect(north).toHaveTextContent('Responding agent: Support')
  expect(screen.getByRole('group', { name: /Voice line/ })).toHaveTextContent('Last synced voice agent: Balmer')
  expect(screen.queryByText('South')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Other site connections \(3\)/ }))
  expect(screen.getByRole('group', { name: /South/ })).toHaveTextContent('Saved assignment: Support')
  expect(screen.getByRole('group', { name: /SMS line/ })).toHaveTextContent('No automatic replies')
  expect(screen.getByRole('group', { name: 'Website Channel' })).toHaveTextContent('Responding agent: Support')
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('assigns the selected connection to the open profile with confirmation and the existing Settings revision contract', async () => {
  show()
  fireEvent.click(await screen.findByRole('button', { name: /Other site connections/ }))
  fireEvent.click(within(screen.getByRole('group', { name: /South/ })).getByRole('button', { name: 'Assign to this agent' }))
  const dialog = within(screen.getByRole('dialog', { name: /South/ }))
  expect(dialog.getByRole('combobox')).toHaveValue(agentId)
  expect(fetcher).toHaveBeenCalledTimes(1)
  fetcher.mockResolvedValueOnce(response({ assignment: { connectionId: 'account-b', agentId, revision: 8 } }))
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(fetcher).toHaveBeenLastCalledWith(endpoint, expect.objectContaining({ method: 'PATCH',
    body: JSON.stringify({ connectionId: 'account-b', agentId, expectedRevision: 7 }) }))
  const saved = within(screen.getByRole('group', { name: /South/ }))
  expect(saved.getByText('Balmer')).toBeVisible()
  expect(saved.getByText('Change agent')).toBeVisible()
  expect(screen.getByRole('button', { name: /Other site connections \(2\)/ })).toBeVisible()
})

it('keeps configuration read-only with no storage and never exposes another site’s agent editor for an unknown profile', async () => {
  fetcher.mockResolvedValue(response({ ...directory, assignments: [], canManage: false, assignmentsAvailable: false }))
  const first = show(other)
  expect(await screen.findByText('Website Channel')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Set up a connection' })).toBeNull()
  expect(screen.getAllByRole('button', { name: 'Assign to this agent' }).every(b => b.hasAttribute('disabled'))).toBe(true)
  first.unmount()
  show('unknown-agent')
  expect(await screen.findByText('Agent unavailable')).toBeVisible()
  expect(screen.queryByRole('group')).toBeNull()
})