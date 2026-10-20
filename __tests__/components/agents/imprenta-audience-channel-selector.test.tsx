import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"

import { ImprentaAudienceChannelSelector } from "@/app/components/agents/imprenta-audience-channel-selector"
import { ImprentaPublishDestinationSelector } from "@/app/components/agents/imprenta-publish-destination-selector"

function AudienceChannelHarness({ initial = [] }: { initial?: string[] }) {
  const [channels, setChannels] = useState(initial)

  return (
    <>
      <ImprentaAudienceChannelSelector channels={channels} onChannelsChange={setChannels} />
      <output data-testid="channels">{JSON.stringify(channels)}</output>
    </>
  )
}

describe("ImprentaAudienceChannelSelector", () => {
  it("uses the same button design and responsive layout as Publish", () => {
    render(
      <>
        <ImprentaPublishDestinationSelector
          site={{ url: "https://example.com" }}
          destinations={["blog"]}
          onDestinationsChange={jest.fn()}
        />
        <ImprentaAudienceChannelSelector channels={["email"]} onChannelsChange={jest.fn()} />
      </>
    )

    const publishButton = screen.getByRole("button", { name: "Blog" })
    const emailButton = screen.getByRole("button", { name: "Email" })
    expect(emailButton.className).toBe(publishButton.className)
    expect(emailButton.parentElement?.className).toBe(publishButton.parentElement?.className)

    for (const name of ["Email", "Web", "Phone", "Deals"]) {
      const button = screen.getByRole("button", { name })
      const text = screen.getByText(name)
      const selected = name === "Email"
      expect(button).toHaveClass("h-8", "w-full", "justify-start", "text-left", "rounded-md")
      expect(button).toHaveAttribute("type", "button")
      expect(button).toHaveAttribute("aria-pressed", String(selected))
      expect(button).toHaveAttribute("data-state", selected ? "on" : "off")
      expect(text).toHaveClass("truncate", "text-left")
      expect(text.previousElementSibling?.querySelector("svg")).not.toBeNull()
      expect(Boolean(text.nextElementSibling?.querySelector("svg"))).toBe(selected)
    }
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
  })

  it.each(["Email", "Web", "Phone", "Deals"])("toggles %s on and off when its label is clicked without bubbling", (name) => {
    const onCanvasClick = jest.fn()
    render(<div onClick={onCanvasClick}><AudienceChannelHarness /></div>)
    const button = screen.getByRole("button", { name })

    fireEvent.click(screen.getByText(name))
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(button).toHaveAttribute("data-state", "on")
    expect(screen.getByTestId("channels")).toHaveTextContent(JSON.stringify([name.toLowerCase()]))

    fireEvent.click(screen.getByText(name))
    expect(button).toHaveAttribute("aria-pressed", "false")
    expect(button).toHaveAttribute("data-state", "off")
    expect(screen.getByTestId("channels")).toHaveTextContent("[]")
    expect(onCanvasClick).not.toHaveBeenCalled()
  })

  it("keeps the other selected channels when enabling or disabling an option", () => {
    render(<AudienceChannelHarness initial={["email", "web"]} />)

    fireEvent.click(screen.getByRole("button", { name: "Phone" }))
    expect(screen.getByTestId("channels")).toHaveTextContent('["email","web","phone"]')
    fireEvent.click(screen.getByRole("button", { name: "Email" }))
    expect(screen.getByTestId("channels")).toHaveTextContent('["web","phone"]')
  })

  it.each([undefined, null])("defaults to no selection when channels is %s", (channels) => {
    const onChannelsChange = jest.fn()
    render(<ImprentaAudienceChannelSelector channels={channels} onChannelsChange={onChannelsChange} />)

    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("aria-pressed", "false")
    }
    fireEvent.click(screen.getByRole("button", { name: "Deals" }))
    expect(onChannelsChange).toHaveBeenCalledWith(["deals"])
  })
})