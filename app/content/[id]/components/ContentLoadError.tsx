"use client"

import { Button } from "@/app/components/ui/button"
import { EmptyState } from "@/app/components/ui/empty-state"
import { FileText } from "@/app/components/ui/icons"

type Props = {
  message: string
  onRetry: () => void
  onBack: () => void
}

export function ContentLoadError({ message, onRetry, onBack }: Props) {
  return (
    <div role="alert">
      <EmptyState variant="simple" icon={<FileText />} title="Content unavailable"
        description={message} action={
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={onBack}>Back to Content</Button>
            <Button onClick={onRetry}>Try again</Button>
          </div>
        } />
    </div>
  )
}