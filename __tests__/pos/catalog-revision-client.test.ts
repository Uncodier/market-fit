import { fetchPosCatalogRevision, CATALOG_REVISION_WAIT_MS } from "@/app/pos/catalog-revision-client";

const response = (body: unknown = { data: "revision" }, ok = true) => ({ ok,
  headers: { get: () => "application/json" }, json: async () => body }) as unknown as Response;
beforeEach(() => { jest.useFakeTimers(); jest.mocked(fetch).mockReset().mockResolvedValue(response()); });
afterEach(() => jest.useRealTimers());

it("uses a fixed same-origin read with an encoded site and private no-store transport", async () => {
  expect(await fetchPosCatalogRevision("site/one")).toEqual({ data: "revision" });
  expect(fetch).toHaveBeenCalledWith("/api/pos/catalog-revision?siteId=site%2Fone", expect.objectContaining({
    method: "GET", credentials: "same-origin", mode: "same-origin", redirect: "error", cache: "no-store",
  }));
});

it("deduplicates same-site reads but lets another site proceed", async () => {
  let finish!: (value: Response) => void;
  jest.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const first = fetchPosCatalogRevision("site-one");
  expect(fetchPosCatalogRevision("site-one")).toBe(first);
  expect(await fetchPosCatalogRevision("site-two")).toEqual({ data: "revision" });
  finish(response());
  await first;
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("bounds the entire read including JSON parsing and discards late completion", async () => {
  let finish!: (value: unknown) => void;
  jest.mocked(fetch).mockResolvedValueOnce({ ...response(), json: () => new Promise((resolve) => { finish = resolve; }) } as Response);
  const first = fetchPosCatalogRevision("slow-site");
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await jest.advanceTimersByTimeAsync(CATALOG_REVISION_WAIT_MS);
  expect(await first).toEqual({ error: "Catalog revision check timed out" });
  expect(jest.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(await fetchPosCatalogRevision("slow-site")).toEqual({ data: "revision" });
  finish({ data: "late-obsolete-revision" });
  await Promise.resolve();
});

it.each([{ data: "" }, { data: 123 }, { error: "private detail" }, null])("rejects malformed or error responses without private detail (%p)", async (body) => {
  jest.mocked(fetch).mockResolvedValueOnce(response(body));
  expect(await fetchPosCatalogRevision("site")).toEqual({ error: "Unable to check the catalog revision" });
});

it("does not accept revision data on a failed HTTP response", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response({ data: "unauthorized" }, false));
  expect(await fetchPosCatalogRevision("site")).toEqual({ error: "Unable to check the catalog revision" });
});