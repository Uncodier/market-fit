import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { SiteArchiveSection } from "@/app/components/settings/SiteArchiveSection"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { leaveArchivedSite, requestSiteArchive } from "@/lib/sites/archive-site-client"

jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: jest.fn() }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => null }))
jest.mock("@/lib/sites/archive-site-client", () => ({
  requestSiteArchive: jest.fn(),
  leaveArchivedSite: jest.fn(),
}))

const siteId = "11111111-1111-4111-8111-111111111111"
const ownerId = "22222222-2222-4222-8222-222222222222"
const site = { id: siteId, name: "Archive test workspace", user_id: ownerId }
const mockedSite = jest.mocked(useSite)
const mockedAuth = jest.mocked(useAuth)
const request = jest.mocked(requestSiteArchive)
const leave = jest.mocked(leaveArchivedSite)

function setSite(currentSite: Record<string, unknown> | null = site, isLoading = false) {
  mockedSite.mockReturnValue({ currentSite, isLoading } as unknown as ReturnType<typeof useSite>)
}

function setUser(id: string | null = ownerId, isLoading = false) {
  mockedAuth.mockReturnValue({ user: id ? { id } : null, isLoading } as ReturnType<typeof useAuth>)
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Archive site" }))
  return screen.getByRole("dialog", { name: "Archive site" })
}

function enterPassword(value = "test-only-password") {
  fireEvent.change(screen.getByLabelText("Account password"), { target: { value } })
}

beforeEach(() => {
  jest.clearAllMocks()
  request.mockReset()
  setSite()
  setUser()
})

describe("archive ownership", () => {
  it("shows the danger zone to the sites.user_id owner", () => {
    render(<SiteArchiveSection siteId={siteId} />)
    expect(screen.getByRole("heading", { name: "Danger Zone" })).toBeVisible()
    expect(screen.getByText(/data is preserved/)).toHaveTextContent(/URL and allowed domains are released/)
    expect(screen.getByText(/data is preserved/)).toHaveTextContent(/no self-service restore/)
  })

  it.each(["owner", "admin", "manager", "collaborator"])("hides from a non-owner even with the %s membership role", (role) => {
    setSite({ ...site, role })
    setUser("33333333-3333-4333-8333-333333333333")
    render(<SiteArchiveSection />)
    expect(screen.queryByRole("button", { name: "Archive site" })).not.toBeInTheDocument()
  })

  it.each(["signed-out", "auth-loading", "site-loading", "no-site", "no-owner"])("hides for %s", (state) => {
    if (state === "signed-out") setUser(null)
    if (state === "auth-loading") setUser(ownerId, true)
    if (state === "site-loading") setSite(site, true)
    if (state === "no-site") setSite(null)
    if (state === "no-owner") setSite({ ...site, user_id: undefined })
    render(<SiteArchiveSection />)
    expect(screen.queryByRole("button", { name: "Archive site" })).not.toBeInTheDocument()
  })

  it("does not expose archival when the settings site and current site differ", () => {
    render(<SiteArchiveSection siteId="33333333-3333-4333-8333-333333333333" />)
    expect(screen.queryByRole("button", { name: "Archive site" })).not.toBeInTheDocument()
  })
})

