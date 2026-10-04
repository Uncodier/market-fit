import { useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MediaParametersToolbar } from "@/app/components/simple-messages-view/components/MediaParametersToolbar"
import type { AudioParameters } from "@/app/components/simple-messages-view/types"
import { SPEECH_LANGUAGE_LABELS, SPEECH_LANGUAGE_VALUES, SPEECH_VOICE_LABELS, SPEECH_VOICE_VALUES } from "@/lib/ai/speech-options"

type AudioChange = (key: keyof AudioParameters, value: AudioParameters[keyof AudioParameters]) => void

function Toolbar({
  parameters,
  onChange,
  activity = "generate-audio",
}: {
  parameters: AudioParameters
  onChange: AudioChange
  activity?: string
}) {
  return (
    <MediaParametersToolbar
      selectedActivity={activity}
      audioParameters={parameters}
      imageParameters={{ format: "PNG", aspectRatio: "1:1", quality: "hd" }}
      videoParameters={{ aspectRatio: "16:9", resolution: "720p", duration: 6 }}
      onAudioParameterChange={onChange}
      onImageParameterChange={jest.fn()}
      onVideoParameterChange={jest.fn()}
    />
  )
}

function PersistedToolbar({ initial, onSave }: { initial: AudioParameters; onSave: jest.Mock }) {
  const [parameters, setParameters] = useState(initial)
  return (
    <Toolbar
      parameters={parameters}
      onChange={(key, value) => {
        const next = { ...parameters, [key]: value }
        setParameters(next)
        onSave(key, value, next)
      }}
    />
  )
}

const selector = (name: string) => screen.getByRole("combobox", { name: `Audio ${name}` })
const open = (name: string) => fireEvent.keyDown(selector(name), { key: "ArrowDown" })
async function choose(name: string, option: string) {
  open(name)
  fireEvent.click(await screen.findByRole("option", { name: option }))
}

describe("audio parameter controls", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: jest.fn() })
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: jest.fn(() => false) })
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: jest.fn() })
  })

  afterAll(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView")
    Reflect.deleteProperty(HTMLElement.prototype, "hasPointerCapture")
    Reflect.deleteProperty(HTMLElement.prototype, "releasePointerCapture")
  })

  it("defaults both legacy unset selections to Auto without writing parameters on render", async () => {
    const onChange = jest.fn()
    render(<Toolbar parameters={{ format: "MP3", expectedResults: 1 }} onChange={onChange} />)

    expect(selector("voice")).toHaveTextContent("Voice: Auto (agent chooses)")
    expect(selector("language")).toHaveTextContent("Language: Auto (agent chooses)")
    expect(selector("language")).toHaveAccessibleDescription(/Language guides the agent when writing speech text/)
    expect(screen.getByText(/Azure tts-hd is multilingual/)).toHaveTextContent(/detects the language from the input text; it does not translate it/)
    open("voice")
    expect(await screen.findByRole("option", { name: "Auto (agent chooses)" })).toHaveAttribute("aria-selected", "true")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("offers exactly the supported voices and languages with English labels", async () => {
    render(<Toolbar parameters={{ format: "MP3" }} onChange={jest.fn()} />)
    open("voice")
    await screen.findByRole("option", { name: "Alloy" })
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(SPEECH_VOICE_VALUES.map((value) => SPEECH_VOICE_LABELS[value]))
    expect(SPEECH_VOICE_VALUES).toEqual(["auto", "alloy", "echo", "fable", "onyx", "nova", "shimmer"])
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument())
    open("language")
    await screen.findByRole("option", { name: "English" })
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(SPEECH_LANGUAGE_VALUES.map((value) => SPEECH_LANGUAGE_LABELS[value]))
    expect(SPEECH_LANGUAGE_VALUES).toEqual(["auto", "en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko", "ar", "hi", "ru", "nl", "pl", "tr", "sv", "id", "uk", "vi"])
  })

  it("emits both selections and explicit Auto while preserving format, result count, and the other selection", async () => {
    const onSave = jest.fn()
    render(<PersistedToolbar initial={{ format: "WAV", expectedResults: 3, voice: "alloy", language: "en" }} onSave={onSave} />)

    await choose("voice", "Nova")
    expect(onSave).toHaveBeenLastCalledWith("voice", "nova", { format: "WAV", expectedResults: 3, voice: "nova", language: "en" })
    expect(selector("language")).toHaveTextContent("English")
    await choose("language", "Spanish")
    expect(onSave).toHaveBeenLastCalledWith("language", "es", { format: "WAV", expectedResults: 3, voice: "nova", language: "es" })
    expect(selector("voice")).toHaveTextContent("Nova")
    expect(selector("format")).toHaveTextContent("WAV")
    expect(screen.getByText("3 results").closest('[role="combobox"]')).toBeInTheDocument()

    await choose("voice", "Auto (agent chooses)")
    expect(onSave).toHaveBeenLastCalledWith("voice", "auto", { format: "WAV", expectedResults: 3, voice: "auto", language: "es" })
    await choose("language", "Auto (agent chooses)")
    expect(onSave).toHaveBeenLastCalledWith("language", "auto", { format: "WAV", expectedResults: 3, voice: "auto", language: "auto" })
  })

  it("reopens with persisted selections after the toolbar is remounted", async () => {
    const onSave = jest.fn()
    const view = render(<PersistedToolbar initial={{ format: "MP3", expectedResults: 2 }} onSave={onSave} />)
    await choose("voice", "Shimmer")
    await choose("language", "Japanese")
    const persisted = onSave.mock.calls[1][2] as AudioParameters
    view.unmount()

    const onChange = jest.fn()
    render(<Toolbar parameters={persisted} onChange={onChange} />)
    expect(selector("voice")).toHaveTextContent("Shimmer")
    expect(selector("language")).toHaveTextContent("Japanese")
    open("voice")
    expect(await screen.findByRole("option", { name: "Shimmer" })).toHaveAttribute("aria-selected", "true")
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument())
    open("language")
    expect(await screen.findByRole("option", { name: "Japanese" })).toHaveAttribute("aria-selected", "true")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("does not show speech selectors for other activities", () => {
    render(<Toolbar activity="generate-image" parameters={{ format: "MP3" }} onChange={jest.fn()} />)
    expect(screen.queryByRole("combobox", { name: "Audio voice" })).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Audio language" })).not.toBeInTheDocument()
    expect(screen.queryByText(/Azure tts-hd/)).not.toBeInTheDocument()
  })
})