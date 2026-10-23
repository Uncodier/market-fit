import { enqueueRegisteredCheckout } from "@/app/pos/register/prepare-payment";
import { checkoutCart } from "@/app/commerce/checkout";
import { listPosOpenOrders } from "@/app/pos/actions/list-open-orders";
import { getActiveRegisterForPayment } from "@/app/pos/register/actions";
import { getPosDb } from "@/app/pos/local/db";
import { enqueueCheckout, listOutbox, mapLocalId, updateOutboxRow } from "@/app/pos/local/outbox";
import { pullPosOrdersInBackground } from "@/app/pos/local/sync-engine";
import type { CheckoutOutboxPayload, PosOutboxRow } from "@/app/pos/local/types";

// Deliberately use the real HTTP client and queue worker. Only the network,
// local persistence and unrelated framework actions are isolated test doubles.
jest.mock("@/app/commerce/checkout", () => ({ checkoutCart: jest.fn(() => new Promise(() => {})) }));
jest.mock("@/app/pos/register/actions", () => ({ getActiveRegisterForPayment: jest.fn(() => new Promise(() => {})) }));
jest.mock("@/app/pos/catalog-revision-client", () => ({ fetchPosCatalogRevision: jest.fn() }));
jest.mock("@/app/commerce/ticket-check-in", () => ({ checkInTicket: jest.fn() }));
jest.mock("@/app/orders/actions", () => ({ updateOrderNotes: jest.fn() }));
jest.mock("@/app/pos/actions/report-sync-error", () => ({ reportPosSyncError: jest.fn(() => new Promise(() => {})) }));
jest.mock("@/app/pos/local/snapshot-pull", () => ({
  pullAndStorePosCatalogSnapshot: async () => ({ ok: true }), applyPosOpenOrders: jest.fn(),
}));
jest.mock("@/app/pos/actions/list-open-orders", () => ({ listPosOpenOrders: jest.fn() }));
jest.mock("@/app/pos/local/location-permission-state", () => {
  const permission = (siteId: string) => ({ siteId, userId: "22222222-2222-4222-8222-222222222222", generation: 1 });
  return { requirePosPermission: permission, getPosPermissionLease: permission,
    isPosPermissionCurrent: () => true, subscribePosPermission: () => () => {} };
});
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/local/outbox", () => ({
  enqueueCheckout: jest.fn(), listOutbox: jest.fn(), updateOutboxRow: jest.fn(),
  getServerIdForLocal: jest.fn(), mapLocalId: jest.fn(),
}));

const SITE = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const LOCATION = "33333333-3333-4333-8333-333333333333";
const REGISTER = "44444444-4444-4444-8444-444444444444";
const OLD = "55555555-5555-4555-8555-555555555555";
const NEW = "66666666-6666-4666-8666-666666666666";
const SALE = "77777777-7777-4777-8777-777777777777";
const SKU = "88888888-8888-4888-8888-888888888888";
const stamp = "2026-10-23T12:00:00.000Z";
const register = { id: REGISTER, site_id: SITE, location_id: LOCATION, currency: "USD", opened_by: USER,
  closed_by: null, opened_at: stamp, closed_at: null, opening_amount: 0, counted_amount: null,
  expected_amount: null, difference: null, notes: "", status: "open", snapshot: null };
const payload = (id: string, orderId: string): CheckoutOutboxPayload => ({
  siteId: SITE, userId: USER, source: "pos", clientMutationId: id, existingOrderId: orderId,
  fulfillment: "pickup", originLocationId: LOCATION, lines: [{ catalogItemId: SKU, quantity: 1 }],
  payments: [{ method: "cash", amount: 10, tendered: 10, change: 0 }],
});
const response = (body: unknown) => ({ ok: true, status: 200,
  headers: { get: () => "application/json" }, json: async () => body }) as unknown as Response;
const success = (orderId: string) => response({ success: true, orderId, saleId: SALE });
let rows: PosOutboxRow[];

