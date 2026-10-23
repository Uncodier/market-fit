/** @jest-environment node */
import { POST } from "@/app/api/pos/operation/route";
import { createClient } from "@/lib/supabase/server";
import { lookupCurrentUserSiteRole } from "@/lib/auth/site-role-lookup";
import { canAccessUnscopedSite } from "@/lib/permissions/location-boundary";
import { checkoutCart } from "@/app/commerce/checkout";
import { createLeadWithIdempotency } from "@/app/pos/actions/create-lead-sync";
import { getPosOrder } from "@/app/pos/actions/get-order";
import { buildCartFromSaleOrderItems } from "@/app/pos/populate-cart-from-order";
import { posCheckoutLines } from "@/app/pos/checkout-lines";
import {
  getActiveRegisterForPayment, getRegisterDashboard, getRegisterSummary,
  openRegister, closeRegister, moveRegisterCash,
} from "@/app/pos/register/actions";
import { siteId, orderId, userId, locationId, sessionId, requestId, foreignId,
  checkoutInput, checkoutResult, order, register, summary } from "./operation-fixtures";

jest.mock("server-only", () => ({}));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/auth/site-role-lookup", () => ({ lookupCurrentUserSiteRole: jest.fn(), SiteRoleLookupError: class extends Error {} }));
jest.mock("@/lib/permissions/location-boundary", () => ({ canAccessUnscopedSite: jest.fn() }));
jest.mock("@/app/commerce/checkout", () => ({ checkoutCart: jest.fn() }));
jest.mock("@/app/pos/actions/create-lead-sync", () => ({ createLeadWithIdempotency: jest.fn() }));
jest.mock("@/app/pos/actions/get-order", () => ({ getPosOrder: jest.fn() }));
jest.mock("@/app/pos/register/actions", () => ({
  getActiveRegisterForPayment: jest.fn(), getRegisterDashboard: jest.fn(), getRegisterSummary: jest.fn(),
  openRegister: jest.fn(), closeRegister: jest.fn(), moveRegisterCash: jest.fn(),
}));

const actions = [checkoutCart, createLeadWithIdempotency, getPosOrder, getActiveRegisterForPayment,
  getRegisterDashboard, getRegisterSummary, openRegister, closeRegister, moveRegisterCash];
const getUser = jest.fn();
const from = jest.fn();
const userClient = { auth: { getUser }, from };
const eq = jest.fn();
const baseHeaders = { "Content-Type": "application/json", Origin: "http://localhost", "Sec-Fetch-Site": "same-origin" };
const operations = [
  { operation: "checkout", input: checkoutInput },
  { operation: "create-lead", input: { siteId, name: "Customer", clientMutationId: requestId } },
  { operation: "order", input: { siteId, orderId } },
  { operation: "register", input: { siteId, locationId } },
  { operation: "register-dashboard", input: { siteId, locationId } },
  { operation: "register-summary", input: { siteId, sessionId } },
  { operation: "register-open", input: { siteId, locationId, currency: "USD", openingAmount: 0, requestId } },
  { operation: "register-close", input: { siteId, sessionId, countedAmount: 0, notes: "", requestId } },
  { operation: "register-move", input: { siteId, sessionId, kind: "cash_in", amount: 1, reason: "Float", requestId } },
];
function request(body: unknown = operations[0], headers: Record<string, string> = baseHeaders) {
  return new Request("http://localhost/api/pos/operation", { method: "POST", headers, body: JSON.stringify(body) });
}
function expectNoActions() { actions.forEach((action) => expect(action).not.toHaveBeenCalled()); }

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(createClient).mockResolvedValue(userClient as never);
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue("collaborator");
  jest.mocked(canAccessUnscopedSite).mockResolvedValue(true);
  from.mockImplementation(() => {
    let ids: string[] = [];
    type Query = { select: jest.Mock; eq: jest.Mock; in: jest.Mock; limit: jest.Mock;
      then: (resolve: (value: unknown) => unknown) => Promise<unknown> };
    const query: Query = {
      select: jest.fn(() => query), eq: jest.fn((...args) => { eq(...args); return query; }),
      in: jest.fn((_column, values) => { ids = values; return query; }),
      limit: jest.fn(() => query),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({
        data: ids.filter((id) => id !== foreignId).map((id) => ({ id })), error: null,
      })),
    };
    return query;
  });
  jest.mocked(checkoutCart).mockResolvedValue(checkoutResult);
  jest.mocked(createLeadWithIdempotency).mockResolvedValue({ lead: { id: orderId, site_id: siteId, name: "Customer" } });
  jest.mocked(getPosOrder).mockResolvedValue({ data: order });
  jest.mocked(getActiveRegisterForPayment).mockResolvedValue({ data: register });
  jest.mocked(getRegisterDashboard).mockResolvedValue({ data: { active: register, history: [], hasMore: false, role: "collaborator", userId } });
  jest.mocked(getRegisterSummary).mockResolvedValue({ data: summary });
  jest.mocked(openRegister).mockResolvedValue({ data: register });
  jest.mocked(closeRegister).mockResolvedValue({ data: { ...register, status: "closed" } });
  jest.mocked(moveRegisterCash).mockResolvedValue({ data: { id: requestId, site_id: siteId,
    session_id: sessionId, kind: "cash_in", amount: 1, reason: "Float", actor_id: userId, request_id: requestId, created_at: "2026-10-23T10:00:00Z" } });
});