describe("archive password dialog", () => {
  it("requires a password and explains the consequences before submission", () => {
    render(<SiteArchiveSection />)
    const dialog = openDialog()
    expect(within(dialog).getByText(/Archive “Archive test workspace”/)).toBeVisible()
    expect(within(dialog).getByText(/URL and allowed domains/)).toBeVisible()
    expect(within(dialog).getByText(/does not cancel subscriptions or stop external workflows/)).toBeVisible()
    expect(screen.getByLabelText("Account password")).toHaveAttribute("type", "password")
    expect(within(dialog).getByRole("button", { name: "Archive site" })).toBeDisabled()
    fireEvent.submit(screen.getByLabelText("Account password").closest("form")!)
    expect(request).not.toHaveBeenCalled()
  })

  it.each(["Cancel", "Close", "Escape"])("clears the password on %s without sending a request", (action) => {
    render(<SiteArchiveSection />)
    openDialog()
    enterPassword()
    if (action === "Escape") fireEvent.keyDown(screen.getByLabelText("Account password"), { key: "Escape" })
    else fireEvent.click(screen.getByRole("button", { name: action }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    openDialog()
    expect(screen.getByLabelText("Account password")).toHaveValue("")
    expect(request).not.toHaveBeenCalled()
    expect(leave).not.toHaveBeenCalled()
  })

  it("blocks duplicate submissions and dismissals while the request is pending", async () => {
    let rejectRequest!: (reason: Error) => void
    request.mockImplementation(() => new Promise((_, reject) => { rejectRequest = reject }))
    const parentSubmit = jest.fn()
    render(<form onSubmit={parentSubmit}><SiteArchiveSection /></form>)
    openDialog()
    enterPassword()
    const form = screen.getByLabelText("Account password").closest("form")!

    act(() => {
      fireEvent.submit(form)
      fireEvent.submit(form)
    })

    expect(request).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "Archiving…" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(screen.getByLabelText("Account password")).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(screen.getByRole("dialog")).toBeVisible()
    expect(parentSubmit).not.toHaveBeenCalled()
    expect(leave).not.toHaveBeenCalled()

    await act(async () => rejectRequest(new Error("Incorrect password.")))
    expect(screen.getByRole("alert")).toHaveTextContent("Incorrect password.")
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled()
  })

  it("keeps API errors open for correction and only leaves after a successful retry", async () => {
    request.mockRejectedValueOnce(new Error("Incorrect password.")).mockResolvedValueOnce(undefined)
    render(<SiteArchiveSection />)
    const dialog = openDialog()
    enterPassword("wrong-test-password")
    fireEvent.click(within(dialog).getByRole("button", { name: "Archive site" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect password.")
    expect(screen.getByRole("dialog")).toBeVisible()
    expect(leave).not.toHaveBeenCalled()
    enterPassword("correct-test-password")
    fireEvent.click(within(dialog).getByRole("button", { name: "Archive site" }))

    await waitFor(() => expect(leave).toHaveBeenCalledWith(siteId))
    expect(request).toHaveBeenNthCalledWith(1, siteId, "wrong-test-password")
    expect(request).toHaveBeenNthCalledWith(2, siteId, "correct-test-password")
    expect(screen.queryByLabelText("Account password")).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Site archived" })).toBeDisabled()
  })

  it("never puts the password in browser storage or the surrounding settings form", async () => {
    const writes = jest.spyOn(Storage.prototype, "setItem")
    request.mockResolvedValueOnce(undefined)
    const { container } = render(<form data-testid="settings-form"><SiteArchiveSection /></form>)
    const dialog = openDialog()
    enterPassword()
    expect(container.querySelector('input[type="password"]')).toBeNull()
    expect(Array.from(new FormData(screen.getByTestId("settings-form") as HTMLFormElement).entries())).toEqual([])
    fireEvent.click(within(dialog).getByRole("button", { name: "Archive site" }))
    await waitFor(() => expect(leave).toHaveBeenCalledTimes(1))
    expect(writes).not.toHaveBeenCalled()
    writes.mockRestore()
  })

  it("clears both the password and the error when cancelling a failed request", async () => {
    request.mockRejectedValueOnce(new Error("Incorrect password."))
    render(<SiteArchiveSection />)
    const dialog = openDialog()
    enterPassword()
    fireEvent.click(within(dialog).getByRole("button", { name: "Archive site" }))
    await screen.findByRole("alert")
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    openDialog()
    expect(screen.getByLabelText("Account password")).toHaveValue("")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(leave).not.toHaveBeenCalled()
  })

  it("discards an open password dialog when the current site changes", () => {
    const { rerender } = render(<SiteArchiveSection />)
    openDialog()
    enterPassword()
    setSite({ ...site, id: "33333333-3333-4333-8333-333333333333" })
    rerender(<SiteArchiveSection />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    openDialog()
    expect(screen.getByLabelText("Account password")).toHaveValue("")
    expect(request).not.toHaveBeenCalled()
  })
})