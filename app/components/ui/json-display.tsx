"use client"

import React from "react"
import { JsonHighlighter } from "@/app/components/agents/json-highlighter"

interface JsonDisplayProps {
  data: string | object | null
  maxHeight?: string
  className?: string
}

export function JsonDisplay({ data, maxHeight = "200px", className = "" }: JsonDisplayProps) {
  if (data === null) {
    return null
  }

  if (typeof data === 'string') {
    return (
      <pre className={`whitespace-pre-wrap ${className}`}>
        {data}
      </pre>
    )
  }

  return (
    <JsonHighlighter 
      data={data} 
      maxHeight={maxHeight} 
      className={className}
    />
  )
} 