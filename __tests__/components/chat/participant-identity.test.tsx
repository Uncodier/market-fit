import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ChatHeader } from '@/app/components/chat/ChatHeader'
import { ChatParticipantMessageRow } from '@/app/components/chat/ChatParticipantMessageRow'
import { ConversationItem } from '@/app/components/chat/ConversationItem'
import { resolveParticipantIdentity } from '@/lib/chat/participant-identity'
import { CommentDisplayProvider } from '@/app/components/chat/CommentReplyContext'

jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site-1' } }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/ThemeContext', () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock('@/app/leads/actions', () => ({ updateLead: jest.fn() }))
jest.mock('@/app/components/navigation/NavigationLink', () => ({
  NavigationLink: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}))
jest.mock('@/app/components/chat/chat-toggle', () => ({ ChatToggle: () => null }))
jest.mock('@/app/components/chat/ChatMessageActionsBar', () => ({ ChatMessageActionsBar: () => null }))
jest.mock('@/app/components/chat/chat-message-content', () => ({ ChatMessageContent: () => null }))
jest.mock('@/app/components/ui/avatar', () => ({
  Avatar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarImage: ({ src, alt }: { src?: string; alt: string }) => <span role="img" aria-label={alt} data-src={src} />,
}))

const callbacks = {
  toggleChatList: jest.fn(), startNewConversation: jest.fn(), handleNewLeadConversation: jest.fn(),
  handleNewAgentConversation: jest.fn(), handlePrivateDiscussion: jest.fn(),
}
const header = {
  agentId: 'agent-1', agentName: 'Agent', currentAgent: null, isAgentOnlyConversation: false,
  isLoadingLead: false, leadData: null, isLead: false, isChatListCollapsed: false,
  conversationId: 'dm-1', ...callbacks,
}
const actions = {
  onEdit: jest.fn(), onDelete: jest.fn(), onAccept: jest.fn(), onUndoAccept: jest.fn(),
  deletingMessageId: null, acceptingMessageId: null, acceptedActionsMessageIds: new Set<string>(),
}

it.each([
  [{ participant_display_name: 'Taylor', participant_profile_picture: 'https://example.com/taylor.jpg' }, 'Taylor'],
  [{ participant_username: 'taylor' }, '@taylor'],
  [{ outstand_participant_id: '123456789', outstand_social_account_id: 'owned' }, 'Instagram contact'],
] as const)('renders DM participant identity in the header, not Visitor or a lead action', (custom_data, name) => {
  const participantIdentity = resolveParticipantIdentity({ channel: 'instagram', custom_data: { source: 'outstand_dm', ...custom_data } })
  render(<ChatHeader {...header} participantIdentity={participantIdentity} />)
  expect(screen.getByRole('heading', { name })).toBeInTheDocument()
  expect(screen.queryByText('Visitor')).not.toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  if (participantIdentity.avatarUrl) expect(screen.getByRole('img', { name })).toHaveAttribute('data-src', participantIdentity.avatarUrl)
  else expect(screen.getByRole('img', { name })).not.toHaveAttribute('data-src')
})

it('retains linked CRM names and lead navigation even with different provider identity', () => {
  render(<ChatHeader {...header} isLead leadData={{ id: 'lead-1', name: 'Manual CRM name', status: 'new' }}
    participantIdentity={{ name: 'Provider name', channel: 'instagram', avatarUrl: 'https://example.com/participant.jpg' }} />)
  expect(screen.getByRole('heading', { name: 'Manual CRM name' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Manual CRM name' })).toHaveAttribute('href', expect.stringContaining('/leads/lead-1'))
  expect(screen.queryByText('Provider name')).not.toBeInTheDocument()
})

it('keeps web visitors and private agent conversations distinct from external contacts', () => {
  const { rerender } = render(<ChatHeader {...header} />)
  expect(screen.getByRole('heading', { name: 'Visitor' })).toBeInTheDocument()
  rerender(<ChatHeader {...header} isAgentOnlyConversation participantIdentity={{ name: 'Instagram contact', channel: 'instagram' }} />)
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
})

it('displays manual subject and participant subtitle in the conversation list without claiming a lead', () => {
  render(<ConversationItem conversation={{
    id: 'dm-1', title: 'Manual subject', participantName: '@taylor', channel: 'instagram',
    agentId: 'agent-1', agentName: 'Agent', timestamp: new Date(),
  }} isSelected={false} onSelect={jest.fn()} onRename={jest.fn()} onArchive={jest.fn()} onDelete={jest.fn()} />)
  expect(screen.getByText('Manual subject')).toBeInTheDocument()
  expect(screen.getByText('@taylor')).toBeInTheDocument()
})

it.each(['user', 'visitor'] as const)('uses the same identity on incoming %s messages and leaves team senders intact', role => {
  const props = {
    message: { id: 'message-1', role, text: 'Hello', timestamp: new Date(), isCurrentUserMessage: false, isRightAligned: true },
    variant: 'visitor' as const, leadData: null, isDarkMode: false, actions,
    identity: { userDataCache: {}, agentDataCache: {}, participantIdentity: { name: 'Instagram contact', channel: 'instagram', avatarUrl: 'https://example.com/contact.jpg' } },
  }
  const { rerender } = render(<ChatParticipantMessageRow {...props} />)
  expect(screen.getByText('Instagram contact')).toBeInTheDocument()
  expect(screen.queryByText('Visitor')).not.toBeInTheDocument()
  rerender(<ChatParticipantMessageRow {...props} leadData={{ name: 'CRM name', avatarUrl: 'https://example.com/crm.jpg' }} variant="team-other" message={{ ...props.message, role: 'team_member', sender_name: 'Team member' }} />)
  expect(screen.getByText('Team member')).toBeInTheDocument()
  expect(screen.queryByText('Instagram contact')).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Team member' })).not.toHaveAttribute('data-src')
})

it('labels each legacy comment with its own author rather than the mixed conversation lead', () => {
  const message = { id: 'comment-a', role: 'user' as const, text: 'Question', timestamp: new Date(),
    isCurrentUserMessage: false, isRightAligned: true,
    metadata: { source: 'comment', author_name: 'Another reader', network: 'instagram', outstand_post_id: 'post-a' } }
  render(<CommentDisplayProvider messages={[message]} isCommentConversation showMessagePostContext>
    <ChatParticipantMessageRow message={message} variant="lead" isDarkMode={false} actions={actions}
      leadData={{ name: 'Conversation lead', avatarUrl: 'https://example.com/lead.jpg' }}
      identity={{ userDataCache: {}, agentDataCache: {} }} />
  </CommentDisplayProvider>)
  expect(screen.getByText('Another reader')).toBeInTheDocument()
  expect(screen.queryByText('Conversation lead')).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Another reader' })).not.toHaveAttribute('data-src')
})