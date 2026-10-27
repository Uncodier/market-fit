import { act, renderHook } from "@testing-library/react";
import { usePosLocationAccess } from "@/app/pos/hooks/use-pos-location-access";
import { createClient } from "@/lib/supabase/client";
import { clearPosPrivateData, hasPosCachedSnapshot, unlockPosDb } from "@/app/pos/local/db";
import { getPosPermissionLease, suspendPosPermission } from "@/app/pos/local/location-permission-state";

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({
  clearPosPrivateData: jest.fn(), preparePosStorage: jest.fn(), hasPosCachedSnapshot: jest.fn(), lockPosDb: jest.fn(), unlockPosDb: jest.fn(),
}));

const KEY = "pos-location-scope-v1";
const ROLE = "current_user_site_role";
const SITE_RESTRICTION = "current_user_has_site_location_restrictions";
const GLOBAL_RESTRICTION = "current_user_has_location_restrictions";
const auth = jest.fn();
const rpc = jest.fn();
let authChange: (event: string, session: { user: { id: string } } | null) => void;
type Reply = { data: unknown; error: null | { status?: number; code?: string; message?: string } };
const success = (name: string): Reply => ({ data: name === ROLE ? "collaborator" : false, error: null });
const denials: [string, Reply][] = [
  ["401", { data: null, error: { status: 401 } }],
  ["403", { data: null, error: { status: 403 } }],
  ["42501 without HTTP status", { data: null, error: { code: "42501", message: "permission denied" } }],
];

async function settle() { await act(async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); }); }
function online(value: boolean) { Object.defineProperty(navigator, "onLine", { configurable: true, value }); }
function seed(user = "actor-a", site = "site-a") { localStorage.setItem(KEY, JSON.stringify([user, site, "collaborator"])); }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function fallback(mode: string) {
  act(() => {
    if (mode === "timeout") jest.advanceTimersByTime(8_000);
    else { online(false); window.dispatchEvent(new Event("offline")); }
  });
  await settle();
}

