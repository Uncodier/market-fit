import { acceptPosPermission, getPosPermissionLease, restorePosPermission, revokePosPermission, suspendPosPermission } from "@/app/pos/local/location-permission-state";
import { canStartPosRemoteRequest, assertPosRemotePermission } from "@/app/pos/local/remote-permission";

jest.mock("@/app/pos/local/db", () => ({
  clearPosPrivateData: async () => {}, hasPosCachedSnapshot: async () => true,
  lockPosDb: jest.fn(), unlockPosDb: jest.fn(),
}));

const scope = { userId: "actor", siteId: "site", role: "owner" };
beforeEach(() => {
  jest.useFakeTimers(); localStorage.clear(); suspendPosPermission();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});
afterEach(() => { suspendPosPermission(); jest.useRealTimers(); });

it("keeps local generation stable but fences old remote work after offline and reconnect", async () => {
  const original = (await acceptPosPermission(scope, () => true))!;
  expect(canStartPosRemoteRequest(original)).toBe(true);
  await acceptPosPermission(scope, () => true);
  expect(canStartPosRemoteRequest(original)).toBe(true);
  const offline = (await restorePosPermission(scope.userId, scope.siteId, () => true))!;
  expect(offline.generation).toBe(original.generation);
  expect(canStartPosRemoteRequest(original)).toBe(false);
  expect(canStartPosRemoteRequest(offline)).toBe(false);
  const online = (await acceptPosPermission(scope, () => true))!;
  expect(online.generation).toBe(original.generation);
  expect(canStartPosRemoteRequest(original)).toBe(false);
  expect(canStartPosRemoteRequest(offline)).toBe(false);
  expect(canStartPosRemoteRequest(online)).toBe(true);
});

it("rejects missing, revoked and disconnected permission", async () => {
  expect(canStartPosRemoteRequest(null)).toBe(false);
  const grant = (await acceptPosPermission(scope, () => true))!;
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  expect(() => assertPosRemotePermission(grant)).toThrow("verify POS access");
  await revokePosPermission();
  expect(getPosPermissionLease()).toBeNull();
  expect(canStartPosRemoteRequest(grant)).toBe(false);
});