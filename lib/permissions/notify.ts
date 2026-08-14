import { toast } from "sonner"
import { permissionDeniedMessage } from "./error-map"
import { PERMISSION_DENIED_TITLE, type PermissionCommand } from "./types"

const TOAST_ID = "permission-denied"
const DEDUPE_MS = 2000

let lastAt = 0
let lastCommand: PermissionCommand | null = null

export function notifyPermissionDenied(command: PermissionCommand) {
  if (typeof window === "undefined") return

  const now = Date.now()
  if (lastCommand === command && now - lastAt < DEDUPE_MS) return
  lastAt = now
  lastCommand = command

  toast.error(PERMISSION_DENIED_TITLE, {
    id: TOAST_ID,
    description: permissionDeniedMessage(command),
  })
}

export function resetPermissionNotify() {
  lastAt = 0
  lastCommand = null
}
