import { LocalizationProvider } from '@/app/context/LocalizationContext'
import type { ReactNode } from 'react'
import { createRef } from "react"
import { fireEvent, render as rtlRender, screen, waitFor, within } from "@testing-library/react"
import { ChatMessages } from "@/app/components/chat/ChatMessages"
import { ChatList } from "@/app/components/chat/chat-list"
import { useConversationsList } from "@/app/hooks/useConversationsList"
import { PrivateReviewScope } from "@/app/components/chat/private-reviews"
import { ChatMessageContent } from "@/app/components/chat/chat-message-content"
import { CommentSourceLinks } from "@/app/components/chat/CommentSourceLinks"
import { ConversationItem } from "@/app/components/chat/ConversationItem"
import type { ChatMessage } from "@/app/types/chat"

jest.mock("@/app/hooks/useConversationsList", () => ({ useConversationsList: jest.fn() }))
jest.mock("@/app/hooks/useConversationRealtime", () => ({ useConversationRealtime: () => {} }))
jest.mock("@/app/hooks/useConversationListActions", () => ({ useConversationListActions: () => ({}) }))
jest.mock("react-markdown", () => ({ __esModule: true, default: ({ children }: { children: string }) => <p>{children}</p> }))
jest.mock("remark-gfm", () => ({ __esModule: true, default: () => undefined }))
jest.mock("@/app/components/email/EmailViewer", () => ({ EmailViewer: () => null }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-1" } }) }))
jest.mock("@/app/context/LayoutContext", () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock("@/app/components/auth/auth-provider", () => ({ useAuthContext: () => ({ user: { id: 'reviewer' } }) }))
jest.mock("@/app/components/chat/EditMessageModal", () => ({ EditMessageModal: () => null }))
jest.mock("@/app/components/chat/EmptyConversation", () => ({ EmptyConversation: () => <p>No messages</p> }))
jest.mock("@/app/components/chat/use-chat-message-actions", () => ({ useChatMessageActions: () => ({}) }))
jest.mock("@/app/components/chat/use-chat-message-data", () => ({
  useProcessedMessages: ({ chatMessages }: { chatMessages: ChatMessage[] }) => chatMessages,
  useMessageSenderData: () => ({ userDataCache: {}, agentDataCache: {} }),
}))
jest.mock("@/app/components/chat/ChatMessageRow", () => ({
  ChatMessageRow: ({ message }: { message: ChatMessage }) => (
    <article data-testid="message" data-message-id={message.id}><ChatMessageContent message={message} /></article>
  ),
}))

const metadata = {
  source: "comment", network: "instagram", publisher_account_id: "owned-1", publisher_username: "our.brand",
  outstand_post_id: "post-1", author_id: "reader-1", author_name: "Reader", platform_comment_id: "comment-1",
  post_title: "Spring collection", post_text: "Explore the new collection", platform_post_url: "https://instagram.com/p/one/",
}
const canonical = { ...metadata, comment_grouping_version: 1 }
const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "question", role: "user", text: "Is the blue one available?", metadata,
  timestamp: new Date("2026-10-01T12:00:00Z"), ...overrides,
})
const props = {
  messagesEndRef: createRef<HTMLDivElement>(), isLoadingMessages: false, isAgentResponding: false,
  agentId: "agent-1", agentName: "Agent", isAgentOnlyConversation: false, isLead: false,
  leadData: null, conversationId: "conversation-1",
}

describe("social comment conversation display", () => {
  it("shows one canonical post header and exact replies directly below their original comment", () => {
    const question = message()
    const unrelated = message({ id: "unrelated", text: "Unrelated later comment", timestamp: new Date("2026-10-01T12:01:00Z"),
      metadata: { ...metadata, platform_comment_id: "comment-2" } })
    const response = message({ id: "reply", role: "assistant", text: "Yes, it is available.", timestamp: new Date("2026-10-01T12:02:00Z"),
      metadata: { ...metadata, status: "pending", reply_to_message_id: "question", reply_to_comment_id: "comment-1" } })
    render(<ChatMessages {...props} conversationCustomData={canonical} chatMessages={[response, question, unrelated]} />)

    expect(screen.getByLabelText("Conversation post context")).toHaveTextContent("Spring collection")
    expect(screen.getByLabelText("Conversation post context").parentElement).toHaveClass("sticky", "top-0", "bg-background")
    expect(screen.queryByLabelText("Message post context")).not.toBeInTheDocument()
    expect(screen.getAllByTestId("message").map(row => row.getAttribute("data-message-id"))).toEqual(["question", "reply", "unrelated"])
    const quote = screen.getByLabelText("Replied-to comment")
    expect(quote).toHaveTextContent("Is the blue one available?")
    expect(quote).not.toHaveTextContent("Unrelated later comment")
    expect(screen.getByRole("link", { name: "View post" })).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("renders an exact read-only parent quote even when that parent is outside the visible timeline", () => {
    const response = message({ id: "reply", role: "team_member", text: "The response",
      metadata: { ...metadata, reply_to_message_id: "not-loaded", reply_to_comment_id: "original-comment" },
      replyContext: { availability: "available", messageId: "not-loaded", commentId: "original-comment",
        authorName: "Original reader", text: "Exact absent parent text" },
    })
    render(<ChatMessages {...props} conversationCustomData={canonical} chatMessages={[response]} />)
    expect(screen.getByLabelText("Replied-to comment")).toHaveTextContent("Exact absent parent text")
    expect(screen.getByLabelText("Replied-to comment")).toHaveTextContent("Replying to Original reader")
    expect(screen.getAllByTestId("message")).toHaveLength(1)
  })

  it("shows unavailable context for unknown legacy responses, never the nearest incoming comment", () => {
    render(<ChatMessages {...props} chatMessages={[message(), message({ id: "reply", role: "assistant", text: "Reply", metadata: undefined })]} />)
    expect(screen.getByText("Reply context unavailable")).toBeInTheDocument()
    expect(screen.getByLabelText("Replied-to comment")).not.toHaveTextContent("Is the blue one available?")
  })

  it.each([undefined, canonical])("uses per-message post cards for legacy or conflicting groups: %j", customData => {
    render(<ChatMessages {...props} conversationCustomData={customData} chatMessages={[
      message(), message({ id: "second", metadata: { ...metadata, outstand_post_id: "post-2", post_title: "Autumn collection" } }),
    ]} />)
    expect(screen.queryByLabelText("Conversation post context")).not.toBeInTheDocument()
    const cards = screen.getAllByLabelText("Message post context")
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveTextContent("Spring collection")
    expect(cards[1]).toHaveTextContent("Autumn collection")
  })

  it("does not invent a post preview when only the canonical ID is known", () => {
    render(<ChatMessages {...props} conversationCustomData={{ ...canonical, post_title: null, post_text: null }} chatMessages={[]} />)
    expect(screen.getByLabelText("Conversation post context")).toHaveTextContent("Post post-1")
    expect(screen.getByText("Post preview unavailable")).toBeInTheDocument()
  })

  it("keeps DM order and excludes comment UI, even if a DM has a post reference", () => {
    const dm = { source: "outstand_dm", outstand_post_id: "shared-post" }
    render(<ChatMessages {...props} conversationCustomData={dm} chatMessages={[
      message({ id: "pending", role: "assistant", metadata: dm, timestamp: new Date("2026-10-01T12:05:00Z") }),
      message({ id: "earlier", metadata: dm }),
    ]} />)
    expect(screen.getAllByTestId("message").map(row => row.getAttribute("data-message-id"))).toEqual(["pending", "earlier"])
    expect(screen.queryByLabelText("Conversation post context")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Message post context")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Replied-to comment")).not.toBeInTheDocument()
  })
})

it("drops unsafe external and internal URLs in source links", () => {
  const { rerender } = render(<CommentSourceLinks platformPostUrl="javascript:alert(1)" contentId="../../settings" />)
  expect(screen.queryByRole("link")).not.toBeInTheDocument()
  expect(screen.getByText("Post link unavailable")).toBeInTheDocument()
  rerender(<CommentSourceLinks platformPostUrl="https://instagram.com/p/one" outstandPostId="post&site=foreign" />)
  expect(screen.getByRole("link", { name: "Open content" })).toHaveAttribute("href", "/content?search=post%26site%3Dforeign")
})

it("preserves a meaningful custom title and shows the participant and post subtitle in the list", () => {
  render(<ConversationItem conversation={{ id: "conversation", title: "Follow up on availability", subtitle: "Spring collection",
    participantName: "Reader", agentId: "agent", agentName: "Agent", timestamp: new Date(), channel: "instagram" }}
    isSelected={false} onSelect={jest.fn()} onArchive={jest.fn()} onDelete={jest.fn()} onRename={jest.fn()} />)
  expect(screen.getByText("Follow up on availability")).toBeInTheDocument()
  expect(screen.getByText("Spring collection")).toHaveAttribute("title", "Spring collection")
  expect(screen.getByText("Reader")).toBeInTheDocument()
  expect(within(screen.getByRole("button", { name: "More options" })).queryByText("Reader")).not.toBeInTheDocument()
})

it('renders the authorized private review beside real messages, never as an extra customer message', async () => {
  const conversationId = '728ac770-ad93-4147-8cf4-afe0ae4ad125'
  const id = '728ac770-ad93-4147-8cf4-afe0ae4ad124'
  jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{
    id, conversation_id: conversationId, agent_id: id, connector_id: id, account_label: 'Support', tool_slug: 'READ',
    version: 'v1', expires_at: '2099-01-01T00:00:00Z', arguments: { query: 'private-request-only' },
  }] }) } as Response)
  render(<PrivateReviewScope siteId={id} actorId="manager"><ChatMessages {...props} conversationId={conversationId}
    chatMessages={[message()]} /></PrivateReviewScope>)
  expect(await screen.findByRole('button', { name: 'Approve and run' })).toBeVisible()
  const rows = screen.getAllByTestId('message')
  expect(rows).toHaveLength(1)
  expect(rows[0]).not.toHaveTextContent('private-request-only')
  expect(screen.getByText(/private-request-only/)).toBeVisible()
})

