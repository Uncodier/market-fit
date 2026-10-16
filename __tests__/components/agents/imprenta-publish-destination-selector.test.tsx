import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"

import { ImprentaPublishDestinationSelector } from "@/app/components/agents/imprenta-publish-destination-selector"

const site = {
  settings: {
    channels: {
      connections: [
        {
          id: "voice-channel",
          type: "voice",
          status: "connected",
        },
      ],
    },
  },
}

const multiSite = { settings: {
  channels: { connections: [
    { id: "wa-1", type: "whatsapp", status: "connected", metadata: { phone_number: "+15550000001" } },
    { id: "wa-2", type: "whatsapp", status: "connected", metadata: { phone_number: "+15550000002" } },
    { id: "mail-1", type: "email", status: "connected", metadata: { email: "first@example.com" } },
    { id: "mail-2", type: "email", status: "connected", metadata: { email: "second@example.com" } },
    { id: "off", type: "whatsapp", status: "disconnected" },
    { id: "suspended", type: "whatsapp", status: "connected", license_suspended: true },
  ] },
  social_media: [
    { id: "fb-1", platform: "facebook", username: "first-page", isActive: true },
    { id: "fb-2", platform: "facebook", username: "second-page", isActive: true },
  ],
} }

function MultiDestinationHarness({ initial = [] }: { initial?: string[] }) {
  const [destinations, setDestinations] = useState(initial)
  return <>
    <ImprentaPublishDestinationSelector site={multiSite} destinations={destinations} onDestinationsChange={setDestinations} />
    <output data-testid="destinations">{JSON.stringify(destinations)}</output>
  </>
}

function VoiceDestinationHarness() {
  const [destinations, setDestinations] = useState(["voice"])

  return (
    <ImprentaPublishDestinationSelector
      site={site}
      destinations={destinations}
      onDestinationsChange={setDestinations}
    />
  )
}

