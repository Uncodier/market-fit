/** @jest-environment node */
import { POST } from "@/app/api/pos/checkout-status/route";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { lookupCurrentUserSiteRole } from "@/lib/auth/site-role-lookup";
import { canAccessUnscopedSite } from "@/lib/permissions/location-boundary";
import { inspectPosPayment } from "@/app/pos/payment-recovery-server";

jest.mock("server-only", () => ({}));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }));
jest.mock("@/lib/auth/site-role-lookup", () => ({ lookupCurrentUserSiteRole: jest.fn(), SiteRoleLookupError: class extends Error {} }));
jest.mock("@/lib/permissions/location-boundary", () => ({ canAccessUnscopedSite: jest.fn() }));
jest.mock("@/app/pos/payment-recovery-server", () => ({ inspectPosPayment: jest.fn() }));

const siteId = "11111111-1111-4111-8111-111111111111";
const input = { siteId, clientMutationId: "original-mutation",
  existingOrderId: "22222222-2222-4222-8222-222222222222",
  registerSessionId: "33333333-3333-4333-8333-333333333333",
  payments: [{ paymentId: "44444444-4444-4444-8444-444444444444", method: "cash", amount: 10, tendered: 15, change: 5 }],
};
const getUser = jest.fn();
const userClient = { auth: { getUser } };
const serviceClient = { from: jest.fn() };

function request(body: unknown = input) {
  return new Request("http://localhost/api/pos/checkout-status", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

function expectNoPrivilegedRead() {
  expect(createServiceClient).not.toHaveBeenCalled();
  expect(inspectPosPayment).not.toHaveBeenCalled();
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(createClient).mockResolvedValue(userClient as never);
  jest.mocked(createServiceClient).mockResolvedValue(serviceClient as never);
  getUser.mockResolvedValue({ data: { user: { id: "authenticated-cashier" } }, error: null });
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue("collaborator");
  jest.mocked(canAccessUnscopedSite).mockResolvedValue(true);
  jest.mocked(inspectPosPayment).mockResolvedValue({ state: "payment_recorded", message: "Review checkout finalization." });
});

it.each(["owner", "admin", "collaborator"])("authorizes %s before unchanged read-only receipt inspection", async (role) => {
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue(role);
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ data: { state: "payment_recorded", message: "Review checkout finalization." } });
  expect(createClient).toHaveBeenCalledWith(true);
  expect(getUser).toHaveBeenCalledTimes(1);
  expect(lookupCurrentUserSiteRole).toHaveBeenCalledWith(userClient, siteId);
  expect(canAccessUnscopedSite).toHaveBeenCalledWith(userClient, siteId);
  expect(createServiceClient).toHaveBeenCalledWith(true, { access: "workspace" });
  expect(inspectPosPayment).toHaveBeenCalledWith(serviceClient, input, "authenticated-cashier");
});

it.each([null, { message: "expired token" }])("rejects unauthenticated sessions without privileged reads (%p)", async (error) => {
  getUser.mockResolvedValue({ data: { user: null }, error });
  const response = await POST(request());
  expect(response.status).toBe(401);
  expect(lookupCurrentUserSiteRole).not.toHaveBeenCalled();
  expectNoPrivilegedRead();
});

it.each([null, "marketing", "viewer", "foreign"])("denies missing/cross-site or insufficient role %p", async (role) => {
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue(role);
  expect((await POST(request())).status).toBe(403);
  expectNoPrivilegedRead();
});

it("denies location-restricted users, even with an allowed POS role", async () => {
  jest.mocked(canAccessUnscopedSite).mockResolvedValue(false);
  expect((await POST(request())).status).toBe(403);
  expectNoPrivilegedRead();
});

it.each([
  { ...input, siteId: "demo-site" }, { ...input, clientMutationId: "" }, { ...input, userId: "forged-actor" },
  { ...input, payments: [...input.payments, ...input.payments] },
  { ...input, payments: [{ ...input.payments[0], amount: -1 }] },
  { ...input, payments: [{ ...input.payments[0], amount: "10" }] },
  { ...input, existingOrderId: "not-an-order" }, { ...input, payments: Array(51).fill(input.payments[0]) },
  { ...input, payments: [{ ...input.payments[0], paymentId: "legacy-receipt" }] },
])("rejects malformed or forged inputs before auth/service access (%#)", async (body) => {
  const response = await POST(request(body));
  expect(response.status).toBe(400);
  expect(createClient).not.toHaveBeenCalled();
  expectNoPrivilegedRead();
});

it.each(["{", "x".repeat(32_769)])("rejects malformed/oversized JSON without reads (%#)", async (body) => {
  const response = await POST(new Request("http://localhost/api/pos/checkout-status", { method: "POST", body }));
  expect(response.status).toBe(400);
  expect(createClient).not.toHaveBeenCalled();
  expectNoPrivilegedRead();
});

it("returns a safe 500 on auth infrastructure failure, without service access", async () => {
  getUser.mockRejectedValueOnce(new Error("private auth configuration"));
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain("private auth");
  expectNoPrivilegedRead();
});

it("returns a safe 500 on inspection failure, never raw financial/provider detail", async () => {
  jest.mocked(inspectPosPayment).mockRejectedValueOnce(new Error("private receipt details"));
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain("private receipt");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});