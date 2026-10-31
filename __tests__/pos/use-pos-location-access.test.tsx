import { act, renderHook } from "@testing-library/react";
import { usePosLocationAccess } from "@/app/pos/hooks/use-pos-location-access";
import { createClient } from "@/lib/supabase/client";
import { clearPosPrivateData, hasPosCachedSnapshot, lockPosDb, preparePosStorage, unlockPosDb } from "@/app/pos/local/db";
import { getPosPermissionLease, suspendPosPermission } from "@/app/pos/local/location-permission-state";

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({
  clearPosPrivateData: jest.fn(), preparePosStorage: jest.fn(), hasPosCachedSnapshot: jest.fn(), lockPosDb: jest.fn(), unlockPosDb: jest.fn(),
}));

const auth = jest.fn();
const rpc = jest.fn();
const unsubscribe = jest.fn();
let authChange: (event: string, session: { user: { id: string } } | null) => void;

async function settle() { await act(async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); }); }
function online(value: boolean) { Object.defineProperty(navigator, "onLine", { configurable: true, value }); }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("POS current browser location access", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    localStorage.clear();
    suspendPosPermission();
    online(true);
    jest.mocked(clearPosPrivateData).mockResolvedValue(undefined);
    jest.mocked(preparePosStorage).mockResolvedValue(undefined);
    jest.mocked(hasPosCachedSnapshot).mockResolvedValue(false);
    auth.mockResolvedValue({ data: { user: { id: "actor-a" } }, error: null });
    rpc.mockImplementation(async (name: string) => ({ data: name === "current_user_site_role" ? "collaborator" : false, error: null }));
    jest.mocked(createClient).mockReturnValue({
      auth: { getUser: auth, onAuthStateChange: (listener: typeof authChange) => { authChange = listener; return { data: { subscription: { unsubscribe } } }; } },
      rpc: (...args: unknown[]) => ({ abortSignal: () => rpc(...args) }),
    } as unknown as ReturnType<typeof createClient>);
  });
  afterEach(() => { jest.useRealTimers(); });

  it("does not unlock the DB before identity and both authoritative restriction checks", async () => {
    const pending = deferred<{ data: boolean; error: null }>();
    rpc.mockImplementation((name: string) => name === "current_user_site_role" ? Promise.resolve({ data: "owner", error: null }) : pending.promise);
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    expect(result.current.status).toBe("checking");
    expect(unlockPosDb).not.toHaveBeenCalled();
    expect(clearPosPrivateData).not.toHaveBeenCalled();
    pending.resolve({ data: false, error: null });
    await settle();
    expect(result.current.status).toBe("allowed");
    expect(rpc).toHaveBeenCalledWith("current_user_has_site_location_restrictions", { p_site_id: "site-a" });
    expect(rpc).toHaveBeenCalledWith("current_user_has_location_restrictions");
  });

  it("finishes verification despite repeated same-actor session notifications", async () => {
    const pending = deferred<{ data: { user: { id: string } }; error: null }>();
    auth.mockReturnValue(pending.promise);
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    for (const event of ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED"]) {
      act(() => { authChange(event, { user: { id: "actor-a" } }); jest.advanceTimersByTime(0); });
      await settle();
    }
    expect(auth).toHaveBeenCalledTimes(1);
    pending.resolve({ data: { user: { id: "actor-a" } }, error: null });
    await settle();
    expect(result.current.status).toBe("allowed");
  });

  it("does not restart a hanging startup deadline on focus or session notifications", async () => {
    auth.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    for (let i = 0; i < 4; i++) {
      act(() => {
        jest.advanceTimersByTime(2_000);
        window.dispatchEvent(new Event("focus"));
        authChange("SIGNED_IN", { user: { id: "actor-a" } });
        jest.advanceTimersByTime(0);
      });
      await settle();
    }
    expect(result.current.status).toBe("unavailable");
    expect(auth).toHaveBeenCalledTimes(1);
    expect(unlockPosDb).not.toHaveBeenCalled();
  });

  it("bounds a storage-invalidated check and rejects its stale grant", async () => {
    const pending = deferred<{ data: { user: { id: string } }; error: null }>();
    auth.mockReturnValue(pending.promise);
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "pos-location-scope-v1" })));
    act(() => jest.advanceTimersByTime(8_000));
    await settle();
    expect(result.current.status).toBe("unavailable");
    pending.resolve({ data: { user: { id: "actor-a" } }, error: null });
    await settle();
    expect(unlockPosDb).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(0));
    await settle();
    expect(result.current.status).toBe("allowed");
  });

  it("keeps a timed-out check unavailable after later storage invalidations until SDK work settles", async () => {
    const pending = deferred<{ data: { user: { id: string } }; error: null }>();
    auth.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    act(() => jest.advanceTimersByTime(8_000));
    await settle();
    expect(result.current).toMatchObject({ status: "unavailable", reason: "timeout" });
    for (let i = 0; i < 3; i++) {
      act(() => {
        window.dispatchEvent(new StorageEvent("storage", { key: "pos-location-scope-v1" }));
        window.dispatchEvent(new Event("focus"));
        jest.advanceTimersByTime(30_000);
      });
      await settle();
      expect(result.current).toMatchObject({ status: "unavailable", reason: "timeout" });
    }
    expect(auth).toHaveBeenCalledTimes(1);
    expect(unlockPosDb).not.toHaveBeenCalled();
    pending.resolve({ data: { user: { id: "actor-a" } }, error: null });
    await settle();
    expect(unlockPosDb).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(0));
    await settle();
    expect(result.current.status).toBe("allowed");
    expect(auth).toHaveBeenCalledTimes(2);
  });

  it("retries a failed verification and clears the error while the new check is pending", async () => {
    auth.mockRejectedValueOnce(new Error("Session request failed"));
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    expect(result.current).toMatchObject({ status: "unavailable", reason: "session" });
    const pending = deferred<{ data: { user: { id: string } }; error: null }>();
    auth.mockReturnValueOnce(pending.promise);
    act(() => result.current.retry!());
    await settle();
    expect(result.current.status).toBe("checking");
    pending.resolve({ data: { user: { id: "actor-a" } }, error: null });
    await settle();
    expect(result.current.status).toBe("allowed");
  });

  it("exposes a safe storage code and performs a new check after retry", async () => {
    const error = new Error("Private browser details must not be shown");
    error.name = "UnknownError";
    jest.mocked(preparePosStorage).mockRejectedValueOnce(error);
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    expect(result.current).toMatchObject({ status: "unavailable", reason: "storage", diagnostic: "POS_STORAGE_OPEN:DB_OPEN" });
    expect(auth).not.toHaveBeenCalled();
    expect(unlockPosDb).not.toHaveBeenCalled();
    act(() => result.current.retry!());
    await settle();
    expect(result.current.status).toBe("allowed");
    expect(result.current.diagnostic).toBeUndefined();
  });

  it("bounds a stalled device-storage preparation without starting private hooks", async () => {
    const pending = deferred<void>();
    jest.mocked(preparePosStorage).mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    expect(result.current.status).toBe("checking");
    act(() => jest.advanceTimersByTime(8_000));
    await settle();
    expect(result.current).toMatchObject({ status: "unavailable", reason: "timeout" });
    pending.resolve();
    await settle();
    expect(auth).not.toHaveBeenCalled();
    expect(unlockPosDb).not.toHaveBeenCalled();
  });

  it("does not accept a timed-out response after an explicit retry", async () => {
    const old = deferred<{ data: { user: { id: string } }; error: null }>();
    auth.mockReturnValueOnce(old.promise);
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    act(() => jest.advanceTimersByTime(8_000));
    await settle();
    expect(result.current.status).toBe("unavailable");
    act(() => result.current.retry!());
    await settle();
    expect(result.current.status).toBe("allowed");
    const issued = result.current.lease;
    jest.mocked(unlockPosDb).mockClear();
    old.resolve({ data: { user: { id: "actor-a" } }, error: null });
    await settle();
    expect(result.current.lease).toBe(issued);
    expect(unlockPosDb).not.toHaveBeenCalled();
  });

  it.each(["SIGNED_IN", "INITIAL_SESSION"])("keeps a verified same-actor cart mounted on %s", async (event) => {
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    const issued = result.current.lease!;
    auth.mockReturnValue(new Promise(() => {}));
    jest.mocked(lockPosDb).mockClear();
    act(() => { authChange(event, { user: { id: "actor-a" } }); jest.advanceTimersByTime(0); });
    await settle();
    expect(result.current.status).toBe("allowed");
    expect(result.current.lease).toBe(issued);
    expect(lockPosDb).not.toHaveBeenCalled();
  });

  it("fences an empty initial session without purging a previously verified cart", async () => {
    localStorage.setItem("pos-location-scope-v1", JSON.stringify(["actor-a", "site-a", "collaborator"]));
    const pending = deferred<{ data: { user: { id: string } }; error: null }>();
    auth.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    act(() => { authChange("INITIAL_SESSION", null); jest.advanceTimersByTime(0); });
    await settle();
    expect(clearPosPrivateData).not.toHaveBeenCalled();
    expect(unlockPosDb).not.toHaveBeenCalled();
    pending.resolve({ data: { user: { id: "actor-a" } }, error: null });
    await settle();
    act(() => jest.advanceTimersByTime(0));
    await settle();
    expect(result.current.status).toBe("allowed");
    expect(clearPosPrivateData).not.toHaveBeenCalled();
    auth.mockResolvedValue({ data: { user: null }, error: null });
    act(() => { authChange("SIGNED_OUT", null); jest.advanceTimersByTime(0); });
    await settle();
    expect(result.current.status).not.toBe("allowed");
    expect(clearPosPrivateData).toHaveBeenCalled();
  });

  it.each(["auth", "site"])("bounds pending %s context without deleting drafts", async (context) => {
    localStorage.setItem("pos-location-scope-v1", JSON.stringify(["actor-a", "site-a", "collaborator"]));
    const { result } = renderHook(() => usePosLocationAccess(context === "site" ? undefined : "site-a", "actor-a", context === "auth"));
    await settle();
    expect(result.current.status).toBe("checking");
    act(() => jest.advanceTimersByTime(8_000));
    await settle();
    expect(result.current.status).toBe("unavailable");
    expect(clearPosPrivateData).not.toHaveBeenCalled();
  });

  it.each([null, undefined, "false", [], true])("fails closed for restriction value %p", async (value) => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "current_user_site_role" ? "owner" : value, error: null }));
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    expect(result.current.status).not.toBe("allowed");
    expect(unlockPosDb).not.toHaveBeenCalled();
  });

  it("denies a nonmember even when restrictions are false", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    expect(result.current.status).toBe("unavailable");
  });

  it.each(["focus", "interval"])("revokes and clears private data when restrictions change on %s", async (trigger) => {
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    jest.mocked(clearPosPrivateData).mockClear();
    rpc.mockImplementation(async (name: string) => ({ data: name === "current_user_site_role" ? "collaborator" : true, error: null }));
    act(() => { if (trigger === "focus") window.dispatchEvent(new Event("focus")); else jest.advanceTimersByTime(30_000); });
    await settle();
    expect(result.current.status).toBe("restricted");
    expect(clearPosPrivateData).toHaveBeenCalledTimes(1);
    expect(getPosPermissionLease()).toBeNull();
  });

  it("requires an actual downloaded snapshot for offline startup, preserving same-owner unconfirmed work", async () => {
    localStorage.setItem("pos-location-scope-v1", JSON.stringify(["actor-a", "site-a", "collaborator"]));
    online(false);
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    expect(result.current.status).toBe("unavailable");
    expect(auth).not.toHaveBeenCalled();
    expect(unlockPosDb).not.toHaveBeenCalled();
    expect(clearPosPrivateData).not.toHaveBeenCalled();
  });

  it("does not mistake the loading auth context for a sign-out and discard drafts", async () => {
    localStorage.setItem("pos-location-scope-v1", JSON.stringify(["actor-a", "site-a", "collaborator"]));
    const { result, rerender } = renderHook(({ user, loading }: { user?: string; loading: boolean }) => usePosLocationAccess("site-a", user, loading), {
      initialProps: { user: undefined, loading: true } as { user?: string; loading: boolean },
    });
    await settle();
    expect(result.current.status).toBe("checking");
    expect(clearPosPrivateData).not.toHaveBeenCalled();
    rerender({ user: "actor-a", loading: false });
    await settle();
    expect(result.current.status).toBe("allowed");
    expect(clearPosPrivateData).not.toHaveBeenCalled();
  });

  it("keeps the downloaded POS and cart generation available offline and rechecks on reconnect", async () => {
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    const generation = result.current.lease?.generation;
    jest.mocked(hasPosCachedSnapshot).mockResolvedValue(true);
    jest.mocked(clearPosPrivateData).mockClear();
    jest.mocked(lockPosDb).mockClear();
    act(() => { online(false); window.dispatchEvent(new Event("offline")); });
    await settle();
    expect(result.current).toMatchObject({ status: "allowed", lease: { generation, offline: true } });
    expect(lockPosDb).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(120_000));
    await settle();
    expect(result.current.status).toBe("allowed");
    act(() => { online(true); window.dispatchEvent(new Event("online")); });
    await settle();
    expect(result.current.status).toBe("allowed");
    expect(result.current.lease?.generation).toBe(generation);
    expect(result.current.lease?.offline).not.toBe(true);
    expect(clearPosPrivateData).not.toHaveBeenCalled();
  });

  it("restores downloaded data on offline startup without contacting auth or permissions", async () => {
    localStorage.setItem("pos-location-scope-v1", JSON.stringify(["actor-a", "site-a", "collaborator"]));
    jest.mocked(hasPosCachedSnapshot).mockResolvedValue(true);
    online(false);
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    expect(result.current).toMatchObject({ status: "allowed", lease: { offline: true } });
    expect(auth).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(clearPosPrivateData).not.toHaveBeenCalled();
  });

  it.each(["auth", "permissions", "timeout"])("uses downloaded data on %s transport loss even if the browser reports online", async (lane) => {
    localStorage.setItem("pos-location-scope-v1", JSON.stringify(["actor-a", "site-a", "collaborator"]));
    jest.mocked(hasPosCachedSnapshot).mockResolvedValue(true);
    if (lane === "auth") auth.mockRejectedValue(new TypeError("Failed to fetch"));
    if (lane === "permissions") rpc.mockResolvedValue({ data: null, error: { message: "TypeError: Failed to fetch" } });
    if (lane === "timeout") auth.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    if (lane === "timeout") { act(() => jest.advanceTimersByTime(8_000)); await settle(); }
    expect(result.current).toMatchObject({ status: "allowed", lease: { offline: true } });
  });

  it("does not use downloaded data for an explicit auth rejection", async () => {
    localStorage.setItem("pos-location-scope-v1", JSON.stringify(["actor-a", "site-a", "collaborator"]));
    jest.mocked(hasPosCachedSnapshot).mockResolvedValue(true);
    auth.mockResolvedValue({ data: { user: null }, error: { status: 401, message: "Invalid session" } });
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    expect(result.current.status).toBe("unavailable");
    expect(unlockPosDb).not.toHaveBeenCalled();
  });

  it("revokes a cached local grant when reconnect confirms location restrictions", async () => {
    localStorage.setItem("pos-location-scope-v1", JSON.stringify(["actor-a", "site-a", "collaborator"]));
    jest.mocked(hasPosCachedSnapshot).mockResolvedValue(true);
    online(false);
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    expect(result.current.status).toBe("allowed");
    rpc.mockImplementation(async (name: string) => ({ data: name === "current_user_site_role" ? "collaborator" : true, error: null }));
    act(() => { online(true); window.dispatchEvent(new Event("online")); });
    await settle();
    expect(result.current.status).toBe("restricted");
    expect(getPosPermissionLease()).toBeNull();
    expect(clearPosPrivateData).toHaveBeenCalled();
  });

  it("ignores a stale site response and serializes the purge before opening a new scope", async () => {
    const old = deferred<{ data: boolean; error: null }>();
    rpc.mockImplementation((name: string, args?: { p_site_id: string }) => {
      if (name === "current_user_has_site_location_restrictions" && args?.p_site_id === "site-a") return old.promise;
      return Promise.resolve({ data: name === "current_user_site_role" ? "collaborator" : false, error: null });
    });
    const { result, rerender } = renderHook(({ site }) => usePosLocationAccess(site, "actor-a"), { initialProps: { site: "site-a" } });
    await settle();
    const purge = deferred<void>();
    jest.mocked(clearPosPrivateData).mockImplementationOnce(() => purge.promise);
    rerender({ site: "site-b" });
    await settle();
    expect(unlockPosDb).not.toHaveBeenCalled();
    purge.resolve();
    await settle();
    expect(result.current.lease?.siteId).toBe("site-b");
    old.resolve({ data: true, error: null });
    await settle();
    expect(result.current.lease?.siteId).toBe("site-b");
  });

  it("auth switch locks synchronously, purges and never grants using the previous actor", async () => {
    const { result, rerender } = renderHook(({ user }) => usePosLocationAccess("site-a", user), { initialProps: { user: "actor-a" } });
    await settle();
    jest.mocked(clearPosPrivateData).mockClear();
    act(() => authChange("SIGNED_IN", { user: { id: "actor-b" } }));
    expect(lockPosDb).toHaveBeenCalled();
    expect(result.current.status).toBe("checking");
    auth.mockResolvedValue({ data: { user: { id: "actor-b" } }, error: null });
    rerender({ user: "actor-b" });
    await settle();
    expect(result.current.lease?.userId).toBe("actor-b");
    expect(clearPosPrivateData).toHaveBeenCalled();
  });

  it("expires a hanging recheck after the deadline and ignores its late allow", async () => {
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    const pending = deferred<{ data: boolean; error: null }>();
    rpc.mockReturnValue(pending.promise);
    act(() => window.dispatchEvent(new Event("focus")));
    await settle();
    act(() => jest.advanceTimersByTime(8_000));
    await settle();
    expect(result.current.status).toBe("unavailable");
    pending.resolve({ data: false, error: null });
    await settle();
    expect(result.current.status).toBe("unavailable");
  });

  it("cannot extend a hanging grant by repeated focus events", async () => {
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    rpc.mockReturnValue(new Promise(() => {}));
    for (let i = 0; i < 6; i++) {
      act(() => { jest.advanceTimersByTime(6_000); window.dispatchEvent(new Event("focus")); });
      await settle();
    }
    act(() => jest.advanceTimersByTime(2_000));
    await settle();
    expect(result.current.status).toBe("unavailable");
    expect(getPosPermissionLease()).toBeNull();
  });

  it("expires on elapsed time despite wall-clock rollback and repeated hanging focus checks", async () => {
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    const issued = result.current.lease!;
    rpc.mockReturnValue(new Promise(() => {}));
    jest.setSystemTime(Date.now() - 3_600_000);
    for (let i = 0; i < 6; i++) {
      act(() => { jest.advanceTimersByTime(6_000); window.dispatchEvent(new Event("focus")); });
      await settle();
    }
    act(() => jest.advanceTimersByTime(2_000));
    expect(Date.now()).toBeLessThan(issued.expiresAt);
    expect(getPosPermissionLease()).toBeNull();
    expect(result.current.status).toBe("unavailable");
    expect(lockPosDb).toHaveBeenCalled();
  });

  it("keeps a same-actor TOKEN_REFRESHED lease generation while verifying in the background", async () => {
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    const issued = result.current.lease!;
    const pending = deferred<{ data: boolean; error: null }>();
    rpc.mockImplementation((name: string) => name === "current_user_site_role" ? Promise.resolve({ data: "collaborator", error: null }) : pending.promise);
    jest.mocked(lockPosDb).mockClear();
    act(() => { authChange("TOKEN_REFRESHED", { user: { id: "actor-a" } }); jest.advanceTimersByTime(0); });
    await settle();
    expect(result.current.status).toBe("allowed");
    expect(result.current.lease).toBe(issued);
    expect(lockPosDb).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1_000));
    pending.resolve({ data: false, error: null });
    await settle();
    expect(result.current.lease?.generation).toBe(issued.generation);
    expect(result.current.lease?.expiresAt).toBeGreaterThan(issued.expiresAt);
  });

  it("does not let the old issued-lease timer expire a successful renewal", async () => {
    const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
    await settle();
    const generation = result.current.lease?.generation;
    act(() => jest.advanceTimersByTime(30_000));
    await settle();
    expect(result.current.lease?.generation).toBe(generation);
    act(() => jest.advanceTimersByTime(8_000));
    await settle();
    expect(result.current.status).toBe("allowed");
    expect(getPosPermissionLease()?.generation).toBe(generation);
  });
});