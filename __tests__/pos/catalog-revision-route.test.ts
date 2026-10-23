/** @jest-environment node */
import { GET } from "@/app/api/pos/catalog-revision/route";
import { requirePosSiteAccess } from "@/app/pos/actions/site-access";
import { getPosCatalogRevision } from "@/app/pos/actions/sync-revision";

jest.mock("@/app/pos/actions/site-access", () => ({ requirePosSiteAccess: jest.fn() }));
jest.mock("@/app/pos/actions/sync-revision", () => ({ getPosCatalogRevision: jest.fn() }));
const SITE = "11111111-1111-4111-8111-111111111111";
const request = (query = `siteId=${SITE}`) => new Request(`http://localhost/api/pos/catalog-revision?${query}`);

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(requirePosSiteAccess).mockResolvedValue({ supabase: {}, user: { id: "actor" }, role: "owner" } as never);
  jest.mocked(getPosCatalogRevision).mockResolvedValue({ data: "revision" });
});

it("uses the existing authenticated revision reader with no-store response", async () => {
  const result = await GET(request());
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ data: "revision" });
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(requirePosSiteAccess).toHaveBeenCalledWith(SITE);
  expect(getPosCatalogRevision).toHaveBeenCalledWith(SITE);
  expect(jest.mocked(requirePosSiteAccess).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(getPosCatalogRevision).mock.invocationCallOrder[0]);
});

it.each(["", "siteId=invalid", `siteId=${SITE}&siteId=${SITE}`, "siteId=demo-"])("rejects malformed scope %s before reading", async (query) => {
  expect((await GET(request(query))).status).toBe(400);
  expect(requirePosSiteAccess).not.toHaveBeenCalled();
  expect(getPosCatalogRevision).not.toHaveBeenCalled();
});

it.each([["Not authenticated", 401], ["Forbidden", 403], ["This operation requires unrestricted location access", 403]])("denies %s without leaking internal errors", async (error, status) => {
  jest.mocked(requirePosSiteAccess).mockResolvedValue({ error: String(error) });
  const result = await GET(request());
  expect(result.status).toBe(status);
  expect(await result.json()).toEqual({ error: "Catalog access unavailable" });
  expect(getPosCatalogRevision).not.toHaveBeenCalled();
});

it("authorizes demo scopes rather than treating their prefix as permission", async () => {
  jest.mocked(requirePosSiteAccess).mockResolvedValueOnce({ error: "Forbidden" });
  expect((await GET(request("siteId=demo-ecom-es-456"))).status).toBe(403);
  expect(getPosCatalogRevision).not.toHaveBeenCalled();
  expect((await GET(request("siteId=demo-ecom-es-456"))).status).toBe(200);
  expect(getPosCatalogRevision).toHaveBeenCalledWith("demo-ecom-es-456");
});

it.each([false, true])("returns a safe read failure for returned/thrown errors (%s)", async (throws) => {
  if (throws) jest.mocked(getPosCatalogRevision).mockRejectedValueOnce(new Error("private database detail"));
  else jest.mocked(getPosCatalogRevision).mockResolvedValueOnce({ error: "private database detail" });
  const result = await GET(request());
  expect(result.status).toBe(503);
  expect(await result.json()).toEqual({ error: "Unable to check the catalog revision" });
});