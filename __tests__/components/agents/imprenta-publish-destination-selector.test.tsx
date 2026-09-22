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
  it("shows both voice options when the Voice channel is connected", () => {
    render(<VoiceDestinationHarness />)

    expect(
      screen.getByRole("switch", { name: "Voice Message" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("switch", { name: "Voice Agent Call" })
    ).toBeInTheDocument()
  })

  it("selects only one voice variant at a time", () => {
    render(<VoiceDestinationHarness />)

    const voiceMessage = screen.getByRole("switch", {
      name: "Voice Message",
    })
    const voiceAgentCall = screen.getByRole("switch", {
      name: "Voice Agent Call",
    })

    expect(voiceMessage).toBeChecked()
    expect(voiceAgentCall).not.toBeChecked()

    fireEvent.click(voiceAgentCall)

    expect(voiceMessage).not.toBeChecked()
    expect(voiceAgentCall).toBeChecked()
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
      screen.queryByRole("switch", { name: "Voice Message" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("switch", { name: "Voice Agent Call" })
    ).not.toBeInTheDocument()
  })
})
