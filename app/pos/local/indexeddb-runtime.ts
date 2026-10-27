type NativeDependencies = {
  indexedDB?: IDBFactory | null;
  IDBKeyRange?: typeof IDBKeyRange | null;
};

type BrowserStorage = typeof globalThis & {
  webkitIndexedDB?: IDBFactory;
  mozIndexedDB?: IDBFactory;
  msIndexedDB?: IDBFactory;
  webkitIDBKeyRange?: typeof IDBKeyRange;
};

/** Reuse the browser's factory, never an in-memory database or another origin.
 * Dexie captures native dependencies on import, but its Safari readiness check
 * reads the unqualified indexedDB global. Restore that alias if it disappeared.
 * A throwing browser getter is a denial and must not trigger a fallback.
 */
export function resolvePosIndexedDB(captured: NativeDependencies): { indexedDB: IDBFactory; IDBKeyRange: typeof IDBKeyRange } {
  const browser = globalThis as BrowserStorage;
  const exposed = browser.indexedDB;
  const factory = exposed ?? browser.webkitIndexedDB ?? browser.mozIndexedDB ??
    browser.msIndexedDB ?? captured.indexedDB;
  const keyRange = browser.IDBKeyRange ?? browser.webkitIDBKeyRange ?? captured.IDBKeyRange;
  if (!factory || typeof factory.open !== "function" || !keyRange) {
    const error = new Error("This browser context does not expose native IndexedDB storage");
    error.name = "MissingAPIError";
    throw error;
  }
  if (!exposed) {
    // Required by Dexie 4.4.4's idbReady(), even with explicit DB options.
    Object.defineProperty(browser, "indexedDB", {
      configurable: true, enumerable: true, value: factory,
    });
  }
  return { indexedDB: factory, IDBKeyRange: keyRange };
}