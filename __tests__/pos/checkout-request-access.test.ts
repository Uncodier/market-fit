/** @jest-environment node */
import { requirePosSiteAccess } from "@/app/pos/actions/site-access";
import { requirePosCheckoutAccess, withPosCheckoutAccessScope } from "@/app/pos/checkout-request-access";
jest.mock("server-only", () => ({}));
jest.mock("@/app/pos/actions/site-access", () => ({ requirePosSiteAccess: jest.fn() }));
const access = { user: { id: "server-user" }, role: "collaborator", supabase: {} };
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(requirePosSiteAccess).mockResolvedValue(access);
});

it("deduplicates only server lookups for the same site within one operation", async () => {
  await withPosCheckoutAccessScope(async () => {
    expect(await Promise.all([requirePosCheckoutAccess("site"), requirePosCheckoutAccess("site")])).toEqual([access, access]);
    expect(requirePosSiteAccess).toHaveBeenCalledTimes(1);
    await requirePosCheckoutAccess("other-site");
    expect(requirePosSiteAccess).toHaveBeenCalledTimes(2);
  });
  await requirePosCheckoutAccess("site");
  await requirePosCheckoutAccess("site");
  expect(requirePosSiteAccess).toHaveBeenCalledTimes(4);
});

it("isolates concurrent requests to the same tenant and nested invocations", async () => {
  jest.mocked(requirePosSiteAccess).mockResolvedValueOnce(access).mockResolvedValueOnce({ error: "Forbidden" });
  expect(await Promise.all([
    withPosCheckoutAccessScope(() => requirePosCheckoutAccess("site")),
    withPosCheckoutAccessScope(() => requirePosCheckoutAccess("site")),
  ])).toEqual([access, { error: "Forbidden" }]);
  await withPosCheckoutAccessScope(async () => {
    await requirePosCheckoutAccess("site");
    await withPosCheckoutAccessScope(() => requirePosCheckoutAccess("site"));
    await requirePosCheckoutAccess("site");
  });
  expect(requirePosSiteAccess).toHaveBeenCalledTimes(4);
});

it("does not retain denial or exceptions across operations", async () => {
  jest.mocked(requirePosSiteAccess).mockResolvedValueOnce({ error: "Not authenticated" });
  expect(await withPosCheckoutAccessScope(() => requirePosCheckoutAccess("site"))).toEqual({ error: "Not authenticated" });
  jest.mocked(requirePosSiteAccess).mockRejectedValueOnce(new Error("lookup failed"));
  await expect(withPosCheckoutAccessScope(() => requirePosCheckoutAccess("site"))).rejects.toThrow("lookup failed");
  expect(await withPosCheckoutAccessScope(() => requirePosCheckoutAccess("site"))).toEqual(access);
  expect(requirePosSiteAccess).toHaveBeenCalledTimes(3);
});

it("expires inherited async contexts after the operation finishes", async () => {
  let resume!: () => void;
  let pending!: Promise<unknown>;
  await withPosCheckoutAccessScope(async () => {
    await requirePosCheckoutAccess("site");
    pending = new Promise<void>((resolve) => { resume = resolve; }).then(() => requirePosCheckoutAccess("site"));
  });
  jest.mocked(requirePosSiteAccess).mockResolvedValueOnce({ error: "Forbidden" });
  resume();
  expect(await pending).toEqual({ error: "Forbidden" });
});