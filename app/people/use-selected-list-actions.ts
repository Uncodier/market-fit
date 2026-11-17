import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'
import { apiClient } from '@/app/services/api-client-service'
import { useSavedFinderLists } from './use-saved-finder-lists'

type Mode = 'add' | 'create'
interface Options {
  siteId?: string
  selectedPersonIds: string[]
  setSelectedPersonIds: (value: (previous: string[]) => string[]) => void
  refreshIcps: () => void
}

export function useSelectedListActions(options: Options) {
  const [mode, setMode] = useState<Mode | null>(null)
  const [dialogSite, setDialogSite] = useState<string | undefined>()
  const [name, setName] = useState('')
  const [listId, setListId] = useState('')
  const [people, setPeople] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const currentSite = useRef(options.siteId)
  const activeRequest = useRef(false)
  const request = useRef<{ key: string; id: string } | null>(null)
  const visibleMode = dialogSite === options.siteId ? mode : null
  const lists = useSavedFinderLists(options.siteId, visibleMode === 'add')

  useEffect(() => {
    currentSite.current = options.siteId
    request.current = null
  }, [options.siteId])

  const open = (next: Mode) => {
    if (activeRequest.current || !options.siteId) return
    const ids = [...new Set(options.selectedPersonIds)].filter(Boolean)
    if (!ids.length) return
    if (ids.length > 100) {
      toast.error('Select up to 100 people at a time.')
      return
    }
    setPeople(ids)
    setDialogSite(options.siteId)
    setName('')
    setListId('')
    request.current = null
    setMode(next)
  }
  const close = () => { if (!activeRequest.current) setMode(null) }
  const submit = async () => {
    const siteId = options.siteId
    if (activeRequest.current || !siteId || !visibleMode || !people.length) return
    if (mode === 'create' && !name.trim()) return
    if (mode === 'add' && (!listId || !lists.lists.some(list => list.id === listId))) return
    const input = { site_id: siteId, person_ids: people,
      ...(mode === 'create' ? { name: name.trim() } : {}) }
    const key = JSON.stringify({ mode, listId, ...input })
    if (request.current?.key !== key) request.current = { key, id: uuidv4() }
    activeRequest.current = true
    setPending(true)
    try {
      const result = await apiClient.post<{ added_count: number; list: { id: string } }>(
        mode === 'create' ? '/api/finder/lists' : `/api/finder/lists/${encodeURIComponent(listId)}/people`,
        { ...input, request_id: request.current.id }, { includeAuth: true },
      )
      if (!result.success) throw new Error(result.error?.message || 'Could not save selected people.')
      if (!result.data?.list?.id || !Number.isInteger(result.data.added_count)
        || result.data.added_count < 0 || result.data.added_count > people.length) {
        throw new Error('The list save could not be confirmed. Retry to check the same request.')
      }
      if (currentSite.current !== siteId) return
      toast.success(mode === 'create' ? 'List created. Selected people are queued for background enrichment.'
        : `${result.data.added_count} people added. Background enrichment will process pending entries.`)
      options.setSelectedPersonIds(previous => previous.filter(id => !people.includes(id)))
      options.refreshIcps()
      setMode(null)
      request.current = null
    } catch (error) {
      if (currentSite.current === siteId) toast.error(error instanceof Error ? error.message : 'Could not save selected people.')
    } finally {
      activeRequest.current = false
      setPending(false)
    }
  }
  return { mode: visibleMode, name, setName, listId, setListId, people, pending, lists, open, close, submit }
}

export type SelectedListActions = ReturnType<typeof useSelectedListActions>