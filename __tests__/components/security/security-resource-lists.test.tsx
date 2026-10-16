import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { ApiKey } from "@/lib/api-keys"
import type { AllowedDomain } from "@/app/types/domains"
import { ApiKeysList } from "@/app/components/api-keys/api-keys-list"
import { AllowedDomainsList } from "@/app/components/security/allowed-domains-list"

let mockSite: { id: string } | null = { id: "site" }
const mockListKeys = jest.fn()
const mockRevokeKey = jest.fn()
const mockDeleteDomain = jest.fn()
let mockDomains: AllowedDomain[] = []

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: mockSite }) }))
jest.mock("@/lib/api-keys", () => ({
  listApiKeys: (...args: unknown[]) => mockListKeys(...args),
  revokeApiKey: (...args: unknown[]) => mockRevokeKey(...args),
}))
jest.mock("@/app/hooks/use-allowed-domains", () => ({
  useAllowedDomains: () => ({ domains: mockDomains, isLoading: false, isSubmitting: false,
    addDomain: jest.fn(), deleteDomain: mockDeleteDomain }),
}))
jest.mock("@/app/components/api-keys/create-key-dialog", () => ({
  CreateKeyDialog: ({ onSuccess }: { onSuccess: () => void }) => <button onClick={onSuccess}>Add API Key</button>,
}))
jest.mock("@/app/components/domains/add-domain-dialog", () => ({ AddDomainDialog: () => <button>Add Domain</button> }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

function key(id: string, created_at: string, issued_by?: string): ApiKey {
  return {
    id, name: id, prefix: "key", created_at, updated_at: created_at, site_id: "site", user_id: "user",
    key_hash: "", scopes: ["read"], status: "active", expires_at: "2027-01-01", last_used_at: null,
    metadata: issued_by ? { issued_by } : null,
  }
}

function domain(id: string, source?: AllowedDomain["source"]): AllowedDomain {
  return { id, domain: `${id}.example.com`, site_id: "site", created_at: "2026-10-16", updated_at: "2026-10-16", source }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSite = { id: "site" }
  mockDomains = []
  mockListKeys.mockResolvedValue([])
  mockRevokeKey.mockResolvedValue(undefined)
})

it("renders all user/legacy keys before automatic keys and publishes the same quick-navigation order", async () => {
  mockListKeys.mockResolvedValue([
    key("harness", "2026-10-16", "harness.requirement-provisioning"),
    key("user", "2026-10-01"), key("platform", "2026-10-15", "platform-api.ensure-platform-key"),
    key("legacy", "2026-10-02"),
  ])
  const events: { id: string; title: string }[][] = []
  const listener = (event: Event) => events.push((event as CustomEvent).detail)
  window.addEventListener("apiKeysUpdated", listener)
  try {
    const { container, rerender } = render(<ApiKeysList />)
    await screen.findByText("harness")
    const cards = Array.from(container.querySelectorAll('[id^="api-key-"]'))
    expect(cards.map(card => within(card as HTMLElement).getByRole("heading").textContent))
      .toEqual(["legacy", "user", "harness", "platform"])
    expect(screen.getByText("Harness")).toBeInTheDocument()
    expect(screen.getByText("Platform automation")).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { name: "Automatically created API keys" })).toHaveLength(1)
    expect(events.at(-1)).toEqual([
      { id: "api-key-0", title: "legacy" }, { id: "api-key-1", title: "user" },
      { id: "api-key-2", title: "harness" }, { id: "api-key-3", title: "platform" },
    ])
    fireEvent.click(screen.getByText("user"))
    fireEvent.click(screen.getByRole("button", { name: "Revoke Key" }))
    mockListKeys.mockResolvedValue([])
    fireEvent.click(screen.getAllByRole("button", { name: "Revoke Key" }).at(-1)!)
    await waitFor(() => expect(mockRevokeKey).toHaveBeenCalledWith("user", "site"))
    await waitFor(() => expect(events.at(-1)).toEqual([]))
    mockSite = { id: "other-site" }
    rerender(<ApiKeysList />)
    await waitFor(() => expect(mockListKeys).toHaveBeenLastCalledWith("other-site"))
  } finally {
    window.removeEventListener("apiKeysUpdated", listener)
  }
})

it("orders domains by explicit provenance, keeps unknown labels, and aligns navigation and deletion", async () => {
  mockDomains = [domain("harness", "harness"), domain("legacy"), domain("user", "user")]
  const events: { id: string; title: string }[][] = []
  const listener = (event: Event) => events.push((event as CustomEvent).detail)
  window.addEventListener("allowedDomainsUpdated", listener)
  try {
    const { container, rerender } = render(<AllowedDomainsList />)
    const cards = Array.from(container.querySelectorAll('[id^="allowed-domain-"]'))
    expect(cards.map(card => within(card as HTMLElement).getByRole("heading").textContent))
      .toEqual(["user.example.com", "legacy.example.com", "harness.example.com"])
    expect(screen.getByText("Unknown origin")).toBeInTheDocument()
    expect(screen.getByText("User-added")).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { name: "Automatically created domains" })).toHaveLength(1)
    expect(events.at(-1)).toEqual([
      { id: "allowed-domain-0", title: "user.example.com" },
      { id: "allowed-domain-1", title: "legacy.example.com" },
      { id: "allowed-domain-2", title: "harness.example.com" },
    ])
    fireEvent.click(within(cards[0] as HTMLElement).getByRole("button", { name: "Remove Domain" }))
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove Domain" }))
    expect(mockDeleteDomain).toHaveBeenCalledWith("user")
    mockDomains = []
    rerender(<AllowedDomainsList />)
    expect(events.at(-1)).toEqual([])
    expect(screen.queryByRole("heading", { name: "Automatically created domains" })).not.toBeInTheDocument()
  } finally {
    window.removeEventListener("allowedDomainsUpdated", listener)
  }
})

it("does not render an automatic section for manual-only lists", async () => {
  mockDomains = [domain("user", "user")]
  mockListKeys.mockResolvedValue([key("user-key", "2026-10-16")])
  render(<><ApiKeysList /><AllowedDomainsList /></>)
  await screen.findByText("user-key")
  expect(screen.queryByRole("heading", { name: /Automatically created/ })).not.toBeInTheDocument()
})

it("keeps a newly created manual key first and expands it instead of a newer harness key", async () => {
  mockListKeys.mockResolvedValue([key("harness", "2026-10-17", "harness.requirement-provisioning")])
  const { container } = render(<ApiKeysList />)
  await screen.findByText("harness")
  mockListKeys.mockResolvedValue([
    key("harness", "2026-10-17", "harness.requirement-provisioning"), key("new-manual", "2026-10-16"),
  ])
  fireEvent.click(screen.getByRole("button", { name: "Add API Key" }))
  await screen.findByRole("heading", { name: "new-manual" })
  const cards = Array.from(container.querySelectorAll('[id^="api-key-"]'))
  expect(within(cards[0] as HTMLElement).getByRole("heading", { level: 3 })).toHaveTextContent("new-manual")
  expect(within(cards[0] as HTMLElement).getByText("Keep your API key secure")).toBeInTheDocument()
  expect(within(cards[1] as HTMLElement).queryByText("Keep your API key secure")).not.toBeInTheDocument()
  expect(mockListKeys).toHaveBeenCalledTimes(2)
})