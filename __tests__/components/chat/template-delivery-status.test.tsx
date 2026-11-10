import type { ReactNode } from 'react'
import { LocalizationProvider } from '@/app/context/LocalizationContext'
import { render as rtlRender, screen } from '@testing-library/react'
import { MessageStatus, MessageTimestamp } from '@/app/components/chat/chat-message-status'
import { withMappedCommandStatus } from '@/app/services/map-chat-command-status'
import { isDeliveryRetryBlocked } from '@/lib/chat/response-format'
import { getTemplateDeliveryStatus } from '@/lib/chat/template-delivery'
import type { ChatMessage } from '@/app/types/chat'

function message(state: unknown, status: NonNullable<ChatMessage['metadata']>['status'] = 'queued', delivery_status?: string): ChatMessage {
  return { role: 'team_member', text: 'Hello', timestamp: new Date(), metadata: {
    requested_response_format: 'audio', response_format: 'audio', delivery_format: 'template',
    template_delivery: { state, delivery_status, template_id: 'template-1', language: 'en' },
    status, command_status: 'failed',
  } }
}

it.each([
  ['creating', 'queued', 'Pending template approval', 'pending'],
  ['submitting', 'queued', 'Pending template approval', 'pending'],
  ['pending', 'queued', 'Pending template approval', 'pending'],
  ['ready', 'queued', 'Template ready to send', 'pending'],
  ['dispatching', 'queued', 'Sending template', 'pending'],
  ['accepted', 'queued', 'Template accepted', 'pending'],
  ['sent', 'sent', 'Template accepted', 'pending'],
  ['delivered', 'delivered', 'Template delivered', 'success'],
  ['read', 'delivered', 'Template read', 'success'],
  ['sent', 'failed', 'Template delivery failed', 'failed'],
  ['accepted', 'failed', 'Template delivery failed', 'failed'],
  ['failed', 'sent', 'Template delivery failed', 'failed'],
  ['rejected', 'failed', 'Template delivery failed', 'failed'],
  ['unknown', 'placement_unknown', 'Template delivery unconfirmed', 'pending'],
  ['future-state', 'queued', 'Template delivery unconfirmed', 'pending'],
] as const)('renders template %s without stale command failure or audio claims', (state, status, label, commandStatus) => {
  const row = message(state, status)
  render(<MessageStatus message={row} onRetry={jest.fn()} />)
  expect(screen.getByRole('status')).toHaveTextContent(label)
  expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  expect(screen.queryByText('Failed to send')).not.toBeInTheDocument()
  expect(screen.queryByText(/audio/i)).not.toBeInTheDocument()
  expect(withMappedCommandStatus(row.metadata)).toMatchObject({
    command_status: commandStatus, response_format: 'audio', requested_response_format: 'audio',
  })
})

it('updates visible pending approval to sent from Realtime metadata, not command success', () => {
  const { rerender } = render(<MessageStatus message={message('pending')} />)
  rerender(<MessageStatus message={message('sent', 'sent', 'sent')} />)
  expect(screen.getByText('Sent as template')).toBeInTheDocument()
  expect(screen.queryByText('Pending template approval')).not.toBeInTheDocument()
})

it('keeps a ready failed receipt owned by the workflow', () => {
  const onRetry = jest.fn()
  const row = message('ready', 'failed')
  render(<MessageStatus message={row} onRetry={onRetry} />)
  expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  expect(onRetry).not.toHaveBeenCalled()
})

it.each([undefined, null, {}, [], 'pending', { state: 'future-state' }])('blocks missing or malformed template receipts: %j', template_delivery => {
  expect(isDeliveryRetryBlocked({ delivery_format: 'template', template_delivery })).toBe(true)
  expect(getTemplateDeliveryStatus({ delivery_format: 'template', template_delivery, command_status: 'success' }))
    .toEqual({ label: 'Template delivery unconfirmed', commandStatus: 'pending' })
})

