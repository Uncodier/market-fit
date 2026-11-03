import { useMemo } from 'react'
import useSWR from 'swr'
import type { InstanceLog } from '@/app/components/simple-messages-view/types'
import { cloudToolDeliverables } from './cloud-tool-deliverables'

const EMPTY_LOGS: InstanceLog[] = []

/** Passive subscriber to the chat's existing cache: no fetcher, polling or realtime channel. */
export function useCloudToolDeliverables(instanceId: string | null, siteId: string | null) {
  const { data } = useSWR<InstanceLog[]>(instanceId && siteId ? ['instance_logs', instanceId] : null, null, {
    fetcher: undefined,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  })
  const logs = data ?? EMPTY_LOGS
  return useMemo(() => instanceId && siteId ? cloudToolDeliverables(logs, instanceId, siteId) : [],
    [logs, instanceId, siteId])
}