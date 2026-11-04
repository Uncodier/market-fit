import { useMemo, useState } from 'react'
import useSWR from 'swr'
import type { InstanceLog } from '@/app/components/simple-messages-view/types'
import { cloudToolDeliverables, mergeCloudDeliverables, type CloudDeliverable } from './cloud-tool-deliverables'
import { fetchCloudToolDeliverables } from './fetch-cloud-tool-deliverables'

const EMPTY_LOGS: InstanceLog[] = []

/** Independent background history plus the chat's existing realtime cache, without polling. */
export function useCloudToolDeliverables(instanceId: string | null, siteId: string | null) {
  const scope = JSON.stringify([siteId, instanceId])
  const { data: history } = useSWR<CloudDeliverable[]>(
    instanceId && siteId ? ['instance_cloud_files', siteId, instanceId] : null,
    ([, site, instance]: [string, string, string]) => fetchCloudToolDeliverables(instance, site),
    { revalidateOnFocus: false, dedupingInterval: 60_000, errorRetryCount: 2 },
  )
  const { data } = useSWR<InstanceLog[]>(instanceId && siteId ? ['instance_logs', instanceId] : null, null, {
    fetcher: undefined,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  })
  const logs = data ?? EMPTY_LOGS
  const live = useMemo(() => instanceId && siteId ? cloudToolDeliverables(logs, instanceId, siteId) : [],
    [logs, instanceId, siteId])
  // Keep observed receipts when the chat replaces its limited window of logs.
  const [observed, setObserved] = useState({ scope, live, files: live })
  let files = observed.files
  if (observed.scope !== scope || observed.live !== live) {
    files = observed.scope === scope ? mergeCloudDeliverables(observed.files, live) : live
    setObserved({ scope, live, files })
  }
  return useMemo(() => mergeCloudDeliverables(history ?? [], files), [history, files])
}