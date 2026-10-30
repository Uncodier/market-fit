'use client'

import { useEffect, useRef, useState } from 'react'
import { emptyStudyProgress, readStudyProgress, type StudyProgress } from './course-model'

export function useStudyProgress(storageKey: string, count: number) {
  const [progress, setProgress] = useState(emptyStudyProgress)
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const latest = useRef(progress)

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const restored = readStudyProgress(localStorage.getItem(storageKey), count)
        latest.current = restored
        setProgress(restored)
      } catch { setStorageError(true) }
      setReady(true)
    }, 0)
    return () => clearTimeout(timer)
  }, [storageKey, count])

  useEffect(() => {
    if (!ready) return
    latest.current = progress
    const persist = () => {
      try { localStorage.setItem(storageKey, JSON.stringify(latest.current)); setStorageError(false) }
      catch { setStorageError(true) }
    }
    const timer = setTimeout(persist, 400)
    const onHide = () => { if (document.visibilityState === 'hidden') persist() }
    window.addEventListener('pagehide', persist)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pagehide', persist)
      document.removeEventListener('visibilitychange', onHide)
      // Flush pending edits before a route change without updating unmounted state.
      try { localStorage.setItem(storageKey, JSON.stringify(latest.current)) } catch { /* Session state remains usable. */ }
    }
  }, [ready, storageKey, progress])

  function update(change: (previous: StudyProgress) => StudyProgress) {
    setProgress(previous => {
      const next = change(previous)
      latest.current = next
      return next
    })
  }

  return { progress, update, ready, storageError }
}