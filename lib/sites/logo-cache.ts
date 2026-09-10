const DB_NAME = 'market-fit-site-logos'
const STORE_NAME = 'logos'
const VERSION = 1

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('IndexedDB not available'))
    }
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Returns undefined if not in cache, null if cached as empty, string if cached with logo
export async function getLogoFromCache(siteId: string): Promise<string | null | undefined> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(siteId)
      request.onsuccess = () => {
        if (request.result === undefined) resolve(undefined)
        else resolve(request.result as string | null)
      }
      request.onerror = () => reject(request.error)
    })
  } catch {
    return undefined
  }
}

export async function saveLogoToCache(siteId: string, logoBase64: string | null): Promise<void> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      // We store null directly if there's no logo, so we don't fetch it again
      const request = store.put(logoBase64, siteId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch {
    // Ignore error
  }
}
