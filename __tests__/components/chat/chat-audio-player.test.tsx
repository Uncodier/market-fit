import { act, fireEvent, render, screen } from '@testing-library/react'
import { ChatAudioPlayer } from '@/app/components/chat/ChatAudioPlayer'
import { ChatAttachments } from '@/app/components/chat/ChatAttachments'
import { LocalizationProvider } from '@/app/context/LocalizationContext'

const url = 'https://files.example.test/response.mp3'
let play: jest.SpyInstance
let pause: jest.SpyInstance
let load: jest.SpyInstance
beforeEach(() => {
  play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  pause = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  load = jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())
const player = () => render(<LocalizationProvider preferredLocale="en"><ChatAudioPlayer url={url} name="Recording.mp3" /></LocalizationProvider>)
const audio = () => screen.getByLabelText('Recording.mp3') as HTMLAudioElement

it('shows unknown duration instead of fake zeroes and does not preload or autoplay', () => {
  player()
  expect(screen.getByLabelText('Duration')).toHaveTextContent('—:—')
  expect(audio()).toHaveAttribute('preload', 'none')
  expect(audio()).not.toHaveAttribute('autoplay')
  expect(play).not.toHaveBeenCalled()
  expect(screen.getByRole('slider')).toBeDisabled()
  expect(screen.getByRole('link', { name: 'Recording.mp3' })).toHaveAttribute('href', url)
  expect(screen.queryByText(/Open file/)).not.toBeInTheDocument()
})
it('plays, pauses, seeks, and updates duration from actual media events', async () => {
  player()
  Object.defineProperty(audio(), 'duration', { configurable: true, value: 91 })
  fireEvent.loadedMetadata(audio())
  expect(screen.getByLabelText('Duration')).toHaveTextContent('1:31')
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play audio' })) })
  expect(play).toHaveBeenCalledTimes(1)
  fireEvent.play(audio())
  expect(screen.getByRole('button', { name: 'Pause audio' })).toBeInTheDocument()
  audio().currentTime = 13
  fireEvent.timeUpdate(audio())
  expect(screen.getByLabelText('Elapsed time')).toHaveTextContent('0:13')
  fireEvent.change(screen.getByRole('slider'), { target: { value: 45 } })
  expect(audio().currentTime).toBe(45)
  fireEvent.click(screen.getByRole('button', { name: 'Pause audio' }))
  expect(pause).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Play audio' })).toBeInTheDocument()
})
it('cycles playback speed without opening a file or triggering playback', () => {
  player()
  fireEvent.click(screen.getByRole('button', { name: 'Playback speed: 1×' }))
  expect(audio().playbackRate).toBe(1.5)
  fireEvent.click(screen.getByRole('button', { name: 'Playback speed: 1.5×' }))
  expect(audio().playbackRate).toBe(2)
  fireEvent.click(screen.getByRole('button', { name: 'Playback speed: 2×' }))
  expect(audio().playbackRate).toBe(1)
  expect(play).not.toHaveBeenCalled()
})
it('handles rejection and expired files with a localized retry and retains filename access', async () => {
  play.mockRejectedValueOnce(new Error('unavailable'))
  player()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play audio' })) })
  expect(screen.getByRole('status')).toHaveTextContent('Unable to load audio')
  expect(screen.getByRole('button', { name: 'Play audio' })).toBeDisabled()
  expect(screen.getByRole('link', { name: 'Recording.mp3' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry audio' }))
  expect(load).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Play audio' })).toBeEnabled()
  expect(play).toHaveBeenCalledTimes(1)
})
it('handles non-finite duration and ends without remaining in playing state', () => {
  player()
  Object.defineProperty(audio(), 'duration', { configurable: true, value: Infinity })
  fireEvent.durationChange(audio())
  expect(screen.getByLabelText('Duration')).toHaveTextContent('—:—')
  fireEvent.play(audio())
  fireEvent.ended(audio())
  expect(screen.getByRole('button', { name: 'Play audio' })).toBeInTheDocument()
})
it('does not resume a pending play after the user pauses', async () => {
  let resolve!: () => void
  play.mockReturnValueOnce(new Promise<void>(done => { resolve = done }))
  player()
  fireEvent.click(screen.getByRole('button', { name: 'Play audio' }))
  fireEvent.click(screen.getByRole('button', { name: 'Pause audio' }))
  await act(async () => resolve())
  expect(pause).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button', { name: 'Play audio' })).toBeInTheDocument()
})
it('resets playback state when a different audio attachment replaces the current one', async () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => <LocalizationProvider preferredLocale="en">{children}</LocalizationProvider>
  const { rerender } = render(<ChatAttachments attachments={[{ url, kind: 'audio', name: 'Recording.mp3' }]} />, { wrapper })
  Object.defineProperty(audio(), 'duration', { configurable: true, value: 90 })
  fireEvent.loadedMetadata(audio())
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play audio' })) })
  fireEvent.play(audio())
  rerender(<ChatAttachments attachments={[{ url: 'https://files.example.test/second.mp3', kind: 'audio', name: 'Second.mp3' }]} />)
  expect(screen.getByRole('button', { name: 'Play audio' })).toBeInTheDocument()
  expect(screen.getByLabelText('Duration')).toHaveTextContent('—:—')
  expect(screen.getByLabelText('Second.mp3')).toHaveAttribute('src', 'https://files.example.test/second.mp3')
});
it('translates audio and attachment controls in Spanish without changing real filenames', () => {
  render(<LocalizationProvider preferredLocale="es"><ChatAttachments attachments={[
    { url, kind: 'audio', name: 'Audio response.mp3', mimeType: 'audio/mpeg' },
    { url: 'https://files.example.test/report.pdf', kind: 'document', name: 'Resultados.pdf', mimeType: 'application/pdf' },
  ]} /></LocalizationProvider>)
  expect(screen.getByRole('button', { name: 'Reproducir audio' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Audio' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Resultados.pdf' })).toBeInTheDocument()
  expect(screen.getByText('PDF · Se abre en una pestaña nueva')).toBeInTheDocument()
  expect(screen.queryByText(/Open file|Audio response/)).not.toBeInTheDocument()
})