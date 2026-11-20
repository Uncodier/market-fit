"use client"

import { useState } from "react"
import Image from "next/image"
import { Plug } from "@/app/components/ui/icons"

/** Public provider assets only; never send workspace credentials or a referrer. */
export function ConnectorLogo({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  let safe: string | null = null
  try {
    const url = new URL(src || "")
    if (url.protocol === "https:" && !url.username && !url.password && !url.port && !url.search && !url.hash &&
      ["logos.composio.dev", "cdn.composio.dev", "assets.composio.dev"].includes(url.hostname)) safe = url.href
  } catch { /* Missing logos use the standard connector icon. */ }
  return <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted p-2">
    {safe && failed !== safe ? <Image src={safe} alt={`${name} logo`} width={32} height={32} unoptimized
      className="h-8 w-8 object-contain" referrerPolicy="no-referrer" onError={() => setFailed(safe)} />
      : <Plug aria-hidden={true} className="h-6 w-6" />}
  </span>
}