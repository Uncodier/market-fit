import { beginCatalogSync, clearCatalogSyncProgress, finishCatalogSync, getCatalogSyncProgress, setCatalogSyncPhase } from "@/app/pos/local/catalog-sync-progress";

describe("catalog synchronization measurements", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearCatalogSyncProgress();
  });
  afterEach(() => jest.useRealTimers());

  it("measures checking, downloading and local saving until completion", () => {
    beginCatalogSync("site");
    expect(getCatalogSyncProgress("site")).toMatchObject({ phase: "checking", startedAt: Date.now() });
    setCatalogSyncPhase("site", "downloading");
    jest.advanceTimersByTime(2200);
    setCatalogSyncPhase("site", "saving");
    expect(getCatalogSyncProgress("site")?.phase).toBe("saving");
    jest.advanceTimersByTime(800);
    finishCatalogSync("site", "success", true);
    expect(getCatalogSyncProgress("site")).toMatchObject({ phase: "idle", startedAt: null, error: false,
      lastSuccess: { completedAt: new Date().toISOString(), durationMs: 3000, fresh: true } });
  });

  it("does not replace the last download duration on unchanged checks or failed retries", () => {
    beginCatalogSync("site");
    jest.advanceTimersByTime(4000);
    finishCatalogSync("site", "success");
    const success = getCatalogSyncProgress("site")?.lastSuccess;
    beginCatalogSync("site");
    finishCatalogSync("site", "checked");
    expect(getCatalogSyncProgress("site")?.lastSuccess).toEqual(success);
    beginCatalogSync("site");
    jest.advanceTimersByTime(1000);
    finishCatalogSync("site", "error");
    expect(getCatalogSyncProgress("site")).toMatchObject({ error: true, lastAttemptDurationMs: 1000, lastSuccess: success });
  });

  it("isolates sites and clears measurements on permission reset", () => {
    beginCatalogSync("site");
    expect(getCatalogSyncProgress("other")).toBeUndefined();
    clearCatalogSyncProgress();
    finishCatalogSync("site", "success");
    expect(getCatalogSyncProgress("site")).toBeUndefined();
  });
});