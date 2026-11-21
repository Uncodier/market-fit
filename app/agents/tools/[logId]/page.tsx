import { notFound } from "next/navigation"
import { getInstanceLogById } from "@/app/agents/actions"
import { Alert } from "@/app/components/ui/alert"
import ToolDetail from "./tool-detail"

export default async function ToolDetailPage(props: { params: Promise<{ logId: string }> }) {
  const { logId } = await props.params
  const { log, error } = await getInstanceLogById(logId)
  if (error && error !== "Instance log not found") {
    return (
      <div className="px-4 py-6 md:px-16">
        <Alert variant="destructive">Unable to load this tool log. Refresh the page to try again.</Alert>
      </div>
    )
  }
  if (!log) notFound()

  return <ToolDetail log={log} logId={logId} />
}