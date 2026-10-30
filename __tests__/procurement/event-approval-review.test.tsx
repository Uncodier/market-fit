import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { EventApprovalReview } from '@/app/purchases/procurement/approvals/event-approval-review'
import type { InboxRow } from '@/app/purchases/procurement/approvals/inbox-schema'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))

const row: InboxRow = { id: 'event:approval-1', target_id: '22222222-2222-4222-8222-222222222222', stage: 'publication', title: 'Tender publication · 51878e16', status: 'pending', revision: 1, date: '2026-10-28' }
const siteId = '11111111-1111-4111-8111-111111111111'
const stage = { id: 'stage-1', status: 'pending', position: 0, definition: { name: 'Workspace owner approval', decisionMode: 'human' } }
const approval = { id: 'approval-1', status: 'pending', event: 'publication', target_version: 1, procurement_event_stages: [stage] }
const response = (data: unknown, ok = true) => ({ ok, json: async () => data }) as Response
const onClose = jest.fn(), onDecision = jest.fn()

beforeEach(() => {
  jest.mocked(fetch).mockReset().mockResolvedValue(response({ approvals: [approval] }))
  onClose.mockReset(); onDecision.mockReset()
})

function review() { return render(<EventApprovalReview siteId={siteId} row={row} onClose={onClose} onDecision={onDecision} />) }
test('a saved vote in a two-person quorum explains pending status and prevents duplicate decisions', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response({ approvals: [{ ...approval, procurement_event_stages: [{
    ...stage, own_decision: 'approve', approval_votes: 1,
    definition: { ...stage.definition, approverIds: ['owner', 'admin'], quorum: { mode: 'all' } },
  }] }] }))
  review()
  expect(await screen.findByText('Your recorded decision: Approve.')).toBeInTheDocument()
  expect(screen.getByText('1 of 2 required approvals recorded. Mandatory approvers must also approve.')).toBeInTheDocument()
  expect(screen.getByText(/Your decision is saved/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('an existing vote does not prevent deciding another pending stage', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response({ approvals: [{ ...approval, procurement_event_stages: [
    { ...stage, own_decision: 'approve', approval_votes: 1 },
    { ...stage, id: 'stage-2', position: 1, definition: { ...stage.definition, name: 'Finance approval' } },
  ] }] }))
  review()
  expect(await screen.findByRole('textbox', { name: 'Decision reason for Finance approval' })).toBeInTheDocument()
})

test('each person has a row showing approval, rejection or an awaited vote', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response({ approvals: [{ ...approval, procurement_event_stages: [{
    ...stage, voters: [
      { user_id: 'alex', name: 'Alex', is_owner: true, is_self: true, mandatory: true, decision: 'approve' },
      { user_id: 'sam', name: 'Sam', is_owner: false, is_self: false, mandatory: true, decision: null },
      { user_id: 'pat', name: 'Pat', is_owner: false, is_self: false, mandatory: false, decision: 'reject' },
    ],
  }] }] }))
  review()
  const list = await screen.findByRole('list', { name: 'Approvers and decisions' })
  const rows = within(list).getAllByRole('listitem')
  expect(rows).toHaveLength(3)
  expect(rows[0]).toHaveTextContent('Alex(You)RequiredApproved')
  expect(rows[1]).toHaveTextContent('SamRequiredAwaiting vote')
  expect(rows[2]).toHaveTextContent('PatRejected')
})

async function fillReason() {
  const reason = await screen.findByRole('textbox', { name: 'Decision reason for Workspace owner approval' })
  fireEvent.change(reason, { target: { value: 'Reviewed current document and policy.' } })
}

test('uses a single flat dialog with reason in the body and primary action in the footer', async () => {
  review()
  const reason = await screen.findByRole('textbox')
  const dialog = screen.getByRole('dialog')
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(within(dialog).getByText(row.title)).toBeInTheDocument()
  expect(within(dialog).queryByRole('heading', { name: 'Approvals' })).not.toBeInTheDocument()
  expect(dialog.querySelector('dl[aria-label="Approval stage"]')).toHaveTextContent('Workspace owner approval')
  expect(within(dialog).getByRole('heading', { name: row.title })).toHaveClass('text-base')
  expect(dialog.querySelector('[data-slot="dialog-body"]')).toHaveClass('text-sm')
  expect(document.getElementById(reason.getAttribute('aria-describedby')!)).toHaveClass('text-sm')
  expect(within(dialog).getByText('Revision')).toBeInTheDocument()
  expect(within(dialog).getByText(new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(row.date)))).toBeInTheDocument()
  expect(reason).toHaveAccessibleDescription('Workspace owner approval · Document revision 1. Your decision and reason are recorded.')
  expect(reason.closest('[data-slot="dialog-body"]')).not.toBeNull()
  const approve = within(dialog).getByRole('button', { name: 'Approve' })
  expect(approve.closest('[data-slot="dialog-footer"]')).not.toBeNull()
  expect(approve).toBeDisabled()
  fireEvent.change(reason, { target: { value: '   ' } })
  expect(approve).toBeDisabled()
  expect(within(dialog).getByText('3 / 2,000')).toBeInTheDocument()
})

