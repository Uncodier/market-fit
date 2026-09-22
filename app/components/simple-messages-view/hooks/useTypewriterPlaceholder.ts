import { useEffect, useState } from 'react'

interface UseTypewriterPlaceholderOptions {
  phrases: readonly string[]
  enabled: boolean
  typingDelay?: number
  deletingDelay?: number
  pauseDelay?: number
  betweenPhrasesDelay?: number
}

export function useTypewriterPlaceholder({
  phrases,
  enabled,
  typingDelay = 55,
  deletingDelay = 28,
  pauseDelay = 1600,
  betweenPhrasesDelay = 300,
}: UseTypewriterPlaceholderOptions) {
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [characterCount, setCharacterCount] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  const currentPhrase = phrases[phraseIndex % phrases.length] ?? ''

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener?.('change', updatePreference)

    return () => mediaQuery.removeEventListener?.('change', updatePreference)
  }, [])

  useEffect(() => {
    if (!enabled || prefersReducedMotion || !currentPhrase) return

    let delay = typingDelay
    let advance: () => void

    if (!isDeleting && characterCount < currentPhrase.length) {
      advance = () => setCharacterCount((count) => count + 1)
    } else if (!isDeleting) {
      delay = pauseDelay
      advance = () => setIsDeleting(true)
    } else if (characterCount > 0) {
      delay = deletingDelay
      advance = () => setCharacterCount((count) => Math.max(0, count - 1))
    } else {
      delay = betweenPhrasesDelay
      advance = () => {
        setPhraseIndex((index) => (index + 1) % phrases.length)
        setIsDeleting(false)
      }
    }

    const timeoutId = window.setTimeout(advance, delay)
    return () => window.clearTimeout(timeoutId)
  }, [
    betweenPhrasesDelay,
    characterCount,
    currentPhrase,
    deletingDelay,
    enabled,
    isDeleting,
    pauseDelay,
    phrases.length,
    prefersReducedMotion,
    typingDelay,
  ])

  if (!enabled) return ''
  if (prefersReducedMotion) return phrases[0] ?? ''
  return currentPhrase.slice(0, characterCount)
}
