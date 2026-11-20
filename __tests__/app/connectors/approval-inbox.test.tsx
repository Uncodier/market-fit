import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { PrivateReviewThread } from "@/app/components/chat/PrivateReviewThread"
import { ReviewInstanceLink } from "@/app/components/chat/ReviewInstanceLink"
import { indexReviews, PrivateReviewScope } from "@/app/components/chat/private-reviews"
import { deferred, jsonResponse, translate } from "./fixtures"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))
const fetchMock = jest.mocked(fetch)
const id = "728ac770-ad93-4147-8cf4-afe0ae4ad124"
const conversation = "728ac770-ad93-4147-8cf4-afe0ae4ad125"
const instance = "728ac770-ad93-4147-8cf4-afe0ae4ad126"
const item = { id, tool_slug: "GMAIL_FETCH_EMAILS", version: "20261119", agent_id: id, connector_id: id, conversation_id: conversation,
  account_label: "Support", arguments: { query: "from:customer@example.test" }, expires_at: "2099-11-20T12:00:00Z",
  context: { conversation_title: "Order question", agent_label: "Technical support agent", instance_id: null, instance_label: null, source_excerpt: "Find the receipt" } }
const reviewConversation = "728ac770-ad93-4147-8cf4-afe0ae4ad127"
const instanceItem = { ...item, id: instance, review_conversation_id: reviewConversation, conversation_id: null, tool_slug: "READ_ORDER", context: {
  ...item.context, conversation_title: null, instance_id: instance, instance_label: "Operations", source_excerpt: null } }
const thread = (conversationId = conversation, actor = "reviewer", site = id) => <PrivateReviewScope actorId={actor} siteId={site}>
  <PrivateReviewThread conversationId={conversationId} /></PrivateReviewScope>
beforeEach(() => fetchMock.mockReset())

test('the review header links to the exact origin and not a different conversation’s instance', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: [item, instanceItem] }))
  const header = (cid: string) => <PrivateReviewScope actorId="reviewer" siteId={id}><ReviewInstanceLink key={cid} conversationId={cid} /></PrivateReviewScope>
  const view = render(header(reviewConversation))
  expect(await screen.findByRole('link', { name: 'Open instance' })).toHaveAttribute('href', `/robots?instance=${instance}`)
  view.rerender(header(conversation))
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

test.each([['Approve and run', 'approve', 'completed'], ['Reject', 'reject', 'rejected']])("%s decides only the selected thread's stored action", async (name, decision, status) => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: [instanceItem, item] })).mockResolvedValueOnce(jsonResponse({ id, status })).mockResolvedValueOnce(jsonResponse({ items: [] }))
  render(thread())
  const button = await screen.findByRole('button', { name })
  expect(screen.getByText(/from:customer@example.test/)).toBeVisible()
  expect(screen.getByText(/Technical support agent/)).toBeVisible()
  expect(screen.getByText('Find the receipt')).toBeVisible()
  expect(screen.queryByText('READ_ORDER')).not.toBeInTheDocument()
  fireEvent.click(button)
  expect(await screen.findByRole('status')).toHaveTextContent(decision === 'approve' ? 'Action completed' : 'Request rejected')
  expect(fetchMock.mock.calls[1][0]).toBe(`/api/connectors/approvals/${id}/${decision}`)
  expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual({ site_id: id })
  expect(fetchMock).toHaveBeenCalledTimes(3)
})

test.each(['lost receipt', 'already claimed'])('%s cannot silently replay an approval', async failure => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: [item] }))
  if (failure === 'lost receipt') fetchMock.mockRejectedValueOnce(new Error('Disconnected'))
  else fetchMock.mockResolvedValueOnce(jsonResponse({}, 409))
  render(thread())
  const button = await screen.findByRole('button', { name: 'Approve and run' })
  fireEvent.click(button)
  expect(await screen.findByRole('alert')).toHaveTextContent(failure === 'lost receipt' ? /could not be confirmed/ : /no longer available/)
  expect(button).toBeDisabled()
  fireEvent.click(button)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('expired requests cannot be approved or rejected', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: [{ ...item, expires_at: '2000-01-01T00:00:00Z' }] }))
  render(thread())
  expect(await screen.findByRole('button', { name: 'Approve and run' })).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('expired')
  expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled()
})

