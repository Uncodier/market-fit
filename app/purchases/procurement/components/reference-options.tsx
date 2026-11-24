import { createContext, useContext, useState, type ReactNode } from 'react'

type Choices = { options: { id: string; label: string }[]; has_more: boolean }
export async function readChoices(url: string, signal: AbortSignal): Promise<Choices> {
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error('Could not load choices. Check your access or try searching again.')
  const data = await response.json()
  if (!Array.isArray(data.options)) throw new Error('Invalid reference response.')
  return data
}

// Visible saved chips may need names before their picker opens. Share the bounded first
// page by kind only within this mounted form and only while at least one field needs it.
function createBrowseReader(): typeof readChoices {
  const pages = new Map<string, { promise: Promise<Choices>; controller: AbortController; users: number }>()
  return (url, signal) => {
    if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
    let page = pages.get(url)
    if (!page) {
      const controller = new AbortController()
      page = { promise: readChoices(url, controller.signal), controller, users: 0 }
      pages.set(url, page)
      // Failures cannot supply labels or prevent a later explicit retry.
      void page.promise.catch(() => { if (pages.get(url) === page) pages.delete(url) })
    }
    const current = page
    current.users++
    signal.addEventListener('abort', () => {
      if (--current.users !== 0) return
      current.controller.abort()
      if (pages.get(url) === current) pages.delete(url)
    }, { once: true })
    return current.promise
  }
}

const BrowseContext = createContext(readChoices)
export const useReferenceBrowse = () => useContext(BrowseContext)
export function ReferenceOptions({ children }: { children: ReactNode }) {
  const [read] = useState(createBrowseReader)
  return <BrowseContext.Provider value={read}>{children}</BrowseContext.Provider>
}