it('does not call provider acceptance delivered or uncertainty successful', () => {
  const { rerender } = render(<MessageTimestamp message={message('sent', 'sent')} />)
  expect(screen.queryByLabelText('Sent as template')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Delivered')).not.toBeInTheDocument()
  rerender(<MessageTimestamp message={message('sent', 'sent', 'sent')} />)
  expect(screen.getByLabelText('Sent as template')).toBeInTheDocument()
  expect(screen.queryByLabelText('Delivered')).not.toBeInTheDocument()
  rerender(<MessageTimestamp message={message('unknown', 'sent')} />)
  expect(screen.queryByLabelText('Sent as template')).not.toBeInTheDocument()
})

it('keeps an existing audio receipt guard even with a ready template', () => {
  expect(isDeliveryRetryBlocked({ ...message('ready', 'failed').metadata, audio_delivery: { state: 'unknown' } })).toBe(true)
})
it.each(['pending', 'rejected', 'dispatching'])('does not let stale sent metadata override the template receipt %s', state => {
  render(<MessageStatus message={message(state, 'sent')} />)
  expect(screen.queryByText('Sent as template')).not.toBeInTheDocument();
});

it.each([
  ['accepted', 'queued', 'queued', 'Template accepted', 'pending'],
  ['pending', 'queued', undefined, 'Pending template approval', 'pending'],
  ['ready', undefined, undefined, 'Template ready to send', 'pending'],
  ['accepted', 'sent', 'queued', 'Template accepted', 'pending'],
  ['sent', 'sending', 'sending', 'Sending template', 'pending'],
  ['sent', 'sent', 'sent', 'Sent as template', 'success'],
  ['sent', 'delivered', 'delivered', 'Template delivered', 'success'],
  ['sent', 'delivered', 'read', 'Template read', 'success'],
  ['sent', 'failed', 'sent', 'Template delivery failed', 'failed'],
  ['accepted', 'sent', 'failed', 'Template delivery failed', 'failed'],
  ['sent', 'sent', 'failed', 'Template delivery failed', 'failed'],
  ['sent', 'failed', 'delivered', 'Template delivered', 'success'],
  ['sent', 'failed', 'read', 'Template read', 'success'],
  ['delivered', 'failed', 'failed', 'Template delivered', 'success'],
  ['read', 'failed', 'sent', 'Template read', 'success'],
] as const)('uses receipt %s/%s/%s over stale command flags', (state, status, deliveryStatus, label, commandStatus) => {
  const row = message(state, status, deliveryStatus)
  const { rerender } = render(<><MessageStatus message={row} onRetry={jest.fn()} /><MessageTimestamp message={row} /></>)
  for (const staleCommand of ['failed', 'pending', 'success'] as const) {
    row.metadata!.command_status = staleCommand
    rerender(<><MessageStatus message={row} onRetry={jest.fn()} /><MessageTimestamp message={row} /></>)
    expect(screen.getByRole('status')).toHaveTextContent(label)
    expect(screen.getByRole('status')).toHaveClass(commandStatus === 'success' ? 'text-green-500' : commandStatus === 'failed' ? 'text-red-500' : 'text-amber-500')
    expect(withMappedCommandStatus(row.metadata)?.command_status).toBe(commandStatus)
    expect(screen.queryByLabelText(label) !== null).toBe(commandStatus === 'success')
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(isDeliveryRetryBlocked(row.metadata)).toBe(true)
  }
})

it.each([{ status: 'needs_reconciliation' as const }, { needs_reconciliation: true }])(
  'shows unavailable reconciliation instead of stale pending approval: %j', flags => {
    const row = message('pending')
    Object.assign(row.metadata!, flags, { command_status: 'success' })
    render(<><MessageStatus message={row} onRetry={jest.fn()} /><MessageTimestamp message={row} /></>)
    expect(screen.getByRole('status')).toHaveTextContent('Template delivery unconfirmed')
    expect(screen.queryByText('Pending template approval')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(withMappedCommandStatus(row.metadata)?.command_status).toBe('pending')
  },
)

it('does not let unavailable reconciliation regress an authoritative delivery receipt', () => {
  const row = message('read', 'needs_reconciliation', 'read')
  row.metadata!.needs_reconciliation = true
  render(<MessageStatus message={row} />)
  expect(screen.getByRole('status')).toHaveTextContent('Template read')
})
function render(ui: ReactNode) {
  return rtlRender(ui, { wrapper: ({ children }) => <LocalizationProvider preferredLocale="en">{children}</LocalizationProvider> })
}
