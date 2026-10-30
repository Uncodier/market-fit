export type CourseVideo = { url: string; title?: string }

export type CourseItem = {
  name: string
  description?: string | null
  metadata?: {
    videos?: CourseVideo[]
    attributes?: { duration?: string; level?: string; language?: string }
    specs?: { label: string; value: string }[]
  }
}

export type StudyProgress = {
  lastIndex: number
  completedIndexes: number[]
  positions: Record<string, number>
  notes: Record<string, string>
}

export const emptyStudyProgress = (): StudyProgress => ({ lastIndex: 0, completedIndexes: [], positions: {}, notes: {} })

export function readStudyProgress(raw: string | null, count: number): StudyProgress {
  const empty = emptyStudyProgress()
  if (!raw) return empty
  try {
    const value = JSON.parse(raw)
    const validIndex = (index: unknown): index is number => Number.isInteger(index) && Number(index) >= 0 && Number(index) < count
    if (!value || typeof value !== 'object') return empty
    const positions: Record<string, number> = {}
    const notes: Record<string, string> = {}
    for (let index = 0; index < count; index++) {
      const position = value.positions?.[index]
      if (typeof position === 'number' && Number.isFinite(position) && position >= 0) positions[index] = position
      const note = value.notes?.[index]
      if (typeof note === 'string') notes[index] = note.slice(0, 10000)
    }
    return {
      lastIndex: validIndex(value.lastIndex) ? value.lastIndex : 0,
      completedIndexes: Array.isArray(value.completedIndexes) ? [...new Set<number>(value.completedIndexes.filter(validIndex))] : [],
      positions,
      notes,
    }
  } catch { return empty }
}

export function resolveCourseMedia(raw: string): { kind: 'video' | 'embed'; url: string } | null {
  if (/^\/course-resources\/[a-zA-Z0-9_-]+\.mp4$/.test(raw)) return { kind: 'video', url: raw }
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'].includes(url.hostname)) {
      const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]
      return id && /^[\w-]{11}$/.test(id) ? { kind: 'embed', url: `https://www.youtube-nocookie.com/embed/${id}` } : null
    }
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
      const id = url.pathname.match(/^\/(?:video\/)?(\d+)\/?$/)?.[1]
      return id ? { kind: 'embed', url: `https://player.vimeo.com/video/${id}` } : null
    }
    return { kind: 'video', url: url.href }
  } catch { return null }
}

export function formatCourseTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}