it('refetches a missing review conversation and only offers the real returned row for selection', async () => {
  const target = '728ac770-ad93-4147-8cf4-afe0ae4ad125'
  const request = '728ac770-ad93-4147-8cf4-afe0ae4ad124'
  jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{
    id: request, conversation_id: null, review_conversation_id: target, agent_id: request, connector_id: request,
    account_label: 'Private account', tool_slug: 'READ', version: 'v1', expires_at: '2099-01-01T00:00:00Z',
    arguments: { filter: 'private details' },
  }] }) } as Response)
  const refreshConversations = jest.fn()
  const list = { conversations: [], isInitialLoad: false, refreshConversations }
  const listHook = jest.mocked(useConversationsList)
  listHook.mockReturnValue(list as unknown as ReturnType<typeof useConversationsList>)
  const select = jest.fn()
  const ui = () => <PrivateReviewScope siteId={request} actorId="reviewer"><ChatList siteId={request}
    selectedConversationId={request} onSelectConversation={select} /></PrivateReviewScope>
  const view = render(ui())
  await waitFor(() => expect(refreshConversations).toHaveBeenCalledTimes(1))
  expect(screen.queryByText(/Awaiting review/)).not.toBeInTheDocument()
  const row = { id: target, title: 'Instance approvals', agentId: request, agentName: 'Agent', timestamp: new Date(), channel: 'internal_review' }
  listHook.mockReturnValue({ ...list, conversations: [row] } as unknown as ReturnType<typeof useConversationsList>)
  view.rerender(ui())
  expect(screen.getByText('Internal conversation')).toBeVisible()
  fireEvent.click(screen.getByText('Awaiting review (1)'))
  expect(select).toHaveBeenCalledWith(target, 'Agent', request, 'Instance approvals')
  expect(screen.queryByText(/private details|Private account/)).not.toBeInTheDocument()
})

