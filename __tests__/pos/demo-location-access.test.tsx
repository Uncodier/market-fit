import { act, renderHook } from "@testing-library/react";
import { usePosLocationAccess } from "@/app/pos/hooks/use-pos-location-access";
import { createClient } from "@/lib/supabase/client";
import { createDemoMockClient } from "@/lib/demo-data/mock-client";
import { suspendPosPermission } from "@/app/pos/local/location-permission-state";
import { clearPosPrivateData, hasPosCachedSnapshot, preparePosStorage, unlockPosDb } from "@/app/pos/local/db";

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({
  clearPosPrivateData: jest.fn(), preparePosStorage: jest.fn(), hasPosCachedSnapshot: jest.fn(),
  lockPosDb: jest.fn(), unlockPosDb: jest.fn(),
}));

describe("POS access with the actual lazy demo adapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    suspendPosPermission();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    jest.mocked(preparePosStorage).mockResolvedValue(undefined);
    jest.mocked(clearPosPrivateData).mockResolvedValue(undefined);
    jest.mocked(hasPosCachedSnapshot).mockResolvedValue(false);
  });

  it.each(["demo-habituall", "demo-saas-en-123", "demo-ecom-es-456"])("allows only the verified fixture actor for %s", async siteId => {
    const client = createDemoMockClient(siteId);
    const actor = (await client.auth.getUser()).data.user;
    jest.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
    const view = renderHook(() => usePosLocationAccess(siteId, actor.id));
    await act(async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); });
    expect(view.result.current.status).toBe("allowed");
    expect(view.result.current.lease).toMatchObject({ siteId, userId: actor.id, role: "owner" });
    expect(unlockPosDb).toHaveBeenCalled();
    view.unmount();
  });

  it("never unlocks a real or foreign site using demo identity", async () => {
    const client = createDemoMockClient("demo-habituall");
    const actor = (await client.auth.getUser()).data.user;
    jest.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
    const view = renderHook(() => usePosLocationAccess("11111111-1111-4111-8111-111111111111", actor.id));
    await act(async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); });
    expect(view.result.current.status).not.toBe("allowed");
    expect(unlockPosDb).not.toHaveBeenCalled();
    view.unmount();
  });
});