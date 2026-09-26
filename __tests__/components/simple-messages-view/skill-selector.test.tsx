import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SkillSelector } from "@/app/components/simple-messages-view/components/SkillSelector"

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
})