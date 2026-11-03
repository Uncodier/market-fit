"use client"

import { useMemo } from 'react'

export function isPreviewableHtml(path: string): boolean {
  return /\.html?$/i.test(path)
}

/** Static preview only: generated HTML never executes in the authenticated app origin. */
export function buildArchivePreview(content: string): string {
  const document = new DOMParser().parseFromString(content, 'text/html')
  document.querySelectorAll('base, meta[http-equiv], script, iframe, object, embed').forEach(node => node.remove())
  const policy = document.createElement('meta')
  policy.httpEquiv = 'Content-Security-Policy'
  policy.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https:; img-src data: https:; font-src data: https:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
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
    sandbox=""
    referrerPolicy="no-referrer"
    className="h-full w-full border-0 bg-white"
  />
}