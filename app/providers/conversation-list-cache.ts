import type { State } from 'swr'
import { isTerminalRequestError } from '@/lib/swr/retry-policy'
import { isConversationListKey } from './conversation-list-read-scope'

type Entry = State<{ denial?: unknown }> & { _k?: unknown }

const MAX_WARM_VIEWS = 12
let nextBoundary = 0

/** Owned by one live access proof in the workspace, never by browser storage.
 * Reopen with settled list data only: an aborted read or late write from a
 * retired route must not own the next route's SWR state. */
export function createConversationListCache(actor: string, site: string) {
  const warm = new Map<string, Entry>()
  let generation = 0
  return {
    key: ++nextBoundary,
    hasSnapshot: () => warm.size > 0,
    provider: () => {
      const owner = ++generation
      class RouteCache extends Map<string, Entry> {
        override set(key: string, entry: Entry) {
          // SWR keeps the original tuple in _k for predicate mutations.
          const { _k, data, error } = entry
          if (owner === generation && isConversationListKey(_k) && _k[1] === site && _k[4] === actor) {
            warm.delete(key)
            if (data?.denial || isTerminalRequestError(error)) {
              // A denied search/page invalidates other views of this inbox, too.
              this.clear()
              if (isTerminalRequestError(error)) entry = { ...entry, data: undefined }
            } else if (data !== undefined) {
              warm.set(key, { _k, data })
              if (warm.size > MAX_WARM_VIEWS) warm.delete(warm.keys().next().value!)
            }
          }
          return super.set(key, entry)
        }

        override clear() {
          if (owner === generation) warm.clear()
          super.clear()
        }

        override delete(key: string) {
          if (owner === generation) warm.delete(key)
          return super.delete(key)
        }
      }
      return new RouteCache(Array.from(warm))
    },
    keepPreviousData: false,
    revalidateOnMount: true,
  }
}
