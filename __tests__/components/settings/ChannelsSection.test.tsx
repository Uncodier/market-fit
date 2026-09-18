import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { FormProvider, useForm } from "react-hook-form"
import { ChannelsSection } from "@/app/components/settings/ChannelsSection"
import type { SiteFormValues } from "@/app/components/settings/form-schema"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}))

jest.mock("@/app/components/settings/SupportChannelsSection", () => ({
  SupportChannelsSection: () => null,
}))

const tracking = {
  track_visitors: false,
  track_actions: false,
  record_screen: false,
  enable_chat: false,
  chat_accent_color: "#e0ff17",
  allow_anonymous_messages: false,
  chat_position: "bottom-right" as const,
  chat_title: "Chat with us",
  welcome_message: "Welcome",
  analytics_provider: "",
  analytics_id: "",
  tracking_code: "",
}

function TestForm({ onSave }: { onSave: jest.Mock }) {
  const form = useForm<SiteFormValues>({
    defaultValues: { tracking } as SiteFormValues,
  })

  return (
    <FormProvider {...form}>
      <ChannelsSection active onSave={onSave} />
    </FormProvider>
  )
}

describe("ChannelsSection", () => {
  it("uses the saved tracking values as the next dirty-state baseline", async () => {
    const onSave = jest.fn().mockResolvedValue(true)
    render(<TestForm onSave={onSave} />)

    const toggle = screen.getByRole("switch", { name: "Track Visitors" })
    const save = screen.getByRole("button", { name: "Save" })

    fireEvent.click(toggle)
    expect(save).toBeEnabled()

    fireEvent.click(save)
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(save).toBeDisabled())

    fireEvent.click(toggle)
    expect(save).toBeEnabled()
  })
})
