import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AudioPlayer } from "@/app/components/agents/audio-player"

it("preserves caller styling and reflects native playback events", () => {
  const view = render(<AudioPlayer src="/audio.mp3" className="w-full" />)
  expect(view.container.firstChild).toHaveClass("w-full")
  const audio = view.container.querySelector("audio")!
  expect(audio).toHaveAttribute("preload", "metadata")
  fireEvent.play(audio)
  expect(screen.getByRole("button", { name: "Pause audio" })).toBeInTheDocument()
  fireEvent.pause(audio)
  expect(screen.getByRole("button", { name: "Play audio" })).toBeInTheDocument()
})

it("does not show playback when the browser rejects play", async () => {
  const play = jest.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValueOnce(new Error("Blocked"))
  render(<AudioPlayer src="/audio.mp3" />)
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Play audio" })) })
  await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
  expect(screen.getByRole("button", { name: "Play audio" })).toBeInTheDocument()
  play.mockRestore()
})

it("resets playback after ending or a media error", () => {
  const view = render(<AudioPlayer src="/audio.mp3" />)
  const audio = view.container.querySelector("audio")!
  for (const event of ["ended", "error"]) {
    fireEvent.play(audio)
    fireEvent(audio, new Event(event))
    expect(screen.getByRole("button", { name: "Play audio" })).toBeInTheDocument()
  }
})