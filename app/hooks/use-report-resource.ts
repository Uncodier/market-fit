"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR, { unstable_serialize, useSWRConfig, type BareFetcher } from "swr"

// Report resources do not present a cached error as the new attempt's result.
export function useReportResource<Data, RequestError = Error>(
  key: string | readonly unknown[] | null,
  fetcher: BareFetcher<Data>,
  waitingForReadiness = false,
) {
  const serializedKey = unstable_serialize(key)
  const { cache } = useSWRConfig()
  const [mountedKey, setMountedKey] = useState("")
  const initialError = useMemo(() => cache.get(serializedKey)?.error, [cache, serializedKey])
  const result = useSWR<Data, RequestError>(key, fetcher, {
    keepPreviousData: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
    dedupingInterval: 30_000,
    // Avoid SWR's deferred mount refresh when both data and an error are cached.
    revalidateIfStale: !initialError,
  })

  useEffect(() => {
    if (serializedKey) {
      const cached = cache.get(serializedKey)
      // SWR may have started an error-only retry already. Reuse that request;
      // otherwise explicitly retry, including when another subscriber exists.
      if (initialError && cached && cached.error === initialError && !cached.isValidating) void result.mutate()
    }
    setMountedKey(serializedKey)
  }, [serializedKey, cache, initialError, result.mutate])

  const isLoading = waitingForReadiness || Boolean(serializedKey && (
    mountedKey !== serializedKey || result.isLoading || result.isValidating ||
    (result.data === undefined && !result.error)
  ))
  return {
    ...result,
    isLoading,
    error: serializedKey && !isLoading ? result.error : undefined,
    data: serializedKey && !isLoading && !result.error ? result.data : undefined,
  }
}