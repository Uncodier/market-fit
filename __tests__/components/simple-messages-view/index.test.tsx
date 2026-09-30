import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SimpleMessagesView } from '@/app/components/simple-messages-view'
import { useSimpleMessagesView } from '@/app/components/simple-messages-view/use-simple-messages-view'
import { createMessagesViewModel } from './messages-view-fixture'
import type { InstanceLog } from '@/app/components/simple-messages-view/types'

// Exercise the view and real composer, not network-backed orchestration or ESM markdown parsing.
jest.mock('@/app/components/simple-messages-view/use-simple-messages-view', () => ({
  useSimpleMessagesView: jest.fn(),
}))
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock('remark-gfm', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('remark-breaks', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/app/records/response-record-actions', () => ({
  syncAiFeedbackRecord: jest.fn(), createResponseRecord: jest.fn(),
  getResponseRecordCategories: jest.fn().mockResolvedValue({ categories: [] }),
}))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site' } }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/components/simple-messages-view/hooks/useAttachmentUpload', () => ({
  useAttachmentUpload: () => ({ uploadFile: jest.fn(), isUploading: false }),
}))
jest.mock('@/app/components/simple-messages-view/hooks/useRequirementStatus', () => ({
  useRequirementStatus: () => ({ requirementStatuses: [] }),
}))
jest.mock('@/app/components/simple-messages-view/components/ActivitySelector', () => ({ ActivitySelector: () => null }))
jest.mock('@/app/components/simple-messages-view/components/SkillSelector', () => ({ SkillSelector: () => null }))
jest.mock('@/app/components/simple-messages-view/components/MediaParametersToolbar', () => ({ MediaParametersToolbar: () => null }))
jest.mock('@/app/components/simple-messages-view/components/InstanceContextUsage', () => ({ InstanceContextUsage: () => null }))
jest.mock('@/app/components/ui/context-selector-modal', () => ({ ContextSelectorModal: () => null }))
jest.mock('@/app/components/context/context-mention-picker', () => ({ ContextMentionPicker: () => null }))
jest.mock('@/app/components/simple-messages-view/components/MessageItem', () => ({
  MessageItem: ({ log }: { log: InstanceLog }) => <p>{log.message}</p>,
}))

describe('SimpleMessagesView', () => {
  let model: ReturnType<typeof createMessagesViewModel>

  beforeEach(() => {
    jest.clearAllMocks()
    model = createMessagesViewModel()
    jest.mocked(useSimpleMessagesView).mockImplementation(props => ({ ...model, ...props }))
  })

  it('renders an empty conversation with a composer without creating a nested main landmark', () => {
    render(<main><SimpleMessagesView /></main>)
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByRole('textbox')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('applies the custom className to the conversation shell', () => {
    const { container } = render(<SimpleMessagesView className="custom-class" />)
    expect(container.firstElementChild).toHaveClass('custom-class', 'flex', 'flex-col')
    expect(container.firstElementChild).toContainElement(screen.getByRole('textbox'))
  })

  it('renders the current empty-state prompt when no robot is active', () => {
    render(<SimpleMessagesView />)
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Analyze our product-market fit...')
  })

  it('forwards draft edits and sends through the model', async () => {
    model.message = 'Review our product positioning'
    render(<SimpleMessagesView />)
    const textbox = screen.getByRole('textbox')
    expect(textbox).toHaveValue('Review our product positioning')
    fireEvent.change(textbox, { target: { value: 'Review our pricing' } })
    expect(model.handleMessageChange).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(model.handleSendMessage).toHaveBeenCalledWith(expect.any(Function)))
  })

  it('disables the composer while an agent is starting', () => {
    model.isStartingRobot = true
    model.message = 'Draft to retain'
    render(<SimpleMessagesView />)
    expect(screen.getByPlaceholderText('Starting agent...')).toBeDisabled()
    expect(screen.getByRole('textbox')).toHaveValue('Draft to retain')
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(model.handleSendMessage).not.toHaveBeenCalled()
  })

  it('renders the sent message and thinking state for a new agent', () => {
    model.isEmpty = false
    model.hasMessageBeenSent = true
    model.lastUserMessage = 'Review our product positioning'
    model.isNewMakinaThinking = true
    render(<SimpleMessagesView />)
    expect(screen.getByText('Review our product positioning')).toBeInTheDocument()
    expect(screen.getByText('Thinking')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('How can I help you today?')).toBeEnabled()
  })

  it('keeps stable timeline anchors when older logs are prepended', () => {
    const entry = (id: string) => ({
      type: 'log' as const,
      timestamp: '2026-09-30T10:00:00Z',
      data: { id, log_type: 'agent_action', level: 'info', message: id, created_at: '2026-09-30T10:00:00Z' },
    })
    model.isEmpty = false
    model.shouldShowNewMakina = false
    model.processedTimeline = [entry('latest-log')]
    const { rerender } = render(<SimpleMessagesView />)
    const anchor = screen.getByText('latest-log').closest('[data-timeline-item-id]')
    expect(anchor).toHaveAttribute('data-timeline-item-id', 'log-latest-log')

    model.processedTimeline = [entry('older-log'), entry('latest-log')]
    rerender(<SimpleMessagesView />)
    expect(screen.getByText('latest-log').closest('[data-timeline-item-id]')).toBe(anchor)
    expect(screen.getByText('older-log').closest('[data-timeline-item-id]'))
      .toHaveAttribute('data-timeline-item-id', 'log-older-log')
  })
})
