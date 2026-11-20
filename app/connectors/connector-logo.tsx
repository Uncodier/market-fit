"use client"

import { useState } from "react"
import Image from "next/image"
import { Plug } from "@/app/components/ui/icons"

/** Public provider assets only; never send workspace credentials or a referrer. */
export function ConnectorLogo({ src, name, compact = false }: { src: string | null; name: string; compact?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null)
  let safe: string | null = null
  try {
    const url = new URL(src || "")
    if (url.protocol === "https:" && !url.username && !url.password && !url.port && !url.search && !url.hash &&
      ["logos.composio.dev", "cdn.composio.dev", "assets.composio.dev"].includes(url.hostname)) safe = url.href
  } catch { /* Missing logos use the standard connector icon. */ }
  const size = compact ? 16 : 32
  return <span className={compact ? 'flex size-5 shrink-0 items-center justify-center' : 'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted p-2'}>
    {safe && failed !== safe ? <Image src={safe} alt={compact ? '' : `${name} logo`} width={size} height={size} unoptimized
      className={compact ? 'size-4 object-contain' : 'h-8 w-8 object-contain'} referrerPolicy="no-referrer" onError={() => setFailed(safe)} />
      : <Plug aria-hidden={true} className={compact ? 'size-4' : 'h-6 w-6'} />}
  </span>
}

export function connectorToolkitLogo(slug: string) {
  return /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(slug) ? `https://logos.composio.dev/api/${slug}` : null
}