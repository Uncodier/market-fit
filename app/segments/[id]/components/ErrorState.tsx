import React from "react"
import { Button } from "@/app/components/ui/button"
import { ChevronLeft } from "@/app/components/ui/icons"

interface ErrorStateProps {
  error: string | null
  onBack: () => void
}

export function ErrorState({ error, onBack }: ErrorStateProps) {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
      <div className="text-center space-y-4">
        <p className="text-red-500 mb-4">{error || "Segment not found"}</p>
        <Button 
          variant="outline" 
          onClick={onBack}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Segments
        </Button>
      </div>
    </div>
  )
} 