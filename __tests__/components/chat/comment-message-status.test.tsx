import { render, screen } from '@testing-library/react'
import { MessageStatus } from '@/app/components/chat/chat-message-status'
import type { ChatMessage } from '@/app/types/chat'

it('distinguishes a proposed public reply from an intervention already being sent', () => {
  const message: ChatMessage = { role: 'assistant', text: 'Reply', timestamp: new Date(),
    metadata: { source: 'comment', status: 'pending', reply_to_message_id: 'comment-1' } }
  const { rerender } = render(<MessageStatus message={message} />)
  expect(screen.getByText('Proposed public reply')).toBeInTheDocument()
  expect(screen.queryByText('Sending...')).not.toBeInTheDocument()
  rerender(<MessageStatus message={{ ...message, role: 'team_member' }} />)
  expect(screen.getByText('Sending...')).toBeInTheDocument()
  rerender(<MessageStatus message={{ ...message, metadata: { status: 'pending', source: 'outstand_dm' } }} />)
  expect(screen.getByText('Sending...')).toBeInTheDocument()
})