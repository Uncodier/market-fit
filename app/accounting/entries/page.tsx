import { Suspense } from "react"
import { JournalEntriesClient } from "../components/JournalEntriesClient"

export default function JournalEntriesPage() {
  return (
    <Suspense fallback={null}>
      <JournalEntriesClient />
    </Suspense>
  )
}
