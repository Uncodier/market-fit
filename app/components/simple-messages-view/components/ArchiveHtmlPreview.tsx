"use client"

import { useMemo } from 'react'

export function isPreviewableHtml(path: string): boolean {
  return /\.html?$/i.test(path)
}

/** Inline animations run only in an opaque sandbox, never in the authenticated app origin. */
export function buildArchivePreview(content: string): string {
  const document = new DOMParser().parseFromString(content, 'text/html')
  document.querySelectorAll('base, meta[http-equiv], script[src], iframe, object, embed').forEach(node => node.remove())
  const policy = document.createElement('meta')
  policy.httpEquiv = 'Content-Security-Policy'
  policy.content = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
  document.head.prepend(policy)
  const referrer = document.createElement('meta')
  referrer.name = 'referrer'
  referrer.content = 'no-referrer'
  document.head.prepend(referrer)
  return `<!doctype html>${document.documentElement.outerHTML}`
}

export function ArchiveHtmlPreview({ content, name }: { content: string; name: string }) {
  const source = useMemo(() => buildArchivePreview(content), [content])
  return <iframe
    title={`Preview: ${name}`}
    srcDoc={source}
    sandbox="allow-scripts"
    allow="fullscreen"
    referrerPolicy="no-referrer"
    className="h-full w-full border-0 bg-white"
  />
}