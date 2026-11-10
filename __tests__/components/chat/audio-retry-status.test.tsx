import type { ReactNode } from 'react'
import { LocalizationProvider } from '@/app/context/LocalizationContext'
import { render as rtlRender, screen } from '@testing-library/react'
import { MessageStatus } from '@/app/components/chat/chat-message-status'

it.each(['preparing', 'preparation_failed', 'dispatching', 'sent', 'unknown'])('hides retry for audio receipt %s even if command failed', state => {
  render(<MessageStatus message={{ role: 'team_member', text: 'Draft', timestamp: new Date(),
    metadata: { command_status: 'failed', response_format: 'audio', audio_delivery: { state } },
  }} onRetry={jest.fn()} />)
  expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  expect(screen.getByText('Check audio delivery status before retrying.')).toBeInTheDocument()
})

it('allows retrying a prepared receipt that has not dispatched', () => {
  render(<MessageStatus message={{ role: 'team_member', text: 'Draft', timestamp: new Date(),
    metadata: { command_status: 'failed', response_format: 'audio', audio_delivery: { state: 'ready' } },
  }} onRetry={jest.fn()} />)
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
})
function render(ui: ReactNode) {
  return rtlRender(ui, { wrapper: ({ children }) => <LocalizationProvider preferredLocale="en">{children}</LocalizationProvider> })
}