test.each(['Approve', 'Reject'])('%s submits the selected revision stage without another modal', async action => {
  jest.mocked(fetch).mockResolvedValueOnce(response({ approvals: [approval] })).mockResolvedValueOnce(response({ id: approval.id }))
  review(); await fillReason()
  fireEvent.click(screen.getByRole('button', { name: action }))
  await waitFor(() => expect(onDecision).toHaveBeenCalledTimes(1))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenLastCalledWith(`/api/procurement/approvals/approval-1/decisions?site_id=${siteId}`, expect.objectContaining({
    method: 'POST', body: JSON.stringify({ stage_id: stage.id, decision: action.toLowerCase(), reason: 'Reviewed current document and policy.' }),
  }))
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
})

test('preserves the reason and modal when the server rejects a decision', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response({ approvals: [approval] })).mockResolvedValueOnce(response({}, false))
  review(); await fillReason()
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Decision not confirmed')
  expect(screen.getByRole('textbox')).toHaveValue('Reviewed current document and policy.')
  expect(onClose).not.toHaveBeenCalled(); expect(onDecision).not.toHaveBeenCalled()
})

test('blocks duplicate submissions and dismissal while a decision is being saved', async () => {
  let resolve!: (value: Response) => void
  const save = new Promise<Response>(done => { resolve = done })
  jest.mocked(fetch).mockResolvedValueOnce(response({ approvals: [approval] })).mockReturnValueOnce(save)
  review(); await fillReason()
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled()
  expect(screen.getByRole('textbox')).toBeDisabled()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledTimes(2)
  await act(async () => { resolve(response({ id: approval.id })) })
  expect(onClose).toHaveBeenCalledTimes(1)
})

test.each(['approved', 'ai'])('keeps %s approvals read-only', async mode => {
  const current = mode === 'approved' ? { ...approval, status: 'approved' } : { ...approval, procurement_event_stages: [{ ...stage, definition: { ...stage.definition, decisionMode: 'ai' } }] }
  jest.mocked(fetch).mockResolvedValue(response({ approvals: [current] }))
  review()
  await screen.findByText('Workspace owner approval')
  expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

test('missing selected approval shows a retryable error, not another approval for the document', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response({ approvals: [{ ...approval, id: 'other-approval' }] })).mockResolvedValueOnce(response({ approvals: [approval] }))
  review()
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load approval stages')
  expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByRole('textbox')
})

test('multiple human stages use one picker and submit only the chosen stage', async () => {
  Element.prototype.scrollIntoView = jest.fn()
  const second = { ...stage, id: 'stage-2', position: 1, definition: { ...stage.definition, name: 'Finance approval' } }
  jest.mocked(fetch).mockResolvedValueOnce(response({ approvals: [{ ...approval, procurement_event_stages: [second, stage] }] }))
    .mockResolvedValueOnce(response({ id: approval.id }))
  review(); await fillReason()
  fireEvent.click(screen.getByRole('combobox', { name: 'Approval stage' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Finance approval' }))
  const reason = screen.getByRole('textbox', { name: 'Decision reason for Finance approval' })
  expect(reason).toHaveValue('')
  fireEvent.change(reason, { target: { value: 'Finance reviewed.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  await waitFor(() => expect(onDecision).toHaveBeenCalledTimes(1))
  expect(fetch).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
    body: JSON.stringify({ stage_id: 'stage-2', decision: 'approve', reason: 'Finance reviewed.' }),
  }))
})
test('stale publication errors remain visible beside actions with a recovery link', async () => {
  const stale = 'Tender changed. Request publication approval for the current working version from the tender details.'
  jest.mocked(fetch).mockResolvedValueOnce(response({ approvals: [approval] })).mockResolvedValueOnce(response({ error: stale }, false))
  review(); await fillReason()
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(stale)
  expect(alert.closest('[data-slot="dialog-footer"]')).not.toBeNull()
  expect(within(alert).getByRole('link')).toHaveAttribute('href', `/purchases/tenders/${row.target_id}`)
  expect(screen.getByRole('button', { name: 'Reject' })).toBeEnabled()
  expect(onClose).not.toHaveBeenCalled()
})
test('incomplete success does not close review or claim a decision was recorded', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response({ approvals: [approval] })).mockResolvedValueOnce(response({}))
  review(); await fillReason()
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Decision result could not be confirmed')
  expect(onClose).not.toHaveBeenCalled(); expect(onDecision).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled()
})
test('a terminal conflict blocks repeated clicks and form submissions until reload', async () => {
  const explanation = 'This approval or stage is no longer pending. Reload the approvals list to see its current status before taking another action.'
  jest.mocked(fetch).mockResolvedValueOnce(response({ approvals: [approval] }))
    .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: explanation }) } as Response)
  review(); await fillReason()
  const approve = screen.getByRole('button', { name: 'Approve' })
  fireEvent.click(approve)
  expect(await screen.findByRole('alert')).toHaveTextContent(explanation)
  expect(approve).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled()
  fireEvent.submit(approve.closest('form')!)
  fireEvent.click(approve)
  await act(async () => {})
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(onClose).not.toHaveBeenCalled(); expect(onDecision).not.toHaveBeenCalled()
})
test('a changed policy shows its explanation and next step rather than a generic conflict', async () => {
  const explanation = 'The workspace policy changed after this approval was requested. Open the document and request a new approval under the current policy.'
  jest.mocked(fetch).mockResolvedValueOnce(response({ approvals: [approval] })).mockResolvedValueOnce(response({ error: explanation }, false))
  review(); await fillReason()
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(explanation)
  expect(within(alert).getByRole('link')).toHaveAttribute('href', `/purchases/tenders/${row.target_id}`)
  expect(screen.getByRole('textbox')).toHaveValue('Reviewed current document and policy.')
  expect(onClose).not.toHaveBeenCalled()
})