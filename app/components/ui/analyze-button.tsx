"use client"

import { Button } from "./button"
import { useAnalyze } from "@/app/context/AnalyzeContext"
import { toast } from "sonner"
import { useState } from "react"

// Import Brain icon from our own icons library to represent AI
import { BarChart } from "./icons"

interface AnalyzeButtonProps {
  onAnalyze?: () => Promise<void>
  customLabel?: string
}

export function AnalyzeButton({ onAnalyze, customLabel }: AnalyzeButtonProps) {
  const { showAnalyzeButton } = useAnalyze()
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleAnalyze = async () => {
    if (isAnalyzing) return

    setIsAnalyzing(true)
    try {
      if (onAnalyze) {
        await onAnalyze()
      } else {
        // Default behavior if no custom handler provided
        await new Promise(resolve => setTimeout(resolve, 2000))
        toast.success("Analysis completed successfully")
      }
    } catch (error) {
      console.error("Analysis error:", error)
      toast.error("Analysis failed. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (!showAnalyzeButton) return null

  return (
    <Button 
      variant="secondary" 
      size="default"
      className="flex items-center gap-2 hover:bg-primary/10 transition-all duration-200"
      onClick={handleAnalyze}
      disabled={isAnalyzing}
    >
      {isAnalyzing ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
          Analyzing...
        </>
      ) : (
        <>
          <BarChart className="h-4 w-4" />
          {customLabel || "Analyze with AI"}
        </>
      )}
    </Button>
  )
} 