it.each(operations)("authenticates and authorizes $operation before dispatch", async (operation) => {
  const response = await POST(request(operation));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(createClient).toHaveBeenCalledWith(true);
  expect(lookupCurrentUserSiteRole).toHaveBeenCalledWith(userClient, siteId);
  expect(canAccessUnscopedSite).toHaveBeenCalledWith(userClient, siteId);
  const called = actions.filter((action) => jest.mocked(action).mock.calls.length);
  expect(called).toHaveLength(1);
  expect(getUser.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(called[0]).mock.invocationCallOrder[0]);
});

it.each(operations)("rejects unauthenticated $operation before actions", async (operation) => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await POST(request(operation))).status).toBe(401);
  expectNoActions();
});

it.each([null, "viewer", "marketing", "foreign"])("rejects missing/cross-tenant or unauthorized register role %p", async (role) => {
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue(role);
  expect((await POST(request(operations[3]))).status).toBe(403);
  expectNoActions();
});

it.each(operations.slice(0, 3))("preserves authorized non-cashier access for $operation", async (operation) => {
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue("marketing");
  expect((await POST(request(operation))).status).toBe(200);
});

it("still requires cashier permission for checkout payments", async () => {
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue("marketing");
  const input = { ...checkoutInput, registerSessionId: sessionId, originLocationId: locationId,
    payments: [{ paymentId: requestId, method: "cash", amount: 10 }] };
  expect((await POST(request({ operation: "checkout", input }))).status).toBe(403);
  expectNoActions();
});

it.each(operations)("denies cross-tenant $operation", async (operation) => {
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue(null);
  expect((await POST(request(operation))).status).toBe(403);
  expectNoActions();
});

it("rejects location-restricted users without action calls", async () => {
  jest.mocked(canAccessUnscopedSite).mockResolvedValue(false);
  expect((await POST(request())).status).toBe(403);
  expectNoActions();
});

it.each([undefined, "null", "https://attacker.invalid", "http://localhost:3000", "http://sub.localhost"])("rejects missing/cross-origin %p", async (origin) => {
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Forwarded-Host": "attacker.invalid" };
  if (origin) headers.Origin = origin;
  expect((await POST(request(operations[0], headers))).status).toBe(403);
  expect(createClient).not.toHaveBeenCalled();
  expectNoActions();
});

it.each(["cross-site", "same-site", "none"])("rejects Sec-Fetch-Site %s", async (value) => {
  expect((await POST(request(operations[0], { ...baseHeaders, "Sec-Fetch-Site": value }))).status).toBe(403);
  expectNoActions();
});