describe("ImprentaPublishDestinationSelector", () => {
  it("renders left-aligned toggle buttons with a checkmark only on selected destinations", () => {
    render(<ImprentaPublishDestinationSelector
      site={{ ...multiSite, url: "https://example.com" }}
      destinations={["blog"]}
      onDestinationsChange={jest.fn()}
    />)

    for (const name of ["Facebook · first-page", "WhatsApp · +15550000001", "Blog"]) {
      const text = screen.getByText(name)
      const button = screen.getByRole("button", { name })
      expect(button).toHaveClass("justify-start", "text-left", "rounded-md", "w-full")
      expect(button).toHaveAttribute("type", "button")
      expect(text.parentElement).toBe(button)
      expect(text).toHaveClass("truncate", "text-left")
      expect(text.previousElementSibling).toHaveClass("shrink-0")
      expect(button.parentElement).toHaveClass("grid-cols-1", "sm:grid-cols-2")
      expect(button).toHaveAttribute("data-state", name === "Blog" ? "on" : "off")
      expect(Boolean(text.nextElementSibling?.querySelector("svg"))).toBe(name === "Blog")
    }
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
  })

  it("toggles when the label is clicked without bubbling to the canvas", () => {
    const onCanvasClick = jest.fn()
    render(<div onClick={onCanvasClick}><MultiDestinationHarness /></div>)
    const name = "WhatsApp · +15550000001"
    const button = screen.getByRole("button", { name })
    const text = screen.getByText(name)
    fireEvent.click(text)
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(button).toHaveAttribute("data-state", "on")
    expect(text.nextElementSibling?.querySelector("svg")).not.toBeNull()
    fireEvent.click(text)
    expect(button).toHaveAttribute("aria-pressed", "false")
    expect(button).toHaveAttribute("data-state", "off")
    expect(text.nextElementSibling?.querySelector("svg")).toBeNull()
    expect(onCanvasClick).not.toHaveBeenCalled()
  })

  it.each([
    ["WhatsApp · +15550000001", "WhatsApp · +15550000002", "whatsapp:connection:wa-1", "whatsapp:connection:wa-2"],
    ["Mail · first@example.com", "Mail · second@example.com", "mail:connection:mail-1", "mail:connection:mail-2"],
    ["Facebook · first-page", "Facebook · second-page", "facebook:social:fb-1", "facebook:social:fb-2"],
  ])("selects %s independently from %s and persists exact IDs", (first, second, firstId, secondId) => {
    render(<MultiDestinationHarness />)
    const firstButton = screen.getByRole("button", { name: first })
    const secondButton = screen.getByRole("button", { name: second })
    fireEvent.click(firstButton)
    expect(firstButton).toHaveAttribute("aria-pressed", "true")
    expect(secondButton).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByTestId("destinations")).toHaveTextContent(JSON.stringify([firstId]))
    fireEvent.click(secondButton)
    expect(screen.getByTestId("destinations")).toHaveTextContent(JSON.stringify([firstId, secondId]))
    fireEvent.click(firstButton)
    expect(firstButton).toHaveAttribute("aria-pressed", "false")
    expect(secondButton).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByTestId("destinations")).toHaveTextContent(JSON.stringify([secondId]))
  })

  it("does not silently expand ambiguous legacy channels to every account", () => {
    render(<MultiDestinationHarness initial={["whatsapp"]} />)
    expect(screen.getByRole("alert")).toHaveTextContent("ambiguous")
    expect(screen.getByRole("button", { name: "WhatsApp · +15550000001" })).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp · +15550000002" }))
    expect(screen.getByTestId("destinations")).toHaveTextContent('["whatsapp:connection:wa-2"]')
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("keeps unrelated ambiguous legacy channels until the user resolves them", () => {
    render(<MultiDestinationHarness initial={["whatsapp", "mail"]} />)
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp · +15550000002" }))
    expect(screen.getByRole("alert")).toHaveTextContent("mail")
    expect(screen.getByTestId("destinations")).toHaveTextContent('["mail","whatsapp:connection:wa-2"]')
    fireEvent.click(screen.getByRole("button", { name: "Mail · second@example.com" }))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByTestId("destinations")).toHaveTextContent('["whatsapp:connection:wa-2","mail:connection:mail-2"]')
  })

  it("flattens legacy Facebook pages and recognizes canonical account ID aliases", () => {
    const onChange = jest.fn()
    render(<ImprentaPublishDestinationSelector site={{ settings: { social_media: [
      { id: "parent", platform: "facebook", connectedPages: [{ id: "page-1", name: "Page One" }, { id: "page-2", name: "Page Two" }] },
      { id: "old-row", account_id: "canonical-ig", platform: "instagram", username: "my-ig", isActive: true },
    ] } }} destinations={[]} onDestinationsChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Facebook · Page Two" }))
    expect(onChange).toHaveBeenLastCalledWith(["facebook:social:page-2"])
    fireEvent.click(screen.getByRole("button", { name: "Instagram · my-ig" }))
    expect(onChange).toHaveBeenLastCalledWith(["instagram:social:canonical-ig"])
  })

  it("recognizes a saved Twitter alias and can turn it off without leaving a hidden target", () => {
    const onChange = jest.fn()
    render(<ImprentaPublishDestinationSelector site={{ settings: { social_media: [
      { id: "x-1", platform: "x", username: "one", isActive: true },
    ] } }} destinations={["twitter"]} onDestinationsChange={onChange} />)
    const toggle = screen.getByRole("button", { name: "X · one" })
    expect(toggle).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith([])
  })

  it("allows removing malformed persisted IDs without crashing UI inspection", () => {
    render(<MultiDestinationHarness initial={["whatsapp:connection:%"]} />)
    fireEvent.click(screen.getByRole("button", { name: "Unavailable account" }))
    expect(screen.getByTestId("destinations")).toHaveTextContent("[]")
  })

  it("hides disconnected/suspended connections and allows removing a stale selected ID", () => {
    render(<MultiDestinationHarness initial={["whatsapp:connection:deleted"]} />)
    expect(screen.queryByRole("button", { name: /suspended|off/ })).not.toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("no longer connected")
    fireEvent.click(screen.getByRole("button", { name: "Unavailable account" }))
    expect(screen.getByTestId("destinations")).toHaveTextContent("[]")
  })

  it("shows both voice options when the Voice channel is connected", () => {
    render(<VoiceDestinationHarness />)

    expect(
      screen.getByRole("button", { name: "Voice Message · voice-channel" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Voice Agent Call · voice-channel" })
    ).toBeInTheDocument()
  })

  it("selects only one voice variant at a time", () => {
    render(<VoiceDestinationHarness />)

    const voiceMessage = screen.getByRole("button", {
      name: "Voice Message · voice-channel",
    })
    const voiceAgentCall = screen.getByRole("button", {
      name: "Voice Agent Call · voice-channel",
    })

    expect(voiceMessage).toHaveAttribute("aria-pressed", "true")
    expect(voiceAgentCall).toHaveAttribute("aria-pressed", "false")

    fireEvent.click(voiceAgentCall)

    expect(voiceMessage).toHaveAttribute("aria-pressed", "false")
    expect(voiceAgentCall).toHaveAttribute("aria-pressed", "true")
  })

  it("hides both voice options when the Voice channel is disconnected", () => {
    render(
      <ImprentaPublishDestinationSelector
        site={null}
        destinations={[]}
        onDestinationsChange={jest.fn()}
      />
    )

    expect(
      screen.queryByRole("button", { name: "Voice Message" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Voice Agent Call" })
    ).not.toBeInTheDocument()
  })
})
