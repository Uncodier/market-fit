import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { SkillManager } from "@/app/components/settings/SkillManager"
import { SystemSkillsCatalog } from "@/app/components/settings/SystemSkillsCatalog"
import { CommunitySkillsBrowser } from "@/app/components/settings/CommunitySkillsBrowser"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-1" } }) }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const originalFetch = global.fetch

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, skills: [] }) })
})
afterAll(() => { global.fetch = originalFetch })

describe("Skills cards", () => {
  it("shows only the upload form when the site has no administrable skills", async () => {
    render(<SkillManager />)
    const editor = document.getElementById("skill-editor")!
    expect(editor).toBeInTheDocument()
    await waitFor(() => expect(within(screen.getByLabelText("Manage skills")).getByText(/No administrable skills yet/)).toBeInTheDocument())
    expect(document.getElementById("site-skills")).not.toBeInTheDocument()
    const submit = within(editor).getByRole("button", { name: "Upload skill" })
    expect(submit.closest(".border-t")).toBeInTheDocument()
    fireEvent.change(within(editor).getByLabelText("Skill Markdown"), { target: { value: "---\nname: Test\n---\n# Instructions" } })
    await waitFor(() => expect(submit).toBeEnabled())
    fireEvent.click(submit)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/skills", expect.objectContaining({ method: "POST" })))
  })

  it("selects a Markdown file from the footer for review before uploading", async () => {
    render(<SkillManager />)
    const editor = document.getElementById("skill-editor")!
    const selectFile = within(editor).getByRole("button", { name: "Select file" })
    const upload = within(editor).getByRole("button", { name: "Upload skill" })
    const fileInput = within(editor).getByLabelText("SKILL.md file") as HTMLInputElement
    expect(selectFile.closest(".border-t")).toBe(upload.closest(".border-t"))
    expect(selectFile).toHaveClass("ring-1")
    expect(fileInput).toHaveAttribute("accept", ".md,text/markdown,text/plain")
    expect(fileInput).toHaveClass("sr-only")
    expect(upload).toBeDisabled()

    const openPicker = jest.spyOn(fileInput, "click").mockImplementation(() => {})
    fireEvent.click(selectFile)
    expect(openPicker).toHaveBeenCalledTimes(1)

    const content = "---\nname: Test\n---\n# Instructions"
    const file = new File([content], "SKILL.md", { type: "text/markdown" })
    Object.defineProperty(file, "text", { value: jest.fn().mockResolvedValue(content) })
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => expect(within(editor).getByLabelText("Skill Markdown")).toHaveValue(content))
    expect(upload).toBeEnabled()
    expect(global.fetch).not.toHaveBeenCalledWith("/api/skills", expect.anything())
    fireEvent.click(upload)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/skills", expect.objectContaining({
      method: "POST", body: JSON.stringify({ site_id: "site-1", content }),
    })))
  })

  it("explains missing frontmatter before upload without sending the file to the API", async () => {
    render(<SkillManager />)
    const editor = document.getElementById("skill-editor")!
    const fileInput = within(editor).getByLabelText("SKILL.md file") as HTMLInputElement
    const upload = within(editor).getByRole("button", { name: "Upload skill" })
    const invalid = "# Configure the project\nUse your own credentials outside the skill."
    const file = new File([invalid], "setup.md", { type: "text/markdown" })
    Object.defineProperty(file, "text", { value: jest.fn().mockResolvedValue(invalid) })
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => expect(within(editor).getByRole("alert")).toHaveTextContent("SKILL.md must start with a frontmatter header"))
    expect(within(editor).getByLabelText("Skill Markdown")).toHaveAttribute("aria-invalid", "true")
    expect(upload).toBeDisabled()
    fireEvent.click(upload)
    expect(global.fetch).not.toHaveBeenCalledWith("/api/skills", expect.anything())
    fireEvent.change(within(editor).getByLabelText("Skill Markdown"), { target: { value: "---\nname: project-setup\n---\n# Configure the project" } })
    expect(within(editor).queryByRole("alert")).not.toBeInTheDocument()
    expect(upload).toBeEnabled()
  })

  it("shows only administrable skills in Manage and bundled skills in Makinari Skills", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, skills: [
        { id: "system:base", slug: "base", name: "Built-in skill", source: "system", enabled: true },
        { id: "custom-1", slug: "custom", name: "Custom skill", source: "custom", enabled: true },
        { id: "github-1", slug: "community", name: "Community skill", source: "github", enabled: false },
      ] }),
    })
    render(<><SkillManager /><SystemSkillsCatalog /></>)
    const manage = screen.getByLabelText("Manage skills")
    const makinari = screen.getByLabelText("Current Makinari skills")
    await waitFor(() => expect(within(manage).getByText("Custom skill")).toBeInTheDocument())
    expect(within(manage).getByText("Community skill")).toBeInTheDocument()
    expect(within(manage).queryByText("Built-in skill")).not.toBeInTheDocument()
    const ownSkills = document.getElementById("site-skills")!
    expect(ownSkills).toBeInTheDocument()
    expect(ownSkills.querySelectorAll(".rounded-xl")).toHaveLength(2)
    const ownSkillCard = within(ownSkills).getByText("Custom skill").closest(".rounded-xl")!
    expect(ownSkillCard).toContainElement(within(ownSkillCard as HTMLElement).getByRole("button", { name: "Edit" }))
    expect(within(makinari).getByText("Built-in skill")).toBeInTheDocument()
    expect(within(makinari).queryByText("Custom skill")).not.toBeInTheDocument()
    expect(within(makinari).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument()
  })

  it("shows each skill's enabled switch at the far right of its title and persists changes", async () => {
    let enabled = true
    global.fetch = jest.fn().mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === "PATCH") enabled = JSON.parse(init.body as string).enabled
      return { ok: true, json: async () => ({ skills: [
        { id: "custom-1", slug: "my-skill", name: "My skill", source: "custom", enabled },
      ] }) }
    })
    render(<SkillManager />)
    const card = (await screen.findByText("My skill")).closest(".rounded-xl") as HTMLElement
    const header = within(card).getByRole("heading", { name: "My skill" }).parentElement!.parentElement!
    const toggle = within(card).getByRole("switch", { name: "Enabled" })
    expect(header.lastElementChild).toContainElement(toggle)
    expect(toggle).toHaveAttribute("data-state", "checked")
    expect(within(card).queryByRole("button", { name: "Disable" })).not.toBeInTheDocument()
    fireEvent.click(toggle)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/skills/custom-1", expect.objectContaining({
      method: "PATCH", body: JSON.stringify({ site_id: "site-1", enabled: false }),
    })))
    await waitFor(() => expect(toggle).toHaveAttribute("data-state", "unchecked"))
    fireEvent.click(toggle)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/skills/custom-1", expect.objectContaining({
      method: "PATCH", body: JSON.stringify({ site_id: "site-1", enabled: true }),
    })))
    await waitFor(() => expect(toggle).toHaveAttribute("data-state", "checked"))
  })

  it("requires a destructive modal to delete the selected skill and keeps it open if deletion fails", async () => {
    let deleteFailed = true
    let hasSkill = true
    const confirm = jest.spyOn(window, "confirm")
    global.fetch = jest.fn().mockImplementation(async (_path: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        if (deleteFailed) return { ok: false, json: async () => ({ error: { message: "Could not delete skill" } }) }
        hasSkill = false
      }
      return { ok: true, json: async () => ({ skills: [
        ...(hasSkill ? [{ id: "custom-1", slug: "my-skill", name: "My skill", source: "custom", enabled: true }] : []),
        { id: "custom-2", slug: "another-skill", name: "Another skill", source: "custom", enabled: true },
      ] }) }
    })
    try {
      render(<SkillManager />)
      const card = (await screen.findByText("My skill")).closest(".rounded-xl") as HTMLElement
      expect(within(card).getByRole("button", { name: "Edit" })).toBeInTheDocument()
      const deleteButton = within(card).getByRole("button", { name: "Delete" })
      expect(deleteButton).toHaveClass("text-destructive")
      fireEvent.click(deleteButton)
      const dialog = screen.getByRole("alertdialog", { name: "Delete My skill?" })
      expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument()
      expect(global.fetch).not.toHaveBeenCalledWith("/api/skills/custom-1", expect.objectContaining({ method: "DELETE" }))
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
      expect(global.fetch).not.toHaveBeenCalledWith("/api/skills/custom-1", expect.objectContaining({ method: "DELETE" }))
      fireEvent.click(deleteButton)
      fireEvent.click(within(screen.getByRole("alertdialog", { name: "Delete My skill?" })).getByRole("button", { name: "Delete skill" }))
      await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/skills/custom-1", expect.objectContaining({
        method: "DELETE", body: JSON.stringify({ site_id: "site-1" }),
      })))
      expect(await screen.findByRole("alertdialog", { name: "Delete My skill?" })).toBeInTheDocument()
      expect(screen.getByText("My skill")).toBeInTheDocument()
      deleteFailed = false
      await waitFor(() => expect(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete skill" })).toBeEnabled())
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete skill" }))
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
      await waitFor(() => expect(screen.queryByText("My skill")).not.toBeInTheDocument())
      expect(screen.getByText("Another skill")).toBeInTheDocument()
      expect(global.fetch).not.toHaveBeenCalledWith("/api/skills/custom-2", expect.objectContaining({ method: "DELETE" }))
      expect(confirm).not.toHaveBeenCalled()
    } finally {
      confirm.mockRestore()
    }
  })

  it("indexes current Makinari skills by role with anchors that track filtering", async () => {
    const onSectionsChange = jest.fn()
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ skills: [
      { id: "system:makinari-rol-frontend", slug: "makinari-rol-frontend", name: "makinari-rol-frontend", source: "system" },
      { id: "system:makinari-rol-qa", slug: "makinari-rol-qa", name: "makinari-rol-qa", source: "system" },
      { id: "system:website-seo", slug: "website-seo", name: "Website SEO", source: "system" },
      { id: "custom:other", slug: "custom", name: "Custom skill", source: "custom" },
    ] }) })
    render(<SystemSkillsCatalog onSectionsChange={onSectionsChange} />)
    await waitFor(() => expect(onSectionsChange).toHaveBeenLastCalledWith([
      { id: "current-skills", title: "Current skills" },
      { id: "current-skill-roles", title: "Roles", children: [
        { id: "system-skill-makinari-rol-frontend", title: "frontend" },
        { id: "system-skill-makinari-rol-qa", title: "qa" },
      ] },
      { id: "current-skill-other", title: "Other skills", children: [
        { id: "system-skill-website-seo", title: "Website SEO" },
      ] },
    ]))
    expect(document.getElementById("current-skill-roles")).toContainElement(document.getElementById("system-skill-makinari-rol-qa"))
    expect(document.getElementById("current-skill-other")).toContainElement(document.getElementById("system-skill-website-seo"))
    expect(document.getElementById("system-skill-makinari-rol-qa")).toHaveClass("scroll-mt-36")
    expect(within(screen.getByLabelText("Current Makinari skills")).queryByText("Custom skill")).not.toBeInTheDocument()
    const catalog = screen.getByLabelText("Current Makinari skills")
    const toolbar = within(catalog).getByRole("toolbar", { name: "Makinari skill search" })
    const input = within(toolbar).getByRole("textbox", { name: "Search Makinari skills" })
    const search = within(toolbar).getByRole("button", { name: "Search" })
    expect(search).toHaveAttribute("type", "submit")
    expect(search).toBeDisabled()
    fireEvent.change(input, { target: { value: "frontend" } })
    expect(document.getElementById("system-skill-makinari-rol-qa")).toBeInTheDocument()
    expect(search).toBeEnabled()
    fireEvent.click(search)
    await waitFor(() => expect(onSectionsChange).toHaveBeenLastCalledWith([
      { id: "current-skills", title: "Current skills" },
      { id: "current-skill-roles", title: "Roles", children: [
        { id: "system-skill-makinari-rol-frontend", title: "frontend" },
      ] },
    ]))
    expect(document.getElementById("system-skill-makinari-rol-qa")).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: "qa" } })
    fireEvent.submit(input.closest("form")!)
    await waitFor(() => expect(document.getElementById("system-skill-makinari-rol-qa")).toBeInTheDocument())
    expect(document.getElementById("system-skill-makinari-rol-frontend")).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: "" } })
    expect(search).toBeEnabled()
    fireEvent.click(search)
    await waitFor(() => expect(document.getElementById("system-skill-website-seo")).toBeInTheDocument())
    expect(document.getElementById("system-skill-makinari-rol-frontend")).toBeInTheDocument()
  })

  it("previews a community skill and imports exactly the reviewed SHA-256", async () => {
    const digest = "a".repeat(64)
    const url = "https://github.com/team/repo/blob/main/SKILL.md"
    global.fetch = jest.fn().mockImplementation(async (path: string) => ({
      ok: true,
      json: async () => path === "/api/skills/external/preview"
        ? { preview: { content: "---\nname: Test\n---\n# Instructions", sha256: digest } }
        : { success: true },
    }))
    render(<CommunitySkillsBrowser />)
    fireEvent.change(screen.getByLabelText("Community skill URL (HTTPS)"), { target: { value: url } })
    fireEvent.click(screen.getByRole("button", { name: "Preview" }))
    await waitFor(() => expect(screen.getByLabelText("Community skill preview")).toHaveTextContent("# Instructions"))
    fireEvent.change(screen.getByLabelText("Community skill URL (HTTPS)"), { target: { value: "https://github.com/team/other/blob/main/SKILL.md" } })
    expect(screen.queryByLabelText("Community skill preview")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Import reviewed skill" })).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Community skill URL (HTTPS)"), { target: { value: url } })
    fireEvent.click(screen.getByRole("button", { name: "Preview" }))
    await waitFor(() => expect(screen.getByLabelText("Community skill preview")).toHaveTextContent("# Instructions"))
    fireEvent.click(screen.getByRole("button", { name: "Import reviewed skill" }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/skills/external/import",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ site_id: "site-1", url, sha256: digest }) }),
    ))
  })

  it("places search outside the import card and keeps manual preview and import in its footer", async () => {
    render(<CommunitySkillsBrowser />)
    const browser = document.getElementById("community-skills")!
    const importCard = document.getElementById("community-import")!
    const search = within(browser).getByRole("button", { name: "Search" })
    const toolbar = within(browser).getByRole("toolbar", { name: "Community skill search" })
    const preview = within(importCard).getByRole("button", { name: "Preview" })
    const importButton = within(importCard).getByRole("button", { name: "Import reviewed skill" })
    const footer = preview.closest(".border-t")
    expect(footer).toBeInTheDocument()
    expect(footer).toContainElement(importButton)
    expect(browser).not.toContainElement(importCard)
    expect(search.closest(".rounded-xl")).not.toBeInTheDocument()
    expect(toolbar).toContainElement(search)
    expect(toolbar).toContainElement(within(browser).getByLabelText("Search community skills"))
    expect(search).toHaveAttribute("type", "submit")
    expect(search).toBeDisabled()
    expect(importButton).toBeDisabled()
    expect(document.getElementById("community-results")).toHaveAttribute("hidden")
    expect(screen.queryByText("Search results")).not.toBeInTheDocument()
    fireEvent.change(within(browser).getByLabelText("Search community skills"), { target: { value: "email" } })
    expect(search).toBeEnabled()
    fireEvent.submit(search.closest("form")!)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/skills/external?site_id=site-1&query=email", expect.anything(),
    ))
    expect(screen.getByText("No community skills found for this search.")).toBeInTheDocument()
    expect(document.getElementById("community-results")).not.toHaveAttribute("hidden")
    expect(document.getElementById("community-results")!.nextElementSibling).toBe(importCard)
  })

  it("numbers each search result and adds only the result whose SHA-256 was previewed", async () => {
    const firstUrl = "https://github.com/team/first/blob/main/SKILL.md"
    const secondUrl = "https://github.com/team/second/blob/main/SKILL.md"
    const firstSha = "a".repeat(64)
    const secondSha = "b".repeat(64)
    global.fetch = jest.fn().mockImplementation(async (path: string, init?: RequestInit) => ({
      ok: true,
      json: async () => path.startsWith("/api/skills/external?")
        ? { results: [
          { name: "First skill", description: "First description", url: firstUrl, repository: "team/first", stars: 1234, forks: 32 },
          { name: "Second skill", description: "Second description", url: secondUrl },
        ] }
        : path === "/api/skills/external/preview"
          ? { preview: {
            content: JSON.parse(init!.body as string).url === firstUrl ? "# First instructions" : "# Second instructions",
            sha256: JSON.parse(init!.body as string).url === firstUrl ? firstSha : secondSha,
          } }
          : { success: true },
    }))
    render(<CommunitySkillsBrowser />)
    fireEvent.change(screen.getByLabelText("Search community skills"), { target: { value: "skill" } })
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    const results = await screen.findByLabelText("Community search results")
    await waitFor(() => expect(results.querySelectorAll(".rounded-xl")).toHaveLength(2))
    const cards = results.querySelectorAll(".rounded-xl")
    expect(cards).toHaveLength(2)
    const first = cards[0] as HTMLElement
    const second = cards[1] as HTMLElement
    expect(within(first).getByText("1. First skill")).toBeInTheDocument()
    expect(within(second).getByText("2. Second skill")).toBeInTheDocument()
    expect(within(first).getByText("First description")).toBeInTheDocument()
    expect(within(first).getByText("team/first")).toBeInTheDocument()
    const firstTitle = within(first).getByRole("heading", { level: 3 })
    expect(firstTitle).toContainElement(within(first).getByLabelText("Repository popularity"))
    expect(firstTitle).toHaveTextContent("1,234 stars")
    expect(firstTitle).toHaveTextContent("32 forks")
    expect(within(second).queryByLabelText("Repository popularity")).not.toBeInTheDocument()
    expect(document.getElementById("community-skills")!.nextElementSibling).toBe(results)
    expect(results.nextElementSibling).toBe(document.getElementById("community-import"))
    expect(within(first).getByRole("button", { name: "Add" })).toBeDisabled()
    expect(within(second).getByRole("button", { name: "Add" })).toBeDisabled()
    fireEvent.click(within(first).getByRole("button", { name: "Preview" }))
    await waitFor(() => expect(within(first).getByLabelText("Preview of First skill")).toHaveTextContent("# First instructions"))
    expect(within(first).getByRole("button", { name: "Add" })).toBeEnabled()
    expect(within(second).getByRole("button", { name: "Add" })).toBeDisabled()
    fireEvent.click(within(first).getByRole("button", { name: "Add" }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/skills/external/import",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ site_id: "site-1", url: firstUrl, sha256: firstSha }) }),
    ))
    await waitFor(() => expect(within(first).queryByLabelText("Preview of First skill")).not.toBeInTheDocument())
    expect(within(first).getByRole("button", { name: "Add" })).toBeDisabled()
    await waitFor(() => expect(within(second).getByRole("button", { name: "Preview" })).toBeEnabled())
    fireEvent.click(within(second).getByRole("button", { name: "Preview" }))
    await waitFor(() => expect(within(second).getByLabelText("Preview of Second skill")).toHaveTextContent("# Second instructions"))
    fireEvent.click(within(second).getByRole("button", { name: "Add" }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/skills/external/import",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ site_id: "site-1", url: secondUrl, sha256: secondSha }) }),
    ))
  })

  it("shows zero popularity counts but hides invalid metrics", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [
      { name: "Zero", url: "https://github.com/team/zero/blob/main/SKILL.md", stars: 0, forks: 0 },
      { name: "Unknown", url: "https://github.com/team/unknown/blob/main/SKILL.md", stars: -2, forks: "many" },
    ] }) })
    render(<CommunitySkillsBrowser />)
    fireEvent.change(screen.getByLabelText("Search community skills"), { target: { value: "skill" } })
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    const results = screen.getByLabelText("Community search results")
    await waitFor(() => expect(within(results).getByText("2. Unknown")).toBeInTheDocument())
    const zero = within(results).getByText("1. Zero").closest(".rounded-xl") as HTMLElement
    const unknown = within(results).getByText("2. Unknown").closest(".rounded-xl") as HTMLElement
    const zeroTitle = within(zero).getByRole("heading", { level: 3 })
    expect(zeroTitle).toContainElement(within(zero).getByLabelText("Repository popularity"))
    expect(zeroTitle).toHaveTextContent("0 stars")
    expect(zeroTitle).toHaveTextContent("0 forks")
    expect(within(unknown).queryByLabelText("Repository popularity")).not.toBeInTheDocument()
  })

  it("clears an old result preview when searching again", async () => {
    const url = "https://github.com/team/repo/blob/main/SKILL.md"
    global.fetch = jest.fn().mockImplementation(async (path: string) => ({
      ok: true,
      json: async () => path === "/api/skills/external/preview"
        ? { preview: { content: "# Instructions", sha256: "a".repeat(64) } }
        : { results: [{ name: "Skill", url }] },
    }))
    render(<CommunitySkillsBrowser />)
    fireEvent.change(screen.getByLabelText("Search community skills"), { target: { value: "one" } })
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    const results = await screen.findByLabelText("Community search results")
    await waitFor(() => expect(within(results).getByText("1. Skill")).toBeInTheDocument())
    const resultCard = () => within(results).getByText("1. Skill").closest(".rounded-xl") as HTMLElement
    fireEvent.click(within(resultCard()).getByRole("button", { name: "Preview" }))
    await waitFor(() => expect(within(resultCard()).getByRole("button", { name: "Add" })).toBeEnabled())
    fireEvent.change(screen.getByLabelText("Search community skills"), { target: { value: "two" } })
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    await waitFor(() => expect(within(resultCard()).queryByLabelText("Preview of Skill")).not.toBeInTheDocument())
    expect(within(resultCard()).getByRole("button", { name: "Add" })).toBeDisabled()
  })
})
