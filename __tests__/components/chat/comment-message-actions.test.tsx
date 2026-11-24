import { render, screen } from '@testing-library/react'
import { MessageActions } from '@/app/components/chat/MessageActions'
import type { ChatMessage } from '@/app/types/chat'

jest.mock('@/app/context/ThemeContext', () => ({ useTheme: () => ({ isDarkMode: false }) }))
const callbacks = { onEdit: jest.fn(), onDelete: jest.fn(), onAccept: jest.fn() }
const message: ChatMessage = { role: 'assistant', text: 'Reply', timestamp: new Date(),
  metadata: { source: 'comment', status: 'pending' } }

it.each(['sending', 'unknown', 'sent'])('hides moderation actions once public delivery is claimed: %s', comment_delivery_status => {
  render(<MessageActions {...callbacks} isActionsAccepted message={{ ...message, metadata: { ...message.metadata, comment_delivery_status } }} />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('still allows approval of an unclaimed pending comment proposal', () => {
  render(<MessageActions {...callbacks} message={message} />)
  expect(screen.getByRole('button', { name: 'Accept' })).toBeEnabled()
})
it.each(['pending', 'accepted', 'queued', 'failed'] as const)('never offers proposal mutations on manual %s, even with cached acceptance', status => {
  render(<MessageActions {...callbacks} isActionsAccepted message={{ ...message, role: 'team_member',
    metadata: { dispatch_owner: 'chat_intervention', status } }} />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('hides actions on a legacy dispatched row without hiding undo on assistant proposals', () => {
  const metadata = { status: 'accepted' as const, command_status: 'pending' as const }
  const { rerender } = render(<MessageActions {...callbacks} message={{ ...message, role: 'team_member', metadata }} />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  rerender(<MessageActions {...callbacks} message={{ ...message, metadata }} />)
  expect(screen.getByRole('button', { name: 'Pending' })).toBeEnabled()
})
