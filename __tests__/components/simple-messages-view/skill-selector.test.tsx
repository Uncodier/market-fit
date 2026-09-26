import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SkillSelector } from "@/app/components/simple-messages-view/components/SkillSelector"
import { MessageInput } from "@/app/components/simple-messages-view/components/MessageInput"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site" } }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/app/components/simple-messages-view/hooks/useAttachmentUpload", () => ({
  useAttachmentUpload: () => ({ uploadFile: jest.fn(), isUploading: false }),
}))
jest.mock("@/app/components/simple-messages-view/hooks/useRequirementStatus", () => ({
  useRequirementStatus: () => ({ requirementStatuses: [] }),
}))
jest.mock("@/app/components/ui/context-selector-modal", () => ({ ContextSelectorModal: () => null }))
jest.mock("@/app/components/context/context-mention-picker", () => ({ ContextMentionPicker: () => null }))
jest.mock("@/app/components/simple-messages-view/components/MediaParametersToolbar", () => ({
  MediaParametersToolbar: () => null,
}))
jest.mock("@/app/components/simple-messages-view/components/InstanceContextUsage", () => ({
  InstanceContextUsage: () => null,
}))

const originalFetch = global.fetch

describe("robot skill selector", () => {
  afterAll(() => { global.fetch = originalFetch })

  it("loads site and bundled skills, excludes disabled skills and limits selection to five", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, skills: [
        ...Array.from({ length: 6 }, (_, i) => ({ id: `id-${i}`, slug: `slug-${i}`, name: `Skill ${i}`, enabled: true })),
        { id: "disabled", slug: "disabled", name: "Disabled", enabled: false },
      ] }),
    })
    const onChange = jest.fn()
    const { rerender } = render(<SkillSelector siteId="site" value={{ skill_mode: "auto", skill_slugs: [] }} onChange={onChange} />)
    expect(global.fetch).toHaveBeenCalledWith("/api/skills?site_id=site", expect.objectContaining({ cache: "no-store" }))
    const trigger = screen.getByRole("button", { name: "Select skills" })
    expect(trigger).toHaveClass("bg-secondary", "h-8", "px-3")
    expect(trigger).toHaveTextContent("skills")
    fireEvent.click(trigger)
    expect(screen.queryByRole("combobox", { name: "Skill mode" })).not.toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Auto" })).toHaveAttribute("aria-selected", "true")
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Selected" }), { button: 0 })
    fireEvent.click(screen.getByRole("tab", { name: "Selected" }))
    expect(onChange).toHaveBeenCalledWith({ skill_mode: "required", skill_slugs: [] })
    expect(screen.getByRole("menuitem", { name: "Upload new skill" })).toHaveAttribute("href", "/skills?tab=manage#skill-editor")
    rerender(<SkillSelector siteId="site" value={{ skill_mode: "required", skill_slugs: ["slug-0", "slug-1", "slug-2", "slug-3", "slug-4"] }} onChange={onChange} />)
    await waitFor(() => expect(screen.getByText("Skill 5")).toBeInTheDocument())
    expect(trigger).toHaveTextContent("5")
    expect(trigger).toHaveAttribute("title", "Skills: 5 selected")
    expect(screen.queryByText("Disabled")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Skill 5")).toBeDisabled()
    expect(screen.getByLabelText("Skill 0")).not.toBeDisabled()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Auto" }), { button: 0 })
    fireEvent.click(screen.getByRole("tab", { name: "Auto" }))
    expect(onChange).toHaveBeenCalledWith({ skill_mode: "auto", skill_slugs: [] })
  })

  it("opens by click or touch, closes on Escape, outside click, and toggle", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ skills: [] }) })
    render(<><SkillSelector siteId="site" value={{ skill_mode: "auto", skill_slugs: [] }} onChange={jest.fn()} /><button type="button">Outside</button></>)
    await act(async () => {})
    const trigger = screen.getByRole("button", { name: "Select skills" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("group", { name: "Skill selection options" })).not.toBeInTheDocument()
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("group", { name: "Skill selection options" })).toHaveAttribute("id", trigger.getAttribute("aria-controls"))
    fireEvent.keyDown(document, { key: "Escape" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).toHaveFocus()
    fireEvent.click(trigger)
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }))
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(trigger)
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "false")
  })

  it("refreshes the catalog on return focus or catalog updates and cleans up listeners", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ skills: [] }) })
    global.fetch = fetchMock
    const { unmount } = render(<SkillSelector siteId="site" value={{ skill_mode: "auto", skill_slugs: [] }} onChange={jest.fn()} />)
    await waitFor(() => expect(screen.getByRole("button", { name: "Select skills" })).toHaveAttribute("aria-expanded", "false"))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => { fireEvent(window, new Event("focus")) })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await act(async () => { fireEvent(window, new Event("skill-catalog-updated")) })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(true)
    unmount()
    fireEvent(window, new Event("focus"))
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("prevents selections exceeding the cumulative 48 KB UTF-8 assistant budget", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ skills: [
      { id: "big", slug: "big", name: "Big", content: "é".repeat(24_001), enabled: true },
      { id: "first", slug: "first", name: "First", content: "a".repeat(47_999), enabled: true },
      { id: "second", slug: "second", name: "Second", content: "aa", enabled: true },
    ] }) })
    const onChange = jest.fn()
    const { rerender } = render(<SkillSelector siteId="site" value={{ skill_mode: "required", skill_slugs: [] }} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Select skills" }))
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /^Big/ })).toBeDisabled())
    expect(screen.getByText("Big").closest("label")).toHaveTextContent("exceeds 48 KB limit")
    expect(screen.getByLabelText("First")).not.toBeDisabled()
    rerender(<SkillSelector siteId="site" value={{ skill_mode: "required", skill_slugs: ["first"] }} onChange={onChange} />)
    expect(screen.getByRole("checkbox", { name: /^Second/ })).toBeDisabled()
    expect(screen.getByLabelText("First")).not.toBeDisabled()
    fireEvent.click(screen.getByLabelText("First"))
    expect(onChange).toHaveBeenCalledWith({ skill_mode: "required", skill_slugs: [] })
    rerender(<SkillSelector siteId="site" value={{ skill_mode: "required", skill_slugs: ["big"] }} onChange={onChange} />)
    expect(screen.getByRole("alert")).toHaveTextContent("Selected skills exceed the 48 KB limit")
  })

  it("shows skills only for instance assistant activities, not the Temporal robot activity", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ skills: [] }) })
    const props = {
      message: "", selectedActivity: "ask", selectedContext: {
        leads: [], contents: [], requirements: [], tasks: [], campaigns: [],
        quotations: [], deals: [], records: [],
      },
      onMessageChange: jest.fn(), onActivityChange: jest.fn(), onContextChange: jest.fn(),
      onSubmit: jest.fn(), disabled: false, placeholder: "Ask anything", textareaRef: { current: null },
      imageParameters: {} as any, videoParameters: {} as any, audioParameters: {} as any,
      onImageParameterChange: jest.fn(), onVideoParameterChange: jest.fn(), onAudioParameterChange: jest.fn(),
      skillSelection: { skill_mode: "auto" as const, skill_slugs: [] }, onSkillSelectionChange: jest.fn(),
    }
    const { rerender } = render(<MessageInput {...props} />)
    expect(screen.getByRole("button", { name: "Select skills" })).toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/skills?site_id=site", expect.anything()))
    await act(async () => { await Promise.resolve() })
    rerender(<MessageInput {...props} selectedActivity="robot" />)
    expect(screen.queryByRole("button", { name: "Select skills" })).not.toBeInTheDocument()
    rerender(<MessageInput {...props} selectedActivity="plan" />)
    expect(screen.getByRole("button", { name: "Select skills" })).toBeInTheDocument()
    await act(async () => { await Promise.resolve() })
  })
})