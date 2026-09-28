import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MessageInput } from '@/app/components/simple-messages-view/components/MessageInput'
import { useMessageSending } from '@/app/components/simple-messages-view/hooks/useMessageSending'
import { useOptimizedMessageState } from '@/app/hooks/useOptimizedMessageState'
import { sendAssistantMessage } from '@/app/components/simple-messages-view/hooks/message-send-handlers'

jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site' } }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/components/ui/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock('@/app/components/simple-messages-view/hooks/message-send-handlers', () => ({
  sendAssistantMessage: jest.fn(), sendRobotMessage: jest.fn(),
}))
jest.mock('@/app/components/simple-messages-view/hooks/pending-work', () => ({
  buildPendingWorkPayload: jest.fn(), enqueuePendingWork: jest.fn(),
}))
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

function Composer() {
  const { message, setMessage, messageRef, handleMessageChange, clearMessage, textareaRef } = useOptimizedMessageState('', 'robot-composer-test')
  const { handleSendMessage } = useMessageSending({
    activeRobotInstance: { id: 'instance' },
    selectedActivity: 'ask',
    selectedContext: {} as any,
    skillSelection: { skill_mode: 'auto', skill_slugs: [] },
    messageRef,
    onClearMessage: clearMessage,
  })
  return <MessageInput
    message={message}
    selectedActivity="ask"
    selectedContext={{} as any}
    onMessageChange={setMessage}
    handleMessageChange={handleMessageChange}
    onActivityChange={jest.fn()}
    onContextChange={jest.fn()}
    onSubmit={handleSendMessage}
    disabled={false}
    placeholder="Type a message"
    textareaRef={textareaRef}
    imageParameters={{} as any}
    videoParameters={{} as any}
    audioParameters={{} as any}
    onImageParameterChange={jest.fn()}
    onVideoParameterChange={jest.fn()}
    onAudioParameterChange={jest.fn()}
    activeRobotInstance={{ id: 'instance' }}
    skillSelection={{ skill_mode: 'auto', skill_slugs: [] }}
    onSkillSelectionChange={jest.fn()}
  />
}

beforeEach(() => {
  window.localStorage.clear()
  jest.clearAllMocks()
})

it.each(['Enter', 'Send'])('clears the robot textarea on accepted send via %s, before completion', async method => {
  let accept!: () => void
  let complete!: (value: boolean) => void
  ;(sendAssistantMessage as jest.Mock).mockImplementation(({ onAccepted }) => {
    accept = onAccepted
    return new Promise(resolve => { complete = resolve })
  })
  render(<Composer />)
  const textarea = screen.getByPlaceholderText('Type a message') as HTMLTextAreaElement
  fireEvent.change(textarea, { target: { value: 'Hello Robots' } })
  if (method === 'Enter') fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
  else fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  expect(sendAssistantMessage).toHaveBeenCalledWith(expect.objectContaining({ messageToSend: 'Hello Robots' }))
  expect(textarea.value).toBe('Hello Robots')
  act(() => { accept() })
  expect(textarea.value).toBe('')
  await act(async () => { complete(true); await Promise.resolve() })
})

it('keeps the robot textarea text when admission fails', async () => {
  ;(sendAssistantMessage as jest.Mock).mockResolvedValue(false)
  render(<Composer />)
  const textarea = screen.getByPlaceholderText('Type a message') as HTMLTextAreaElement
  fireEvent.change(textarea, { target: { value: 'Try again' } })
  await act(async () => { fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' }) })
  expect(sendAssistantMessage).toHaveBeenCalledTimes(1)
  expect(textarea.value).toBe('Try again')
})