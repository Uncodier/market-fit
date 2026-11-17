"use client"

import * as React from "react"
import { getNodeText } from "@/lib/permissions/button-heuristic"

export const DialogHasCloseContext = React.createContext(false)

// Exact labels only: actions such as "Cancel subscription" must stay visible.
const cancelLabels = new Set(["cancel", "cancelar", "annuler", "abbrechen", "キャンセル"])

export function isDialogCancelLabel(children: React.ReactNode, ariaLabel?: string) {
  const label = (ariaLabel || getNodeText(children)).replace(/\s+/g, " ").trim().toLowerCase()
  return cancelLabels.has(label)
}