"use client"

import { useVersionCheck } from "@/app/hooks/use-version-check"

export default function VersionCheck() {
  useVersionCheck()
  return null
}
