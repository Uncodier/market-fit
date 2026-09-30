import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MessageInput } from '@/app/components/simple-messages-view/components/MessageInput'
import { useMessageSending } from '@/app/components/simple-messages-view/hooks/useMessageSending'
import { useOptimizedMessageState } from '@/app/hooks/useOptimizedMessageState'
import { sendAssistantMessage } from '@/app/components/simple-messages-view/hooks/message-send-handlers'
import { enqueuePendingWork } from '@/app/components/simple-messages-view/hooks/pending-work'

jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site' } }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/components/ui/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock('@/app/components/simple-messages-view/hooks/message-send-handlers', () => ({
  sendAssistantMessage: jest.fn(), sendRobotMessage: jest.fn(),
}))
jest.mock('@/app/components/simple-messages-view/hooks/pending-work', () => ({
  buildPendingWorkPayload: jest.fn().mockResolvedValue({}), enqueuePendingWork: jest.fn(),
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

function Composer({ instanceId = 'instance', disabled = false } = {}) {
  const { message, setMessage, messageRef, handleMessageChange, clearMessage, textareaRef } = useOptimizedMessageState('', 'robot-composer-test')
  const { handleSendMessage } = useMessageSending({
    activeRobotInstance: { id: instanceId },
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
    disabled={disabled}
    placeholder="Type a message"
    textareaRef={textareaRef}
    imageParameters={{} as any}
    videoParameters={{} as any}
    audioParameters={{} as any}
    onImageParameterChange={jest.fn()}
    onVideoParameterChange={jest.fn()}
    onAudioParameterChange={jest.fn()}
    activeRobotInstance={{ id: instanceId }}
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
  expect(textarea).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  act(() => { accept() })
  expect(textarea.value).toBe('')
  expect(textarea).toBeEnabled()
  expect(textarea).toHaveFocus()
  await act(async () => { complete(true); await Promise.resolve() })
})

it('keeps the robot textarea text when admission fails', async () => {
  let complete!: (value: boolean) => void
  ;(sendAssistantMessage as jest.Mock).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  render(<Composer />)
  const textarea = screen.getByPlaceholderText('Type a message') as HTMLTextAreaElement
  fireEvent.change(textarea, { target: { value: 'Try again' } })
  fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
  expect(textarea).toBeDisabled()
  await act(async () => { complete(false) })
  expect(sendAssistantMessage).toHaveBeenCalledTimes(1)
  expect(textarea.value).toBe('Try again')
  expect(textarea).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
})

it('ignores repeated Enter and form submissions while awaiting acceptance', async () => {
  let complete!: (value: boolean) => void
  ;(sendAssistantMessage as jest.Mock).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  render(<Composer />)
  const textarea = screen.getByPlaceholderText('Type a message') as HTMLTextAreaElement
  fireEvent.change(textarea, { target: { value: 'Send once' } })
  fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
  fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
  fireEvent.submit(textarea.closest('form')!)
  expect(sendAssistantMessage).toHaveBeenCalledTimes(1)
  expect(enqueuePendingWork).not.toHaveBeenCalled()
  await act(async () => { complete(false) })
})

it.each([false, true])('keeps a queued submission locked when the previous stream completes (queue success: %s)', async queued => {
  let accept!: () => void
  let complete!: (value: boolean) => void
  let saveQueue!: (value: boolean) => void
  ;(sendAssistantMessage as jest.Mock).mockImplementation(({ onAccepted }) => {
    accept = onAccepted
    return new Promise(resolve => { complete = resolve })
  })
  ;(enqueuePendingWork as jest.Mock).mockImplementation(() => new Promise(resolve => { saveQueue = resolve }))
  render(<Composer />)
  const textarea = screen.getByPlaceholderText('Type a message') as HTMLTextAreaElement
  fireEvent.change(textarea, { target: { value: 'First message' } })
  fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
  act(() => { accept() })
  fireEvent.change(textarea, { target: { value: 'Next message' } })
  await act(async () => { fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' }) })
  expect(enqueuePendingWork).toHaveBeenCalledTimes(1)
  expect(textarea).toBeDisabled()
  await act(async () => { complete(true) })
  expect(textarea).toBeDisabled()
  expect(textarea.value).toBe('Next message')
  await act(async () => { saveQueue(queued) })
  expect(textarea).toBeEnabled()
  expect(textarea.value).toBe(queued ? '' : 'Next message')
})

it('unlocks on conversation changes and ignores late acceptance from the previous conversation', async () => {
  let accept!: () => void
  let complete!: (value: boolean) => void
  ;(sendAssistantMessage as jest.Mock).mockImplementation(({ onAccepted }) => {
    accept = onAccepted
    return new Promise(resolve => { complete = resolve })
  })
  const { rerender } = render(<Composer />)
  const textarea = screen.getByPlaceholderText('Type a message') as HTMLTextAreaElement
  fireEvent.change(textarea, { target: { value: 'First message' } })
  fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
  expect(textarea).toBeDisabled()
  rerender(<Composer instanceId="other-instance" />)
  expect(textarea).toBeEnabled()
  fireEvent.change(textarea, { target: { value: 'Other conversation draft' } })
  act(() => { accept() })
  await act(async () => { complete(true) })
  expect(textarea.value).toBe('Other conversation draft')
  expect(textarea).toBeEnabled()
})

it('does not submit when the composer is externally disabled', () => {
  render(<Composer disabled />)
  const textarea = screen.getByPlaceholderText('Type a message')
  expect(textarea).toBeDisabled()
  fireEvent.submit(textarea.closest('form')!)
  expect(sendAssistantMessage).not.toHaveBeenCalled()
})