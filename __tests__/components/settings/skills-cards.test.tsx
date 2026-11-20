import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { SkillManager } from "@/app/components/settings/SkillManager"
import { SkillDialog, type SkillDialogAction } from "@/app/components/settings/SkillDialog"
import { SystemSkillsCatalog } from "@/app/components/settings/SystemSkillsCatalog"
import { CommunitySkillsBrowser } from "@/app/components/settings/CommunitySkillsBrowser"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-1" } }) }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const originalFetch = global.fetch

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, skills: [] }) })
})
afterAll(() => { global.fetch = originalFetch })

function DialogHarness({ initialAction = { type: "add" } }: { initialAction?: SkillDialogAction }) {
  const [action, setAction] = useState<SkillDialogAction | null>(initialAction)
  return <SkillDialog action={action} siteId="site-1" onActionChange={setAction} onSaved={jest.fn()} />
}

function CommunityHarness() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [action, setAction] = useState<SkillDialogAction | null>(null)
  return <>
    <header data-testid="skills-search-header" ref={setTarget} />
    <CommunitySkillsBrowser searchTarget={target} onImport={url => setAction({ type: "import", url })} />
    <SkillDialog action={action} siteId="site-1" onActionChange={setAction} onSaved={jest.fn()} />
  </>
}

