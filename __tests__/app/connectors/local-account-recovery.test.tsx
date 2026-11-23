import { fireEvent, render, screen } from "@testing-library/react"
import { useSearchParams } from "next/navigation"
import { DetailContent } from "@/app/connectors/connector-detail"
import { CatalogContent } from "@/app/connectors/connector-catalog"
import { access, connector, jsonResponse, translate } from "./fixtures"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header> }))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => false }))
const http = jest.mocked(fetch)
const local = { ...connector, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }

function offline(canManage: boolean, selected?: string, wrongReceipt = false, legacyAccessUnavailable = false, pendingSetup = false, unified = false) {
  let revision = local.revision
  let directRevision = 7
  let reads = true
  let direct = !pendingSetup
  let hostAllowed = true
  let setup = pendingSetup
  const attested = !pendingSetup
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(selected ? { connector: selected } : {}) as ReturnType<typeof useSearchParams>)
  http.mockImplementation(async (input, init) => {
    const path = String(input)
    if (path.startsWith("/api/connectors/catalog")) return jsonResponse({ error: { code: "PROVIDER_UNAVAILABLE" } }, 503)
    if (path === "/api/connectors/connections?site_id=site-1") return jsonResponse({ can_manage: canManage, items: [{ ...local, enabled: true, revision }] })
    if (path === `/api/connectors/connections/${local.id}/provider-direct?site_id=site-1`) {
      return jsonResponse({ connector_id: local.id, revision, direct_revision: directRevision, attested, enabled: direct, setup_pending: setup,
        ...(unified && { authorization_mode: "host_policy", assistant_allowed: hostAllowed }) })
    }
    if (path === `/api/connectors/connections/${local.id}/provider-direct` && init?.method === "PATCH") {
      expect(JSON.parse(String(init.body))).toEqual({ site_id: "site-1", expected_revision: revision, expected_direct_revision: directRevision, enabled: false })
      direct = false
      setup = false
      if (unified) { hostAllowed = false; revision++ }
      return jsonResponse({ connector_id: local.id, revision, direct_revision: ++directRevision, attested, enabled: direct, setup_pending: setup,
        ...(unified && { authorization_mode: "host_policy", assistant_allowed: hostAllowed }) })
    }
    if (path === `/api/connectors/connections/${local.id}/access?site_id=site-1`) return legacyAccessUnavailable
      ? jsonResponse({ error: { code: "STORAGE_UNAVAILABLE" } }, 503) : jsonResponse({ ...access,
      connector_id: local.id, revision, can_manage: canManage, policy: { ...access.policy, catalog_reads: reads } })
    if (path === `/api/connectors/connections/${local.id}/policy` && init?.method === "PATCH") {
      expect(JSON.parse(String(init.body))).toEqual({ site_id: "site-1", expected_revision: revision, catalog_reads: false })
      if (wrongReceipt) return jsonResponse({ connector_id: "other", revision: revision + 1 })
      reads = false
      return jsonResponse({ connector_id: local.id, revision: ++revision })
    }
    throw new Error(`Unexpected local path: ${path}`)
  })
}

beforeEach(() => http.mockReset())
test.each(["detail", "catalog"])("cold %s page can revoke and confirm the setting with Composio offline", async page => {
  offline(true, page === "detail" ? local.id : undefined)
  render(page === "detail" ? <DetailContent siteId="site-1" slug="mail" /> : <CatalogContent siteId="site-1" />)
  fireEvent.click(await screen.findByRole("button", { name: "Turn off catalogue reads" }))
  expect(await screen.findByText("Catalogue reads are off for this account.")).toBeVisible()
  expect(http.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1)
  expect(http.mock.calls.filter(([url]) => String(url).startsWith("/api/connectors/catalog"))).toHaveLength(1)
})

test.each(["detail", "catalog"])("cold %s page revokes direct access even if both metadata and old policy reads are unavailable", async page => {
  offline(true, page === "detail" ? local.id : undefined, false, true)
  render(page === "detail" ? <DetailContent siteId="site-1" slug="mail" /> : <CatalogContent siteId="site-1" />)
  const revoke = await screen.findByRole("button", { name: "Turn off Ask access" })
  expect(screen.getByText("Ask access is on")).toBeVisible()
  fireEvent.click(revoke)
  expect(await screen.findByText("Off")).toBeVisible()
  expect(screen.queryByRole("button", { name: "Turn on Ask access" })).not.toBeInTheDocument()
  const writes = http.mock.calls.filter(([, init]) => init?.method === "PATCH")
  expect(writes.map(([url]) => url)).toEqual([`/api/connectors/connections/${local.id}/provider-direct`])
  expect(http.mock.calls.filter(([url]) => String(url).startsWith("/api/connectors/catalog"))).toHaveLength(1)
})

test("cancels automatic first setup locally with no proof or provider catalogue", async () => {
  offline(true, local.id, false, true, true)
  render(<DetailContent siteId="site-1" slug="mail" />)
  fireEvent.click(await screen.findByRole("button", { name: "Cancel automatic setup" }))
  expect(await screen.findByText("Off · not verified")).toBeVisible()
  expect(screen.queryByRole("button", { name: "Turn on Ask access" })).not.toBeInTheDocument()
  expect(http.mock.calls.filter(([, init]) => init?.method === "PATCH").map(([url]) => url)).toEqual([`/api/connectors/connections/${local.id}/provider-direct`])
})

test("offline stop updates the single host setting and reloads the incremented account revision", async () => {
  offline(true, local.id, false, true, false, true)
  render(<DetailContent siteId="site-1" slug="mail" />)
  fireEvent.click(await screen.findByRole("button", { name: "Turn off Ask access" }))
  expect(await screen.findByText("Ask is off")).toBeVisible()
  expect(screen.queryByRole("button", { name: "Turn off Ask access" })).not.toBeInTheDocument()
  expect(http.mock.calls.filter(([url]) => url === "/api/connectors/connections?site_id=site-1")).toHaveLength(2)
  expect(http.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1)
})

test("the local fallback does not request direct status for a nonmanager", async () => {
  offline(false, local.id)
  render(<DetailContent siteId="site-1" slug="mail" />)
  await screen.findByRole("alert")
  expect(http.mock.calls.some(([url]) => String(url).includes("/provider-direct"))).toBe(false)
  expect(screen.queryByRole("button", { name: "Turn off Ask access" })).not.toBeInTheDocument()
})

test("a hidden or foreign deep link never falls back to a visible account", async () => {
  offline(true, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
  render(<DetailContent siteId="site-1" slug="mail" />)
  expect(await screen.findByText(/There are no accounts available/)).toBeVisible()
  expect(screen.queryByText(local.display_name)).not.toBeInTheDocument()
  expect(http.mock.calls.some(([url]) => String(url).includes("/access?"))).toBe(false)
  expect(http.mock.calls.some(([url]) => String(url).includes("/provider-direct"))).toBe(false)
})

test("a failed revision receipt never displays a successful revocation", async () => {
  offline(true, local.id, true)
  render(<DetailContent siteId="site-1" slug="mail" />)
  fireEvent.click(await screen.findByRole("button", { name: "Turn off catalogue reads" }))
  expect(await screen.findByText(translate("connectors.errors.unknown"))).toBeVisible()
  expect(screen.queryByText("Catalogue reads are off for this account.")).not.toBeInTheDocument()
})