async function flush() { for (let i = 0; i < 100; i++) await Promise.resolve(); }
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); localStorage.clear(); rows = [];
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  Object.defineProperty(navigator, "locks", { configurable: true, value: {
    request: async (_name: string, _options: unknown, callback: () => Promise<unknown>) => callback(),
  } });
  jest.mocked(listOutbox).mockImplementation(async () => rows.map((row) => ({ ...row })));
  jest.mocked(enqueueCheckout).mockImplementation(async (_site, data, checkoutCartSessionId) => {
    const row: PosOutboxRow = { id: data.clientMutationId, clientMutationId: data.clientMutationId,
      siteId: SITE, kind: "checkout", payload: { kind: "checkout", data }, status: "pending",
      attempts: 0, createdAt: stamp, updatedAt: stamp, checkoutCartSessionId };
    rows.push(row); return row;
  });
  jest.mocked(updateOutboxRow).mockImplementation(async (id, patch) => {
    Object.assign(rows.find((row) => row.id === id)!, patch);
  });
  jest.mocked(mapLocalId).mockResolvedValue(undefined);
  jest.mocked(getPosDb).mockReturnValue({
    meta: { get: jest.fn() }, outbox: { get: async (id: string) => rows.find((row) => row.id === id) },
    transaction: async (_mode: string, _table: unknown, callback: () => Promise<void>) => callback(),
  } as unknown as ReturnType<typeof getPosDb>);
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

it("confirms new payments via HTTP while background Server Actions and an older checkout remain hung", async () => {
  let finishOrders!: (value: { data: [] }) => void;
  let finishOld!: (value: Response) => void;
  jest.mocked(listPosOpenOrders).mockReturnValue(new Promise((resolve) => { finishOrders = resolve; }));
  jest.mocked(fetch).mockImplementation(async (_url, options) => {
    const { operation, input } = JSON.parse(String(options?.body));
    if (operation === "register") return response({ data: register });
    if (operation === "checkout" && input.clientMutationId === "old") {
      return new Promise<Response>((resolve) => { finishOld = resolve; });
    }
    if (operation === "checkout") return success(NEW);
    throw new Error("Unexpected transport");
  });
  const orders = pullPosOrdersInBackground(SITE);
  await flush();
  expect(listPosOpenOrders).toHaveBeenCalledTimes(1);
  const old = enqueueRegisteredCheckout(SITE, payload("old", OLD)).catch((error: unknown) => error);
  await flush();
  expect(rows[0].status).toBe("syncing");
  await expect(enqueueRegisteredCheckout(SITE, payload("new", NEW))).resolves.toMatchObject({ status: "synced" });
  expect(rows[0].status).toBe("syncing");
  expect(checkoutCart).not.toHaveBeenCalled();
  expect(getActiveRegisterForPayment).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(45_000);
  expect(await old).toEqual(expect.objectContaining({ message: expect.stringContaining("not confirmed") }));
  await expect(enqueueRegisteredCheckout(SITE, payload("old", OLD))).rejects.toThrow("not confirmed");
  const sent = jest.mocked(fetch).mock.calls.map(([, options]) => JSON.parse(String(options?.body)))
    .filter((call) => call.operation === "checkout");
  expect(sent.map((call) => call.input.clientMutationId)).toEqual(["old", "new"]);
  expect(sent[0].input.payments[0].paymentId).toMatch(/^[a-f0-9-]{36}$/);
  finishOld(success(OLD));
  await flush();
  expect(rows[0].status).toBe("synced");
  finishOrders({ data: [] });
  await orders;
});

it("expires a hung register read before enqueue, releasing admission for the next customer", async () => {
  jest.mocked(fetch).mockReturnValueOnce(new Promise(() => {}));
  const first = enqueueRegisteredCheckout(SITE, payload("lookup-timeout", OLD)).catch((error: unknown) => error);
  await jest.advanceTimersByTimeAsync(8_000);
  expect(await first).toEqual(new Error("POS request timed out. Please try again."));
  expect(enqueueCheckout).not.toHaveBeenCalled();
  expect(jest.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
  jest.mocked(fetch).mockImplementation(async (_url, options) =>
    JSON.parse(String(options?.body)).operation === "register" ? response({ data: register }) : success(NEW));
  await expect(enqueueRegisteredCheckout(SITE, payload("after-timeout", NEW))).resolves.toMatchObject({ status: "synced" });
});