describe("Skills cards", () => {
  it("shows an empty list without an inline editor when the site has no administrable skills", async () => {
    let resolve!: (response: Response) => void
    jest.mocked(global.fetch).mockReturnValueOnce(new Promise(done => { resolve = done }))
    render(<SkillManager onEdit={jest.fn()} />)
    const loading = screen.getByRole("status", { name: "Loading your skills" })
    expect(loading.querySelectorAll('[data-skeleton-shape="skill-managed"]')).toHaveLength(2)
    expect(within(loading).queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByText(/No administrable skills yet/)).not.toBeInTheDocument()
    await act(async () => resolve({ ok: true, json: async () => ({ skills: [] }) } as Response))
    expect(screen.getByText(/No administrable skills yet/)).toBeVisible()
    expect(loading).not.toBeInTheDocument()
    expect(document.getElementById("site-skills")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Skill Markdown")).not.toBeInTheDocument()
  })

  it("uploads pasted Markdown from the dialog and closes it on success", async () => {
    render(<DialogHarness />)
    const editor = screen.getByRole("dialog", { name: "Add skill" })
    const submit = within(editor).getByRole("button", { name: "Upload skill" })
    expect(submit.closest(".border-t")).toBeInTheDocument()
    fireEvent.change(within(editor).getByLabelText("Skill Markdown"), { target: { value: "---\nname: Test\n---\n# Instructions" } })
    await waitFor(() => expect(submit).toBeEnabled())
    fireEvent.click(submit)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/skills", expect.objectContaining({ method: "POST" })))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("opens the editor from a managed skill and reloads the list after saving", async () => {
    const initialContent = "---\nname: My skill\n---\n# Original"
    const updatedContent = "---\nname: Updated skill\n---\n# Updated"
    let skill = { id: "custom-1", slug: "my-skill", name: "My skill", content: initialContent }
    global.fetch = jest.fn().mockImplementation(async (_path: string, init?: RequestInit) => {
      if (init?.method === "PATCH") skill = { ...skill, name: "Updated skill", content: updatedContent }
      return { ok: true, json: async () => ({ skills: [skill] }) }
    })
    function ManageHarness() {
      const [action, setAction] = useState<SkillDialogAction | null>(null)
      const [revision, setRevision] = useState(0)
      return <>
        <SkillManager onEdit={skill => setAction({ type: "edit", skill })} revision={revision} />
        <SkillDialog action={action} siteId="site-1" onActionChange={setAction} onSaved={() => setRevision(current => current + 1)} />
      </>
    }
    render(<ManageHarness />)
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }))
    const dialog = within(screen.getByRole("dialog", { name: "Edit skill" }))
    const markdown = dialog.getByLabelText("Skill Markdown")
    expect(markdown).toHaveValue(initialContent)
    fireEvent.change(markdown, { target: { value: updatedContent } })
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }))
    expect(await screen.findByRole("heading", { name: "Updated skill" })).toBeVisible()
    expect(global.fetch).toHaveBeenCalledWith("/api/skills/custom-1", expect.objectContaining({
      method: "PATCH", body: JSON.stringify({ site_id: "site-1", content: updatedContent }),
    }))
  })

  it("selects a Markdown file from the footer for review before uploading", async () => {
    render(<DialogHarness />)
    const editor = screen.getByRole("dialog", { name: "Add skill" })
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
    render(<DialogHarness />)
    const editor = screen.getByRole("dialog", { name: "Add skill" })
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
    render(<><SkillManager onEdit={jest.fn()} /><SystemSkillsCatalog /></>)
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
    render(<SkillManager onEdit={jest.fn()} />)
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
      render(<SkillManager onEdit={jest.fn()} />)
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
    function CatalogHarness() {
      const [target, setTarget] = useState<HTMLElement | null>(null)
      return <><header data-testid="skills-search-header" ref={setTarget} />
        <SystemSkillsCatalog onSectionsChange={onSectionsChange} searchTarget={target} />
      </>
    }
    render(<CatalogHarness />)
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
    const toolbar = within(screen.getByTestId("skills-search-header")).getByRole("search", { name: "Search Makinari skills" })
    expect(catalog).not.toContainElement(toolbar)
    const input = within(toolbar).getByRole("textbox", { name: "Search Makinari skills" })
    expect(toolbar.querySelector('button[type="submit"]')).toBeNull()
    fireEvent.change(input, { target: { value: "frontend" } })
    await waitFor(() => expect(onSectionsChange).toHaveBeenLastCalledWith([
      { id: "current-skills", title: "Current skills" },
      { id: "current-skill-roles", title: "Roles", children: [
        { id: "system-skill-makinari-rol-frontend", title: "frontend" },
      ] },
    ]))
    expect(document.getElementById("system-skill-makinari-rol-qa")).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: "qa" } })
    await waitFor(() => expect(document.getElementById("system-skill-makinari-rol-qa")).toBeInTheDocument())
    expect(document.getElementById("system-skill-makinari-rol-frontend")).not.toBeInTheDocument()
    fireEvent.click(within(toolbar).getByRole("button", { name: "Clear search" }))
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
    render(<DialogHarness />)
    fireEvent.click(screen.getByRole("button", { name: "Import from URL" }))
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

  it("loads discovery with the compact widget closed and searches on submit", async () => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({ results: [] }) } as Response)
    render(<CommunityHarness />)
    const browser = document.getElementById("community-skills")!
    const toolbar = within(screen.getByTestId("skills-search-header")).getByRole("search", { name: "Search community skills" })
    expect(browser).not.toContainElement(toolbar)
    expect(toolbar.querySelector('button[type="submit"]')).toBeNull()
    const input = within(toolbar).getByRole("textbox", { name: "Search community skills" })
    const expand = within(toolbar).getByRole("button", { name: "Search community skills" })
    expect(expand.parentElement).toHaveClass("opacity-100")
    expect(input.closest(".pointer-events-none")).not.toBeNull()
    fireEvent.click(expand)
    expect(input.closest(".pointer-events-none")).toBeNull()
    expect(input).toHaveAttribute("enterkeyhint", "search")
    expect(input).toHaveAttribute("maxlength", "100")
    fireEvent.submit(toolbar)
    expect(screen.queryByLabelText("Community skill URL (HTTPS)")).not.toBeInTheDocument()
    const loading = screen.getByRole("status", { name: "Loading community skills" })
    expect(loading.querySelectorAll('[data-skeleton-shape="skill-community"]')).toHaveLength(2)
    expect(await screen.findByRole("heading", { name: "Discover community skills" })).toBeVisible()
    expect(loading).not.toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith("/api/skills/external?site_id=site-1&query=skills", expect.anything())
    fireEvent.change(input, { target: { value: "email" } })
    expect(global.fetch).toHaveBeenCalledTimes(1)
    fireEvent.submit(toolbar)
    expect(screen.getByRole("status", { name: "Loading community skills" })).toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/skills/external?site_id=site-1&query=email", expect.anything(),
    ))
    expect(await screen.findByText("No community skills found for this search.")).toBeVisible()
    expect(document.getElementById("community-results")).not.toHaveAttribute("hidden")
    fireEvent.click(within(toolbar).getByRole("button", { name: "Clear search" }))
    expect(await screen.findByRole("heading", { name: "Discover community skills" })).toBeVisible()
  })

  it("shows discovery failures and retries the real catalog request", async () => {
    jest.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "GitHub search unavailable" }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [
        { name: "Writing skill", url: "https://github.com/team/writing/blob/main/SKILL.md" },
      ] }) } as Response)
    render(<CommunityHarness />)
    expect(await screen.findByRole("alert")).toHaveTextContent("GitHub search unavailable")
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByRole("heading", { name: "1. Writing skill" })).toBeVisible()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
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
    render(<CommunityHarness />)
    fireEvent.change(screen.getByRole("textbox", { name: "Search community skills" }), { target: { value: "skill" } })
    fireEvent.submit(screen.getByRole("search", { name: "Search community skills" }))
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
    fireEvent.click(within(second).getByRole("button", { name: "Review and import" }))
    const dialog = within(screen.getByRole("dialog", { name: "Import skill" }))
    expect(dialog.getByLabelText("Community skill URL (HTTPS)")).toHaveValue(secondUrl)
    const submit = dialog.getByRole("button", { name: "Import reviewed skill" })
    expect(submit).toBeDisabled()
    fireEvent.click(dialog.getByRole("button", { name: "Preview" }))
    expect(await dialog.findByLabelText("Community skill preview")).toHaveTextContent("# Second instructions")
    fireEvent.click(submit)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/skills/external/import",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ site_id: "site-1", url: secondUrl, sha256: secondSha }) }),
    ))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    fireEvent.click(within(first).getByRole("button", { name: "Review and import" }))
    expect(screen.getByLabelText("Community skill URL (HTTPS)")).toHaveValue(firstUrl)
    expect(screen.queryByLabelText("Community skill preview")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Import reviewed skill" })).toBeDisabled()
  })

  it("shows zero popularity counts but hides invalid metrics", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [
      { name: "Zero", url: "https://github.com/team/zero/blob/main/SKILL.md", stars: 0, forks: 0 },
      { name: "Unknown", url: "https://github.com/team/unknown/blob/main/SKILL.md", stars: -2, forks: "many" },
    ] }) })
    render(<CommunityHarness />)
    fireEvent.change(screen.getByRole("textbox", { name: "Search community skills" }), { target: { value: "skill" } })
    fireEvent.submit(screen.getByRole("search", { name: "Search community skills" }))
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

})
