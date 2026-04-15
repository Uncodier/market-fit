import { useState, useEffect, useCallback, RefObject } from 'react'

/**
 * Tracks the URL displayed in the browser bar for an iframe.
 *
 * For same-origin content the URL is read on each load event.
 * For cross-origin content (the common case with Vercel previews)
 * it shows the base source URL.
 */
export function useIframeUrl(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  sourceUrl: string
) {
  const [displayUrl, setDisplayUrl] = useState(sourceUrl)

  useEffect(() => {
    setDisplayUrl(sourceUrl)
  }, [sourceUrl])

  const handleIframeLoad = useCallback(
    (e: React.SyntheticEvent<HTMLIFrameElement>) => {
      try {
        const url = e.currentTarget.contentWindow?.location.href
        if (url && url !== 'about:blank') {
          setDisplayUrl(url)
        }
      } catch {
        // Cross-origin – keep the source URL
      }
    },
    []
  )

  return { displayUrl, iframeSrc: sourceUrl, handleIframeLoad }
}
