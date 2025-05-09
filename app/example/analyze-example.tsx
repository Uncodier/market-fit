"use client"

import { useEffect } from "react"
import { useAnalyze } from "@/app/context/AnalyzeContext"

export default function AnalyzeExample() {
  const { setShowAnalyzeButton } = useAnalyze()
  
  // Show the Analyze button when this component mounts
  useEffect(() => {
    // Enable the button when component mounts
    setShowAnalyzeButton(true)
    
    // Disable the button when component unmounts
    return () => {
      setShowAnalyzeButton(false)
    }
  }, [setShowAnalyzeButton])
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Analyze Example Page</h1>
      <p className="mb-4">
        This page demonstrates how to use the AnalyzeWithAI button. The button is now visible in the top bar.
      </p>
      <p>
        You can also trigger the analyze function programmatically from any component using the useAnalyze hook:
      </p>
      <pre className="bg-muted p-4 rounded-md mt-4">
        {`
import { useAnalyze } from "@/app/context/AnalyzeContext"

export function MyComponent() {
  const { setShowAnalyzeButton } = useAnalyze()
  
  // Show analyze button
  const handleEnableAnalyze = () => {
    setShowAnalyzeButton(true)
  }
  
  // Hide analyze button
  const handleDisableAnalyze = () => {
    setShowAnalyzeButton(false)
  }
  
  return (
    <div>
      <button onClick={handleEnableAnalyze}>Show Analyze Button</button>
      <button onClick={handleDisableAnalyze}>Hide Analyze Button</button>
    </div>
  )
}
        `}
      </pre>
    </div>
  )
} 