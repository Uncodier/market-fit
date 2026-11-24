import type { RoundRobinCalendar } from '@/app/context/site-types'
import { siteMembersService } from '@/app/services/site-members-service'
import { createClient } from '@/lib/supabase/client'
import { useDialogRead } from './use-dialog-read'

interface TaskSchedule {
  id: string; name: string; label: string; duration_minutes: number; location: string | null
}
interface ProfileCalendars {
  name?: string | null
  settings?: { calendar?: { event_types?: Array<{ id: string; title: string; duration?: number; location?: string }> } }
}
async function readMembers(siteId: string, signal: AbortSignal) {
  const users = await siteMembersService.getAssigneeOptions(siteId)
  const schedules: TaskSchedule[] = []
  if (users.length && !signal.aborted) {
    const { data, error } = await createClient().from('profiles').select('id, name, settings')
      .in('id', users.map(u => u.id)).abortSignal(signal)
    if (error || !Array.isArray(data)) throw new Error('Member calendars unavailable')
    for (const profile of data as ProfileCalendars[]) {
      for (const event of profile.settings?.calendar?.event_types ?? []) {
        schedules.push({ id: event.id, name: event.title, duration_minutes: event.duration || 30,
          label: `${event.title} (${profile.name || 'User'})`, location: event.location || null })
      }
    }
  }
  return { users, schedules }
}

async function readLeads(siteId: string, signal: AbortSignal): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await createClient().from('leads').select('id, name').eq('site_id', siteId).abortSignal(signal)
  if (error || !Array.isArray(data)) throw new Error('Lead options unavailable')
  return data
}

export function useTaskDialogOptions(siteId: string | null, teamCalendars?: RoundRobinCalendar[] | null) {
  const members = useDialogRead(siteId, readMembers)
  const leads = useDialogRead(siteId, readLeads)
  const schedules = (siteId ? teamCalendars ?? [] : []).map(cal => ({ id: cal.id, name: cal.name,
    label: `${cal.name} (Team)`, duration_minutes: cal.duration || 30, location: cal.location || null,
  })).concat(members.data?.schedules ?? [])
  return {
    users: members.data?.users ?? [], leads: leads.data ?? [], schedules,
    ready: !!members.data && !!leads.data,
    error: [members.failed && 'team members and calendars', leads.failed && 'leads'].filter(Boolean).join(' and '),
    retry: () => {
      if (members.failed) members.retry()
      if (leads.failed) leads.retry()
    },
  }
}