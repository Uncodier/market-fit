import React from 'react'
import { InstanceLog, StructuredOutputResponse } from './types'
import { getToolResult, getStructuredStyle, isBase64Image, formatBase64Image } from './utils'
import { StructuredOutputStylesLight } from './types'
import { SessionNeededComponent } from './components/SessionNeededComponent'

// Helper function to render structured output based on tool_result.output
export const renderStructuredOutput = (log: InstanceLog, isDarkMode: boolean): React.ReactElement | null => {
  const toolResult = getToolResult(log)
  
  try {
    let structuredData: StructuredOutputResponse | null = null

    // Try to parse the output from tool_result.output
    if (toolResult?.output) {
      if (typeof toolResult.output === 'string') {
        structuredData = JSON.parse(toolResult.output)
      } else {
        structuredData = toolResult.output
      }
    }

    if (!structuredData || !structuredData.event || !StructuredOutputStylesLight[structuredData.event]) {
      return null
    }

    // Use dedicated component for session_needed events
    if (structuredData.event === 'session_needed') {
      return <SessionNeededComponent structuredData={structuredData} isDarkMode={isDarkMode} />
    }

    const style = getStructuredStyle(structuredData.event, isDarkMode)

    return (
      <div 
        className="text-xs p-3 rounded-md overflow-hidden transition-colors border"
        style={{
          borderColor: style.borderColor,
          backgroundColor: style.backgroundColor
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{style.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span 
                className="font-medium text-sm"
                style={{ color: style.color }}
              >
                {style.label}
              </span>
              {structuredData.step && (
                <span 
                  className="text-xs px-2 py-1 rounded border"
                  style={{ 
                    backgroundColor: style.color + '14',
                    color: style.color,
                    borderColor: style.color + '33'
                  }}
                >
                  Step {structuredData.step}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error parsing structured output:', error)
    return null
  }
}

// Helper function to render object with base64 images extracted
export const renderObjectWithImages = (obj: any, depth: number = 0, isBrowserVisible: boolean = false): React.ReactElement => {
  if (depth > 3) return <span>...</span> // Prevent infinite recursion
  
  if (typeof obj === 'string' && isBase64Image(obj)) {
    return (
      <div className="mt-2">
        <div className="text-xs text-gray-600 mb-1">Screenshot:</div>
        <img 
          src={formatBase64Image(obj)} 
          alt="Screenshot" 
          className={isBrowserVisible ? "w-full h-auto rounded border shadow-sm" : "max-w-[33vw] h-auto rounded border shadow-sm"}
          style={{ maxHeight: '400px', maxWidth: isBrowserVisible ? '100%' : undefined }}
        />
      </div>
    )
  }
  
  if (Array.isArray(obj)) {
    return (
      <div>
        {obj.map((item, index) => (
          <div key={index} className="mb-2">
            <div className="text-xs text-gray-600">[{index}]:</div>
            <div className="ml-2">
              {renderObjectWithImages(item, depth + 1, isBrowserVisible)}
            </div>
          </div>
        ))}
      </div>
    )
  }
  
  if (obj && typeof obj === 'object') {
    return (
      <div>
        {Object.entries(obj)
          .filter(([key]) => key !== 'provider') // Filter out provider field
          .map(([key, value]) => (
          <div key={key} className="mb-2">
            <div className="text-xs text-gray-600 font-medium">{key}:</div>
            <div className="ml-2">
              {renderObjectWithImages(value, depth + 1, isBrowserVisible)}
            </div>
          </div>
        ))}
      </div>
    )
  }
  
  return <span className="font-mono text-xs break-words whitespace-pre-wrap overflow-hidden block">{JSON.stringify(obj, null, 2)}</span>
}