test('refresh after a conflict rereads the authorized list without redispatching', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: [item] })).mockResolvedValueOnce(jsonResponse({}, 409))
    .mockResolvedValueOnce(jsonResponse({ items: [] }))
  render(thread())
  fireEvent.click(await screen.findByRole('button', { name: 'Reject' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Refresh requests' }))
  await waitFor(() => expect(screen.queryByText('Private action review')).not.toBeInTheDocument())
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([`/api/connectors/approvals?site_id=${id}`,
    `/api/connectors/approvals/${id}/reject`, `/api/connectors/approvals?site_id=${id}`])
})

test('the winning reviewer sees the result only in the selected thread and never sends a chat message', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: [item] }))
    .mockResolvedValueOnce(jsonResponse({ id, status: 'completed', result: { value: '<script>private example</script>' } }))
    .mockResolvedValueOnce(jsonResponse({ items: [] }))
  const view = render(thread())
  fireEvent.click(await screen.findByRole('button', { name: 'Approve and run' }))
  fireEvent.click(await screen.findByText('View private result'))
  expect(screen.getByText(/<script>private example/)).toBeVisible()
  expect(view.container.querySelector('script')).toBeNull()
  expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith('/api/connectors/approvals'))).toBe(true)
  view.rerender(thread(reviewConversation))
  expect(screen.queryByText(/private example/)).not.toBeInTheDocument()
})

test('a focus refresh removing an already claimed request does not lose its pending private receipt', async () => {
  const pending = deferred<Response>()
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: [item] })).mockReturnValueOnce(pending.promise)
    .mockResolvedValue(jsonResponse({ items: [] }))
  render(thread())
  fireEvent.click(await screen.findByRole('button', { name: 'Approve and run' }))
  await act(async () => { window.dispatchEvent(new Event('focus')) })
  expect(fetchMock).toHaveBeenCalledTimes(3)
  expect(screen.getByRole('button', { name: 'Approve and run' })).toBeDisabled()
  await act(async () => pending.resolve(jsonResponse({ id, status: 'completed', result: 'actual provider receipt' })))
  fireEvent.click(await screen.findByText('View private result'))
  expect(screen.getByText(/actual provider receipt/)).toBeVisible()
})

test('indexes only real conversation links, never a request or instance identifier', async () => {
  const sibling = { ...instanceItem, id: conversation }
  const unlinked = { ...instanceItem, id, review_conversation_id: null, tool_slug: 'LEGACY' }
  const byConversation = indexReviews([instanceItem, sibling, item, unlinked])
  expect(Array.from(byConversation.keys())).toEqual([reviewConversation, conversation])
  expect(indexReviews([{ ...item, review_conversation_id: reviewConversation }]).has(conversation)).toBe(false)
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: [instanceItem, sibling, item, unlinked] }))
  render(thread(reviewConversation))
  expect(await screen.findAllByRole('button', { name: 'Approve and run' })).toHaveLength(2)
  expect(screen.getAllByText('Operations')).toHaveLength(2)
  expect(screen.queryByText('LEGACY')).not.toBeInTheDocument()
  expect(screen.queryByText('Find the receipt')).not.toBeInTheDocument()
})

test('while the authorized inbox is refetching stale actions cannot be dispatched', async () => {
  const next = deferred<Response>()
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: [item] })).mockReturnValueOnce(next.promise)
  render(thread())
  const approve = await screen.findByRole('button', { name: 'Approve and run' })
  await act(async () => { window.dispatchEvent(new Event('focus')) })
  expect(approve).toBeDisabled()
  fireEvent.click(approve)
  await act(async () => next.resolve(jsonResponse({ items: [] })))
  expect(approve).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test.each(['actor', 'site'])('a change of %s retires stale actions and ignores late receipts', async dimension => {
  const pending = deferred<Response>()
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: [item] })).mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(jsonResponse({}, 403))
  const view = render(thread())
  fireEvent.click(await screen.findByRole('button', { name: 'Approve and run' }))
  view.rerender(thread(conversation, dimension === 'actor' ? 'member' : 'reviewer', dimension === 'site' ? instance : id))
  expect(screen.queryByText(/Technical support agent/)).not.toBeInTheDocument()
  await act(async () => pending.resolve(jsonResponse({ id, status: 'completed', result: 'private total' })))
  expect(screen.queryByText(/private total/)).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(3)
})

test('missing scope does not fetch approval data; an unauthorized list adds no queue-wide error', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({}, 403))
  const view = render(thread(conversation, ''))
  expect(fetchMock).not.toHaveBeenCalled()
  view.rerender(thread())
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  expect(view.container).toBeEmptyDOMElement()
})