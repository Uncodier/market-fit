import { render, screen } from "@testing-library/react"
import { ChannelSetupStepper } from "@/app/components/settings/ChannelSetupStepper"

describe("ChannelSetupStepper", () => {
  it("renders completed, current, and upcoming setup stages", () => {
    render(
      <ChannelSetupStepper
        steps={[
          { label: "DNS Verification", status: "complete" },
          { label: "Inbound", status: "current" },
          { label: "Activation", status: "upcoming" },
        ]}
      />
    )

    expect(screen.getByRole("list", { name: "Setup progress" })).toBeInTheDocument()
    expect(screen.getByText("DNS Verification")).toBeInTheDocument()
    expect(screen.getByText("Inbound").closest("li")).toHaveAttribute("aria-current", "step")
    expect(screen.getByText("Activation")).toBeInTheDocument()
  })

  it("hides after every setup stage is complete", () => {
    render(
      <ChannelSetupStepper
        steps={[
          { label: "DNS Verification", status: "complete" },
          { label: "Inbound", status: "complete" },
          { label: "Activation", status: "complete" },
        ]}
      />
    )

    expect(screen.queryByRole("list", { name: "Setup progress" })).not.toBeInTheDocument()
  })
})
