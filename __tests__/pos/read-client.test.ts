/** @jest-environment node */
import { fetchPosCatalogSnapshot, fetchPosOpenOrders, POS_CATALOG_READ_WAIT_MS, POS_OPEN_ORDERS_READ_WAIT_MS } from "@/app/pos/read-client";
import { READ_SITE, catalogReadFixture, ordersReadFixture } from "./read-fixtures";

const fetchMock = jest.fn();
beforeEach(() => { jest.useFakeTimers(); fetchMock.mockReset(); global.fetch = fetchMock; });
afterEach(() => { jest.useRealTimers(); });

describe.each([
  ["catalog", fetchPosCatalogSnapshot, catalogReadFixture, POS_CATALOG_READ_WAIT_MS],
  ["orders", fetchPosOpenOrders, ordersReadFixture, POS_OPEN_ORDERS_READ_WAIT_MS],
] as const)("POS %s read client", (_name, read, fixture, waitMs) => {
  it("uses independent same-origin no-store GET without Server Action dispatch", async () => {
    fetchMock.mockImplementation(async () => Response.json({ data: fixture() }));
    expect(await read(READ_SITE)).toEqual({ data: fixture() });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/pos\//), expect.objectContaining({
      method: "GET", credentials: "same-origin", mode: "same-origin", cache: "no-store", redirect: "error", signal: expect.any(AbortSignal),
    }));
  });
  it.each([401, 403, 500])("fails closed on HTTP %s even with a valid-looking body", async (status) => {
    fetchMock.mockResolvedValue(Response.json({ data: fixture() }, { status }));
    expect(await read(READ_SITE)).toHaveProperty("error");
  });
  it.each([null, {}, { data: {} }, { error: "private" }])("rejects malformed envelope %j", async (body) => {
    fetchMock.mockResolvedValue(Response.json(body));
    expect(await read(READ_SITE)).toHaveProperty("error");
  });
  it("rejects HTML, invalid JSON and fetch failures", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>login</html>", { headers: { "Content-Type": "text/html" } }))
      .mockResolvedValueOnce(new Response("{", { headers: { "Content-Type": "application/json" } }))
      .mockRejectedValueOnce(new Error("network"));
    for (let i = 0; i < 3; i++) expect(await read(READ_SITE)).toHaveProperty("error");
  });
  it("rejects invalid scope without issuing a request", async () => {
    expect(await read("foreign invalid")).toHaveProperty("error");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("bounds ignored aborts and cannot publish an old response after retry", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const first = read(READ_SITE);
    await jest.advanceTimersByTimeAsync(waitMs);
    expect(await first).toHaveProperty("error");
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    fetchMock.mockResolvedValueOnce(Response.json({ data: fixture() }));
    expect(await read(READ_SITE)).toEqual({ data: fixture() });
    finish(Response.json({ data: fixture() }));
    await Promise.resolve();
    expect(await first).toHaveProperty("error");
  });
  it("includes a stalled JSON body in the same deadline", async () => {
    let finish!: (body: unknown) => void;
    fetchMock.mockResolvedValue({ ok: true, headers: new Headers({ "Content-Type": "application/json" }), json: () => new Promise((resolve) => { finish = resolve; }) });
    const pending = read(READ_SITE);
    await jest.advanceTimersByTimeAsync(waitMs);
    expect(await pending).toHaveProperty("error");
    finish({ data: fixture() });
    await Promise.resolve();
    expect(await pending).toHaveProperty("error");
  });
  it("rejects expired responses even before the timeout callback gets CPU time", async () => {
    fetchMock.mockResolvedValue({ ok: true, headers: new Headers({ "Content-Type": "application/json" }), json: async () => {
      jest.setSystemTime(Date.now() + waitMs);
      return { data: fixture() };
    } });
    expect(await read(READ_SITE)).toHaveProperty("error");
  });
});

it("encodes revision and preserves null-revision fresh reads", async () => {
  fetchMock.mockImplementation(async () => Response.json({ data: catalogReadFixture() }));
  await fetchPosCatalogSnapshot(READ_SITE, "revision|1", true);
  expect(fetchMock.mock.calls[0][0]).toContain("revision=revision%7C1");
  expect(fetchMock.mock.calls[0][0]).toContain("bypassCache=true");
  await fetchPosCatalogSnapshot(READ_SITE, null);
  expect(fetchMock.mock.calls[1][0]).toContain("bypassCache=true");
});

it.each([
  (data: ReturnType<typeof catalogReadFixture>) => { data.inventorySnapshot.levels[0].quantity = NaN; },
  (data: ReturnType<typeof catalogReadFixture>) => { data.catalogItems[0].site_id = "foreign"; },
  (data: ReturnType<typeof catalogReadFixture>) => { data.catalogItems[0].target_sale_price = Infinity; },
])("rejects unsafe catalog rows instead of replacing local data", async (mutate) => {
  const data = catalogReadFixture(); mutate(data);
  fetchMock.mockResolvedValue({ ok: true, headers: new Headers({ "Content-Type": "application/json" }), json: async () => ({ data }) });
  expect(await fetchPosCatalogSnapshot(READ_SITE)).toHaveProperty("error");
});

it("rejects malformed nested order lines", async () => {
  const data = ordersReadFixture();
  fetchMock.mockResolvedValue(Response.json({ data: [{ ...data[0], sale_order_items: [{ ...data[0].sale_order_items[0], quantity: "not-a-number" }] }] }));
  expect(await fetchPosOpenOrders(READ_SITE)).toHaveProperty("error");
});