it('shows an internal review inline in an empty real message history, then shows that nothing remains', async () => {
  const target = '728ac770-ad93-4147-8cf4-afe0ae4ad125'
  const id = '728ac770-ad93-4147-8cf4-afe0ae4ad124'
  jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{
    id, conversation_id: null, review_conversation_id: target, agent_id: id, connector_id: id, account_label: 'Support', tool_slug: 'READ',
    version: 'v1', expires_at: '2099-01-01T00:00:00Z', arguments: { query: 'private-request-only' },
  }] }) } as Response).mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) } as Response)
  render(<PrivateReviewScope siteId={id} actorId="manager"><ChatMessages {...props} conversationId={target}
    internalReview chatMessages={[]} /></PrivateReviewScope>)
  expect(await screen.findByRole('button', { name: 'Approve and run' })).toBeVisible()
  expect(screen.queryByTestId('message')).not.toBeInTheDocument()
  expect(screen.queryByText('No messages')).not.toBeInTheDocument()
  fireEvent.focus(window)
  expect(await screen.findByText('No actions are waiting for review.')).toBeVisible()
  expect(screen.queryByText(/private-request-only/)).not.toBeInTheDocument()
})

function render(ui: ReactNode) {
  return rtlRender(ui, { wrapper: ({ children }) => <LocalizationProvider preferredLocale="en">{children}</LocalizationProvider> })
}
