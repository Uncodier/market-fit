import { z } from "zod"
import { catalogFilters, catalogQuery } from "@/app/connectors/catalog-state"
import { connectorErrorKey, connectorRequest, ConnectorRequestError, exactToolIds, safeAuthorizationUrl } from "@/app/connectors/connector-request"
import { catalogSchema } from "@/app/connectors/types"
import { catalog, jsonResponse } from "./fixtures"

const fetchMock = jest.mocked(fetch)
beforeEach(() => fetchMock.mockReset())

test("uses same-origin credentials and private no-store requests with DTO parsing", async () => {
  fetchMock.mockResolvedValue(jsonResponse(catalog))
  expect(await connectorRequest("/api/connectors/catalog?site_id=site-1", catalogSchema)).toEqual(catalog)
  expect(fetchMock).toHaveBeenCalledWith("/api/connectors/catalog?site_id=site-1", expect.objectContaining({ credentials: "same-origin", cache: "no-store", redirect: "error" }))
  await expect(connectorRequest("https://provider.example/catalog", catalogSchema)).rejects.toThrow("invalid_request")
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test("fails on malformed success and never displays raw provider errors", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }))
  await expect(connectorRequest("/api/connectors/catalog", catalogSchema)).rejects.toThrow("unavailable")
  fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "ACCESS_DENIED", message: "sensitive raw provider payload" } }, 403))
  try { await connectorRequest("/api/connectors/catalog", catalogSchema) } catch (error) {
    expect((error as Error).message).toBe("access_denied")
    expect(connectorErrorKey(error)).toBe("forbidden")
  }
})

test("lost mutation responses stay unknown without retry", async () => {
  fetchMock.mockRejectedValue(new Error("socket gone"))
  await expect(connectorRequest("/api/connectors/auth-attempts", z.object({}), { method: "POST", body: "{}" })).rejects.toThrow("outcome_unknown")
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test.each([[401, "unauthorized"], [403, "forbidden"], [404, "notFound"], [409, "conflict"], [410, "expired"]])("maps HTTP %s distinctly", (status, key) => {
  expect(connectorErrorKey(new ConnectorRequestError("error", status as number))).toBe(key)
})

test.each([
  ["PROVIDER_AUTH_FAILED", 502, "providerAuth"],
  ["STORAGE_UNAVAILABLE", 503, "storage"],
  ["API_NOT_CONFIGURED", 503, "apiUnavailable"],
  ["UPSTREAM_UNAVAILABLE", 502, "apiUnavailable"],
  ["PROVIDER_INVALID_RESPONSE", 502, "providerResponse"],
  ["SUPABASE_BIND_SCHEMA", 422, "supabaseBindSchema"],
  ["SUPABASE_BIND_ACCOUNT", 422, "supabaseBindAccount"],
  ["SUPABASE_BIND_READ", 422, "supabaseBindRead"],
  ["SUPABASE_BIND_IDENTITY", 422, "supabaseBindIdentity"],
])("explains %s without exposing upstream messages", async (code, status, expected) => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code, message: "private provider details" } }, status as number))
  try {
    await connectorRequest("/api/connectors/catalog", catalogSchema)
    throw new Error("Expected request rejection")
  } catch (error) {
    expect(error).toBeInstanceOf(ConnectorRequestError)
    expect(connectorErrorKey(error)).toBe(expected)
    expect((error as Error).message).not.toContain("private")
  }
})

test("exact tool policy is deny-by-default and rejects wildcards, URLs and arbitrary text", () => {
  expect(exactToolIds("")).toEqual([])
  expect(exactToolIds("MAIL_SEND,MAIL_READ\nMAIL_SEND")).toEqual(["MAIL_SEND", "MAIL_READ"])
  for (const text of ["*", "MAIL_*", "https://provider.test", "send an email", Array.from({ length: 101 }, (_, i) => `TOOL_${i}`).join(",")]) expect(exactToolIds(text)).toBeNull()
})

test("sanitizes URL filters and preserves their intersection through pagination", () => {
  const filters = catalogFilters(new URLSearchParams("tab=connected&q=mail&category=messaging&cursor=next"))
  expect(catalogQuery(filters).toString()).toBe("tab=connected&q=mail&category=messaging&cursor=next")
  expect(catalogFilters(new URLSearchParams("tab=shared&category=../../other&q=" + "a".repeat(300)))).toEqual({ tab: "all", category: "", cursor: "", page: 1, q: "a".repeat(200) })
})

test("authorization navigation excludes active schemes, credentials and insecure URLs", () => {
  expect(safeAuthorizationUrl("https://connect.example.test/authorize?a=1")).toBe("https://connect.example.test/authorize?a=1")
  for (const url of ["javascript:alert(1)", "http://connect.test", "//connect.test", "https://user:pass@connect.test"]) expect(safeAuthorizationUrl(url)).toBeNull()
})