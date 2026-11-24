import type { ReactNode } from 'react'
import { render as rtlRender, screen } from '@testing-library/react'
import { LocalizationProvider } from '@/app/context/LocalizationContext'
import { MessageStatus, MessageTimestamp } from '@/app/components/chat/chat-message-status'
import { getAudioDeliveryStatus } from '@/lib/chat/audio-delivery'
import type { ChatMessage } from '@/app/types/chat'

function render(ui: ReactNode) {
  return rtlRender(ui, { wrapper: ({ children }) => <LocalizationProvider preferredLocale="en">{children}</LocalizationProvider> })
}

const message = (metadata: ChatMessage['metadata']): ChatMessage => ({
  role: 'assistant', text: 'Summary', timestamp: new Date(), metadata,
})

it('does not claim delivery from provider acceptance for text or legacy audio', () => {
  const { rerender } = render(<MessageTimestamp message={message({ status: 'sent' })} />)
  expect(screen.getByLabelText('Sent to provider; delivery unconfirmed')).toBeInTheDocument()
  expect(screen.queryByLabelText('Delivered')).not.toBeInTheDocument()
  rerender(<MessageTimestamp message={message({ status: 'sent', audio_delivery: { state: 'sent' } })} />)
  expect(screen.getByLabelText('Sent to provider; delivery unconfirmed')).toBeInTheDocument()
  expect(screen.queryByLabelText('Delivered')).not.toBeInTheDocument()
})

it.each(['delivered', 'read'])('uses the durable %s receipt over stale failure flags', state => {
  const data = message({ status: 'failed', command_status: 'failed', audio_delivery: { state: 'sent', delivery_status: state } })
  render(<><MessageTimestamp message={data} /><MessageStatus message={data} /></>)
  const label = state === 'read' ? 'Read' : 'Delivered'
  expect(screen.getByLabelText(label)).toBeInTheDocument()
  expect(screen.getByText(label)).toBeInTheDocument()
  expect(screen.queryByText('Failed to send')).not.toBeInTheDocument()
})

it.each(['failed', 'unknown', 'preparation_failed'])('shows %s audio without allowing a duplicate resend', state => {
  const onRetry = jest.fn()
  const data = message({ status: 'sent', audio_delivery: { state } })
  render(<><MessageTimestamp message={data} /><MessageStatus message={data} onRetry={onRetry} /></>)
  expect(screen.getByText(state === 'unknown' ? 'Delivery unconfirmed' : 'Failed to send')).toBeInTheDocument()
  expect(screen.getByText('Check audio delivery status before retrying.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Sent to provider; delivery unconfirmed')).not.toBeInTheDocument()
})

it.each(['pending', 'sending', 'queued'] as const)('keeps a %s request visible without inventing an audio receipt', status => {
  render(<MessageStatus message={message({ status, response_format: 'audio' })} />)
  expect(screen.getByText('Sending...')).toBeInTheDocument()
  expect(getAudioDeliveryStatus({ status, response_format: 'audio' })).toBeUndefined()
})

it('ignores malformed receipts and preserves the prepared-audio retry path', () => {
  expect(getAudioDeliveryStatus({ audio_delivery: [] })).toBeUndefined()
  expect(getAudioDeliveryStatus({ audio_delivery: 'sent' })).toBeUndefined()
  render(<MessageStatus message={message({ status: 'failed', command_status: 'failed', audio_delivery: { state: 'ready' } })} onRetry={jest.fn()} />)
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
})
it('separates manual approval, definite failure, and unconfirmed placement', () => {
  const row = { ...message({}), role: 'team_member' as const }
  const metadata = { dispatch_owner: 'chat_intervention', status: 'accepted' as const, delay_timer: 123, command_status: 'pending' as const }
  const retry = jest.fn()
  const { rerender } = render(<><MessageStatus message={{ ...row, metadata }} /><MessageTimestamp message={{ ...row, metadata }} /></>)
  expect(screen.getByText('Accepted')).toBeInTheDocument()
  expect(screen.queryByLabelText('Delivered')).not.toBeInTheDocument()
  rerender(<MessageStatus message={{ ...row, metadata: { ...metadata, command_status: 'failed' } }} onRetry={retry} />)
  expect(screen.getByText('Failed to send')).toBeInTheDocument()
  expect(screen.queryByText('Accepted')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
  rerender(<MessageStatus message={{ ...row, metadata: { ...metadata, call_status: 'placement_unknown' } }} onRetry={retry} />)
  expect(screen.getByText('Delivery unconfirmed')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('does not upgrade an older text acceptance receipt to sent or hide a signed failure', () => {
  const metadata = { dispatch_owner: 'chat_intervention', command_status: 'pending' as const, whatsapp_text_delivery: { state: 'accepted' } }
  const row = { ...message(metadata), role: 'team_member' as const }
  const { rerender } = render(<MessageStatus message={row} />)
  expect(screen.getByText('Delivery unconfirmed')).toBeInTheDocument()
  rerender(<><MessageStatus message={{ ...row, metadata: { ...metadata, status: 'failed' } }} />
    <MessageTimestamp message={{ ...row, metadata: { ...metadata, status: 'failed' } }} /></>)
  expect(screen.getByText('Failed to send')).toBeInTheDocument()
  expect(screen.queryByLabelText('Sent to provider; delivery unconfirmed')).not.toBeInTheDocument()
})
