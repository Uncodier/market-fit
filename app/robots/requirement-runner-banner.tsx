"use client"

import Link from 'next/link'
import useSWR from 'swr'
import { useRobots } from '@/app/context/RobotsContext'
import { createClient } from '@/lib/supabase/client'
import { robotsInstanceHref } from '@/lib/navigation/robots-instance'
import { linkedRunnerId, requirementIdFromRobotName } from './requirement-runner-link'

/** Navigation only: never changes ownership, archive state or dispatches work. */
export function RequirementRunnerBanner({ instance, siteId }: {
  instance: { id: string; name?: string } | null
  siteId?: string
}) {
  const { getAllInstances } = useRobots()
  const requirementId = requirementIdFromRobotName(instance?.name)
  const { data, error } = useSWR(
    siteId && requirementId ? ['requirement-runner-link', siteId, requirementId] : null,
    async ([, site, id]: string[]) => {
      const { data: row, error: queryError } = await createClient().from('requirements')
        .select('metadata').eq('id', id).eq('site_id', site)
        .abortSignal(AbortSignal.timeout(8000)).maybeSingle()
      if (queryError) throw new Error('Linked executor could not be checked.')
      return { runnerId: linkedRunnerId(row?.metadata) }
    },
    { refreshInterval: 15000 },
  )
  if (!requirementId || !siteId || (!error && !data?.runnerId)) return null
  const runner = getAllInstances(true).find(row => row.id === data?.runnerId && row.site_id === siteId)
  if (!error && runner && runner.id === instance?.id && !runner.is_archived) return null
  const unavailable = error || !runner || runner.is_archived
  return (
    <aside aria-label="Requirement executor" className="absolute inset-x-3 z-40 rounded-lg border bg-background/95 p-3 text-sm shadow-sm"
      style={{ top: 'calc(var(--topbar-height, 64px) + 112px)' }}>
      <p>{unavailable
        ? runner?.is_archived ? 'The linked executor is archived. It has not been restored or replaced.'
          : 'The linked executor is unavailable or could not be checked. No replacement has been started.'
        : 'This is a related conversation. Requirement execution and its feedback conversation are on the linked executor.'}</p>
      <div className="mt-2 flex flex-wrap gap-4">
        {!unavailable && runner && <Link className="underline" href={robotsInstanceHref(runner.id, { name: runner.requirement_title || runner.name })}>
          Open executor and send feedback
        </Link>}
        <Link className="underline" href={`/requirements/${requirementId}`}>View requirement</Link>
      </div>
    </aside>
  )
}