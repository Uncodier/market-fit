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