import { fireEvent, render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CreateCampaignFields } from "@/app/components/create-campaign-fields"
import { campaignFormSchema, type CampaignFormValues } from "@/app/campaigns/schema"
import messages from "@/app/context/locales/en.json"

jest.mock("@/app/components/ui/date-picker", () => ({
  DatePicker: () => <div data-testid="date-picker" />,
}))

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

function Form() {
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      title: "", description: "", priority: "medium", type: "inbound",
      createWithAi: false, segments: [], site_id: "site-1", user_id: "user-1",
    },
  })
  const t = (key: string) => (messages as unknown as Record<string, string>)[key] || key
  return (
    <form>
      <CreateCampaignFields form={form} segments={[]} t={t} />
      <output data-testid="ai-value">{String(form.watch("createWithAi"))}</output>
    </form>
  )
}

describe("campaign creation fields", () => {
  it("replaces the requirement picker with an off-by-default AI switch and an explanation", () => {
    render(<Form />)
    const toggle = screen.getByRole("switch", { name: "Create campaign with AI" })
    expect(toggle).toHaveAttribute("aria-checked", "false")
    expect(screen.getByText(/may need to provide API keys/)).toBeInTheDocument()
    expect(screen.getByText(/pending requirement/)).toBeInTheDocument()
    expect(screen.queryByText("Related Requirements")).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-checked", "true")
    expect(screen.getByTestId("ai-value")).toHaveTextContent("true")
  })
})