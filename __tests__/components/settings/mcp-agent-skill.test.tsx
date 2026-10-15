import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { BasicInfoStep } from "@/app/components/onboarding/steps/basic-info-step"
import type { SiteOnboardingValues } from "@/app/components/onboarding/schemas/onboarding-schema"
import { SkillsSection } from "@/app/components/settings/SkillsSection"
import { McpAgentSkillSetup } from "@/app/components/skills/mcp-agent-skill-setup"
import { Form } from "@/app/components/ui/form"
import { useAuth } from "@/app/hooks/use-auth"
import { createApiKey } from "@/lib/api-keys"
import { createMakinariMcpSkill } from "@/lib/makinari-mcp-skill"
import { toast } from "sonner"

jest.mock("@/app/hooks/use-auth", () => ({ useAuth: jest.fn() }))
jest.mock("@/lib/api-keys", () => ({ createApiKey: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const authMock = jest.mocked(useAuth)
const keyMock = jest.mocked(createApiKey)
const credentials = { apiKey: "test-key-not-a-real-credential", userId: "test-user" }
const response = { apiKey: credentials.apiKey, id: "key-id", prefix: "test", expires_at: "2027-01-11T00:00:00Z" }
const createObjectURL = jest.fn((blob: Blob) => {
  expect(blob).toBeInstanceOf(Blob)
  return "blob:test-skill"
})
const revokeObjectURL = jest.fn()
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL
let download: jest.SpyInstance
let downloadedName: string

function OnboardingHarness() {
  const form = useForm<SiteOnboardingValues>({ defaultValues: { name: "", url: "", logo_url: "" } })
  return <Form {...form}><BasicInfoStep form={form} /></Form>
}

async function readDownloadedMarkdown(): Promise<string> {
  const blob = createObjectURL.mock.calls[0][0] as Blob
  expect(blob.type).toBe("text/markdown")
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  authMock.mockReturnValue({ user: { id: credentials.userId } } as ReturnType<typeof useAuth>)
  keyMock.mockResolvedValue(response)
  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = revokeObjectURL
  downloadedName = ""
  download = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloadedName = this.download
  })
})

afterEach(() => { download.mockRestore() })
afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
})

describe("MCP Agent Skills", () => {
  it("previews the shared skill without generating or exposing a live key", () => {
    render(<SkillsSection active />)
    expect(screen.getByText("Frontend Blog & SEO")).toBeVisible()
    expect(document.getElementById("makinari-mcp-preview")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Expand Makinari MCP" }))
    const preview = document.getElementById("makinari-mcp-preview")!
    expect(preview.textContent).toBe(createMakinariMcpSkill({ apiKey: "YOUR_API_KEY", userId: "YOUR_USER_ID", expirationDays: 90 }))
    expect(preview).not.toHaveTextContent(credentials.apiKey)
    expect(keyMock).not.toHaveBeenCalled()
    expect(screen.queryByText(/mcporter/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Collapse Makinari MCP" }))
    expect(preview).not.toBeInTheDocument()
  })

  it("keeps the section hidden when inactive", () => {
    render(<SkillsSection active={false} />)
    expect(screen.queryByText("Makinari MCP")).not.toBeInTheDocument()
    expect(keyMock).not.toHaveBeenCalled()
  })

  it.each([
    ["Cursor", "cursor"], ["Claude", "claude"], ["OpenAI", "codex"], ["Open Claw", "openclaw"], ["Hermes", "hermes"],
  ])("downloads the same skill for %s with a 90-day key", async (name, id) => {
    render(<SkillsSection active />)
    const card = document.getElementById("skill-makinari")!
    fireEvent.click(within(card).getByRole("button", { name: `Use ${name}` }))
    const dialog = screen.getByRole("dialog", { name: "Generate Agent Skill" })
    expect(dialog).toHaveTextContent("90 days")
    expect(keyMock).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole("button", { name: "Generate Key & Download Skill" }))

    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    expect(keyMock).toHaveBeenCalledWith({
      name: "Agent Skills MCP Key", scopes: ["create_project"], site_id: null, user_id: credentials.userId, expirationDays: 90,
    })
    expect(downloadedName).toBe(`makinari-setup-${id}.md`)
    expect(await readDownloadedMarkdown()).toBe(createMakinariMcpSkill({ ...credentials, expirationDays: 90 }))
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-skill")
    expect(document.querySelector('a[download]')).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("preserves the 24-hour create-site key and download", async () => {
    render(<OnboardingHarness />)
    fireEvent.click(screen.getByRole("button", { name: "Use Cursor" }))
    expect(screen.getByRole("dialog")).toHaveTextContent("24 hours")
    fireEvent.click(screen.getByRole("button", { name: "Generate Key & Download Skill" }))
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    expect(keyMock).toHaveBeenCalledWith({
      name: "Onboarding MCP Key", scopes: ["create_project"], site_id: null, user_id: credentials.userId, expirationDays: 1,
    })
    expect(await readDownloadedMarkdown()).toBe(createMakinariMcpSkill({ ...credentials, expirationDays: 1 }))
    expect(downloadedName).toBe("makinari-setup-cursor.md")
  })

  it("does not generate a key without an authenticated user", async () => {
    authMock.mockReturnValue({ user: null } as ReturnType<typeof useAuth>)
    render(<McpAgentSkillSetup expirationDays={90} />)
    fireEvent.click(screen.getByRole("button", { name: "Use Cursor" }))
    fireEvent.click(screen.getByRole("button", { name: "Generate Key & Download Skill" }))
    expect(toast.error).toHaveBeenCalledWith("You must be logged in to create an API key")
    expect(keyMock).not.toHaveBeenCalled()
    expect(download).not.toHaveBeenCalled()
  })

  it.each(["failure", "missing key"])("handles %s without downloading and permits an explicit retry", async (scenario) => {
    if (scenario === "failure") keyMock.mockRejectedValueOnce(new Error("Key creation failed"))
    else keyMock.mockResolvedValueOnce({ ...response, apiKey: "" })
    render(<McpAgentSkillSetup expirationDays={90} />)
    fireEvent.click(screen.getByRole("button", { name: "Use Cursor" }))
    fireEvent.click(screen.getByRole("button", { name: "Generate Key & Download Skill" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    expect(download).not.toHaveBeenCalled()
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(keyMock).toHaveBeenCalledTimes(1)
    const retry = screen.getByRole("button", { name: "Generate Key & Download Skill" })
    expect(retry).toBeEnabled()
    fireEvent.click(retry)
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    expect(keyMock).toHaveBeenCalledTimes(2)
  })

  it("blocks duplicate creation and closing the dialog while generating", async () => {
    let finish!: (value: typeof response) => void
    keyMock.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<McpAgentSkillSetup expirationDays={90} />)
    fireEvent.click(screen.getByRole("button", { name: "Use Cursor" }))
    fireEvent.click(screen.getByRole("button", { name: "Generate Key & Download Skill" }))
    const busyButton = screen.getByRole("button", { name: "Generating..." })
    expect(busyButton).toBeDisabled()
    fireEvent.click(busyButton)
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(keyMock).toHaveBeenCalledTimes(1)
    await act(async () => { finish(response) })
    expect(download).toHaveBeenCalledTimes(1)
  })
})