describe("POS offline authorization revocation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();
    localStorage.clear();
    suspendPosPermission();
    online(true);
    seed();
    jest.mocked(clearPosPrivateData).mockResolvedValue(undefined);
    jest.mocked(hasPosCachedSnapshot).mockResolvedValue(true);
    auth.mockResolvedValue({ data: { user: { id: "actor-a" } }, error: null });
    rpc.mockImplementation(async (name: string) => success(name));
    jest.mocked(createClient).mockReturnValue({
      auth: {
        getUser: auth,
        onAuthStateChange: (listener: typeof authChange) => {
          authChange = listener;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        },
      }, rpc,
    } as unknown as ReturnType<typeof createClient>);
  });
  afterEach(() => { jest.useRealTimers(); });

  describe.each([ROLE, SITE_RESTRICTION, GLOBAL_RESTRICTION])("denial from %s", (method) => {
    it.each(denials)("revokes persisted eligibility on %s before an offline event", async (_label, denial) => {
      rpc.mockImplementation(async (name: string) => name === method ? denial : success(name));
      const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
      await settle();
      expect(result.current.status).toBe("unavailable");
      expect(localStorage.getItem(KEY)).toBeNull();
      await fallback("offline");
      expect(result.current.status).toBe("unavailable");
      expect(getPosPermissionLease()).toBeNull();
      expect(unlockPosDb).not.toHaveBeenCalled();
    });
  });

  it.each(denials)("revokes auth %s even when returned after going offline", async (_label, denial) => {
    const pending = deferred<unknown>();
    auth.mockReturnValue(pending.promise);
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    await fallback("offline");
    expect(result.current.lease?.offline).toBe(true);
    pending.resolve({ data: { user: null }, error: denial.error });
    await settle();
    expect(result.current.status).toBe("unavailable");
    expect(localStorage.getItem(KEY)).toBeNull();
    await fallback("offline");
    expect(getPosPermissionLease()).toBeNull();
  });

  describe.each(["timeout", "offline"])("after %s fallback", (mode) => {
    it.each([
      [SITE_RESTRICTION, { data: true, error: null }, "restricted"],
      [GLOBAL_RESTRICTION, { data: true, error: null }, "restricted"],
      [ROLE, { data: "buyer", error: null }, "unavailable"],
      ...denials.map(([, reply]) => [SITE_RESTRICTION, reply, "unavailable"]),
    ] as [string, Reply, string][])("applies late %s denial %j", async (method, denial, status) => {
      const pending = deferred<Reply>();
      rpc.mockImplementation((name: string) => name === method ? pending.promise : Promise.resolve(success(name)));
      const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
      await settle();
      await fallback(mode);
      expect(result.current.status).toBe("allowed");
      expect(result.current.lease?.offline).toBe(true);
      pending.resolve(denial);
      await settle();
      expect(result.current.status).toBe(status);
      expect(localStorage.getItem(KEY)).toBeNull();
      expect(getPosPermissionLease()).toBeNull();
      await fallback("offline");
      expect(result.current.status).not.toBe("allowed");
    });

    it("never upgrades the local fallback from a late grant", async () => {
      const pending = deferred<Reply>();
      rpc.mockImplementation((name: string) => name === SITE_RESTRICTION ? pending.promise : Promise.resolve(success(name)));
      const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
      await settle();
      await fallback(mode);
      const lease = result.current.lease;
      expect(lease?.offline).toBe(true);
      online(true);
      pending.resolve(success(SITE_RESTRICTION));
      await settle();
      expect(result.current.lease).toBe(lease);
      expect(getPosPermissionLease()?.offline).toBe(true);
    });
  });

  it.each(["site", "actor", "signout", "storage", "unmount"].flatMap((invalidation) =>
    [true, false].map((restricted) => ({ invalidation, restricted })),
  ))("fences old restriction=$restricted after $invalidation invalidation", async ({ invalidation, restricted }) => {
    const pending = deferred<Reply>();
    rpc.mockImplementation((name: string) => name === SITE_RESTRICTION ? pending.promise : Promise.resolve(success(name)));
    const hook = renderHook(({ site, user }) => usePosLocationAccess(site, user), {
      initialProps: { site: "site-a", user: "actor-a" },
    });
    await settle();
    await fallback("timeout");
    if (invalidation === "site" || invalidation === "actor") {
      const site = invalidation === "site" ? "site-b" : "site-a";
      const user = invalidation === "actor" ? "actor-b" : "actor-a";
      auth.mockResolvedValue({ data: { user: { id: user } }, error: null });
      rpc.mockImplementation(async (name: string) => success(name));
      hook.rerender({ site, user });
    } else if (invalidation === "signout") {
      act(() => authChange("SIGNED_OUT", null));
    } else if (invalidation === "storage") {
      act(() => window.dispatchEvent(new StorageEvent("storage", { key: KEY })));
    } else hook.unmount();
    await settle();
    const marker = localStorage.getItem(KEY);
    const lease = getPosPermissionLease();
    jest.mocked(clearPosPrivateData).mockClear();
    jest.mocked(unlockPosDb).mockClear();
    pending.resolve({ data: restricted, error: null });
    await settle();
    expect(clearPosPrivateData).not.toHaveBeenCalled();
    expect(unlockPosDb).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe(marker);
    expect(getPosPermissionLease()).toBe(lease);
    if (invalidation !== "unmount") expect(hook.result.current.status).not.toBe("restricted");
  });

  it.each(denials)("revokes persisted eligibility for a thrown %s error", async (_label, denial) => {
    rpc.mockRejectedValue(denial.error);
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    expect(result.current.status).toBe("unavailable");
    expect(localStorage.getItem(KEY)).toBeNull();
    await fallback("offline");
    expect(getPosPermissionLease()).toBeNull();
  });

  it("keeps revoked access locked if private-data cleanup fails", async () => {
    jest.mocked(clearPosPrivateData).mockRejectedValue(new Error("Storage unavailable"));
    rpc.mockResolvedValue(denials[2][1]);
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    expect(result.current.status).toBe("unavailable");
    expect(localStorage.getItem(KEY)).toBeNull();
    await fallback("offline");
    expect(result.current.status).toBe("unavailable");
    expect(getPosPermissionLease()).toBeNull();
  });

  it("cancels an in-progress cache restore when a late restriction arrives", async () => {
    const pending = deferred<Reply>();
    const snapshot = deferred<boolean>();
    jest.mocked(hasPosCachedSnapshot).mockReturnValue(snapshot.promise);
    rpc.mockImplementation((name: string) => name === SITE_RESTRICTION ? pending.promise : Promise.resolve(success(name)));
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    await fallback("timeout");
    pending.resolve({ data: true, error: null });
    await settle();
    snapshot.resolve(true);
    await settle();
    expect(result.current.status).toBe("restricted");
    expect(getPosPermissionLease()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(unlockPosDb).not.toHaveBeenCalled();
  });

  it("retains offline eligibility on a transport error without an explicit denial", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    expect(result.current.status).toBe("allowed");
    expect(result.current.lease?.offline).toBe(true);
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it("restores eligibility only after a fresh successful verification", async () => {
    rpc.mockResolvedValue(denials[1][1]);
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    expect(localStorage.getItem(KEY)).toBeNull();
    rpc.mockImplementation(async (name: string) => success(name));
    act(() => window.dispatchEvent(new Event("focus")));
    await settle();
    expect(result.current.status).toBe("allowed");
    expect(result.current.lease?.offline).not.toBe(true);
    await fallback("offline");
    expect(result.current.status).toBe("allowed");
    expect(result.current.lease?.offline).toBe(true);
  });
});