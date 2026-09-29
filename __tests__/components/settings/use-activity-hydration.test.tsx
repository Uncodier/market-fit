import { act, renderHook } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { normalizeActivitySettings } from "@/app/components/settings/activity-settings"
import { useActivityHydration } from "@/app/components/settings/use-activity-hydration"
import type { SiteFormValues } from "@/app/components/settings/form-schema"

describe("activity hydration", () => {
  const saved = normalizeActivitySettings({ leads_follow_up: { status: "active", daily_message_limit: 75, max_unanswered_messages: 8, weekdays: [0, 6], channel_accounts: { email: ["email"], whatsapp: [], sms: ["sms-id"], telegram: ["telegram-id"], voice: ["voice-id"], "custom-chat_v2": ["custom-id"] }, all_segments: true } })
  const setup = () => renderHook(({ incoming }: { incoming: unknown }) => {
    const form = useForm<SiteFormValues>({ defaultValues: { activities: normalizeActivitySettings() } })
    useActivityHydration(form, incoming, "site-a")
    return form
  }, { initialProps: { incoming: undefined as unknown } })

  it("hydrates delayed settings for the same site", () => {
    const { result, rerender } = setup()
    rerender({ incoming: saved })
    expect(result.current.getValues("activities.leads_follow_up")).toEqual(saved.leads_follow_up)
  })

  it("does not overwrite edits when settings refresh", () => {
    const { result, rerender } = setup()
    act(() => result.current.setValue("activities.leads_follow_up.daily_message_limit", 48, { shouldDirty: true }))
    rerender({ incoming: saved })
    expect(result.current.getValues("activities.leads_follow_up.daily_message_limit")).toBe(48)
  })
})