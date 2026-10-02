import { createRef } from "react"
import { render, screen, within } from "@testing-library/react"
import { ChatMessages } from "@/app/components/chat/ChatMessages"
import { ChatMessageContent } from "@/app/components/chat/chat-message-content"
import { CommentSourceLinks } from "@/app/components/chat/CommentSourceLinks"
import { ConversationItem } from "@/app/components/chat/ConversationItem"
import type { ChatMessage } from "@/app/types/chat"

jest.mock("react-markdown", () => ({ __esModule: true, default: ({ children }: { children: string }) => <p>{children}</p> }))
jest.mock("remark-gfm", () => ({ __esModule: true, default: () => undefined }))
jest.mock("@/app/components/email/EmailViewer", () => ({ EmailViewer: () => null }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-1" } }) }))
jest.mock("@/app/context/LayoutContext", () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock("@/app/components/auth/auth-provider", () => ({ useAuthContext: () => ({ user: null }) }))
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