it.each([
  null, [], {}, { operation: "delete", input: { siteId } },
  { ...operations[0], actor: userId },
  ...["shop", "quote", "sales", "marketplace"].map((source) => ({ operation: "checkout", input: { ...checkoutInput, source } })),
  ...["ownerSiteId", "selfServiceLocationId", "quotationId", "publicAccessToken", "actorId", "localLeadId"].map((key) => ({
    operation: "checkout", input: { ...checkoutInput, [key]: foreignId },
  })),
  { operation: "checkout", input: { ...checkoutInput, isStaffMutation: true } },
  { operation: "checkout", input: { ...checkoutInput, clientMutationId: "" } },
  { operation: "checkout", input: { ...checkoutInput, lines: [{ catalogItemId: locationId, quantity: -1 }] } },
  { operation: "checkout", input: { ...checkoutInput, lines: [{ catalogItemId: locationId, quantity: "1" }] } },
  { operation: "checkout", input: { ...checkoutInput, payments: [{ method: "cash", amount: 1 }] } },
  { operation: "order", input: { siteId, orderId: "not-an-id" } },
  { operation: "register", input: { siteId, locationId, userId } },
  { operation: "create-lead", input: { siteId, name: "", clientMutationId: requestId } },
])("rejects invalid or forged input before authentication (%#)", async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(createClient).not.toHaveBeenCalled();
  expectNoActions();
});

it("enforces streamed and declared request body bounds", async () => {
  for (const headers of [baseHeaders, { ...baseHeaders, "Content-Length": "1048577" }]) {
    const response = await POST(new Request("http://localhost/api/pos/operation", {
      method: "POST", headers, body: "x".repeat(1048577),
    }));
    expect(response.status).toBe(413);
  }
  expect(createClient).not.toHaveBeenCalled();
  expectNoActions();
});

it("rejects malformed JSON and non-JSON content types", async () => {
  expect((await POST(new Request("http://localhost/api/pos/operation", { method: "POST", headers: baseHeaders, body: "{" }))).status).toBe(400);
  expect((await POST(request(operations[0], { ...baseHeaders, "Content-Type": "text/plain" }))).status).toBe(415);
  expectNoActions();
});

it("rejects forged actor and re-derives the matching actor", async () => {
  expect((await POST(request({ operation: "checkout", input: { ...checkoutInput, userId: foreignId } }))).status).toBe(403);
  expect(checkoutCart).not.toHaveBeenCalled();
  const withoutActor = { ...checkoutInput, userId: undefined };
  expect((await POST(request({ operation: "checkout", input: withoutActor }))).status).toBe(200);
  expect(checkoutCart).toHaveBeenCalledWith({ ...checkoutInput, userId });
});

it.each(["existingOrderId", "leadId", "priceListId", "originLocationId", "promotionId", "registerSessionId", "existingReservationId"])(
  "rejects cross-tenant %s before checkout", async (field) => {
    expect((await POST(request({ operation: "checkout", input: { ...checkoutInput, [field]: foreignId } }))).status).toBe(403);
    expect(eq).toHaveBeenCalledWith("site_id", siteId);
    expect(checkoutCart).not.toHaveBeenCalled();
  },
);

it("rejects cross-tenant catalog items", async () => {
  expect((await POST(request({ operation: "checkout", input: { ...checkoutInput,
    lines: [{ catalogItemId: foreignId, quantity: 1 }] } }))).status).toBe(403);
  expect(checkoutCart).not.toHaveBeenCalled();
});

