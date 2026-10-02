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