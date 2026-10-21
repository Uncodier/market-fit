import { redirect } from "next/navigation"

export default function LocationAccessPage() {
  // Record assignment is temporarily hidden; keep existing bookmarks safe.
  redirect("/settings?tab=team")
}