it("rejects foreign modifier groups and order-line references", async () => {
  const invalid = [
    { ...checkoutInput, lines: [{ ...checkoutInput.lines[0], modifiers: [{ catalogItemId: locationId, quantity: 1, groupId: foreignId }] }] },
    { ...checkoutInput, existingOrderId: orderId, lines: [{ ...checkoutInput.lines[0], saleOrderItemId: foreignId }] },
    { ...checkoutInput, lines: [{ ...checkoutInput.lines[0], saleOrderItemId: orderId }] },
    { ...checkoutInput, buyerUserId: foreignId },
  ];
  for (const input of invalid) expect((await POST(request({ operation: "checkout", input }))).status).toBe(403);
  expect(checkoutCart).not.toHaveBeenCalled();
});

it("round-trips restored legacy modifiers without changing their queued empty group identity", async () => {
  const cart = buildCartFromSaleOrderItems([
    { id: sessionId, catalog_item_id: locationId, quantity: 1, unit_price: 10,
      name: "Host", metadata: {}, parent_sale_order_item_id: null },
    { id: requestId, catalog_item_id: orderId, quantity: 1, unit_price: 2,
      name: "Legacy modifier", metadata: {}, parent_sale_order_item_id: sessionId },
  ], [], "USD");
  const input = { ...checkoutInput, existingOrderId: orderId, lines: posCheckoutLines(cart) };
  expect(input.lines[0].modifiers?.[0].groupId).toBe("");
  // Simulate the existing JSON outbox payload, not a freshly normalized request.
  const queued = JSON.parse(JSON.stringify(input));
  expect((await POST(request({ operation: "checkout", input: queued }))).status).toBe(200);
  expect(checkoutCart).toHaveBeenCalledWith(queued);
  expect(jest.mocked(checkoutCart).mock.calls[0][0].lines[0].modifiers?.[0].groupId).toBe("");
  expect(from).not.toHaveBeenCalledWith("modifier_groups");
});

it.each(["legacy-group", " ", "not-a-uuid"])("rejects malformed nonempty modifier group %p", async (groupId) => {
  const input = { ...checkoutInput, lines: [{ ...checkoutInput.lines[0],
    modifiers: [{ catalogItemId: locationId, quantity: 1, groupId }],
  }] };
  expect((await POST(request({ operation: "checkout", input }))).status).toBe(400);
  expect(createClient).not.toHaveBeenCalled();
  expectNoActions();
});

it("preserves original mutation and receipt IDs through the boundary", async () => {
  const input = { ...checkoutInput, registerSessionId: sessionId, originLocationId: locationId,
    payments: [{ paymentId: requestId, method: "cash", amount: 10, tendered: 10, change: 0 }] };
  expect((await POST(request({ operation: "checkout", input }))).status).toBe(200);
  expect(checkoutCart).toHaveBeenCalledWith(input);
});

it.each(["register_required", "register_location_required"] as const)("preserves %s with 409", async (code) => {
  jest.mocked(getActiveRegisterForPayment).mockResolvedValue({ error: "private provider data", code });
  const response = await POST(request(operations[3]));
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code });
});

it("preserves safe recovery evidence without provider text", async () => {
  jest.mocked(checkoutCart).mockResolvedValue({ error: "private database info", recovery: {
    state: "payment_recorded", message: "private provider message", orderId, saleId: orderId,
  } });
  const response = await POST(request());
  expect(response.status).toBe(409);
  const body = await response.json();
  expect(body.recovery).toMatchObject({ state: "payment_recorded", orderId });
  expect(JSON.stringify(body)).not.toContain("private");
});

it("fails closed on malformed action success and cross-tenant response", async () => {
  jest.mocked(checkoutCart).mockResolvedValue({ success: true } as never);
  expect((await POST(request())).status).toBe(502);
  jest.mocked(getPosOrder).mockResolvedValue({ data: { ...order, site_id: foreignId } });
  expect((await POST(request(operations[2]))).status).toBe(502);
});

it("sanitizes thrown and returned backend errors with no-store", async () => {
  for (const fail of [() => getUser.mockRejectedValueOnce(new Error("private auth secret")),
    () => jest.mocked(checkoutCart).mockResolvedValueOnce({ error: "private database details" })]) {
    fail();
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.stringify(await response.json())).not.toContain("private");
  }
});