import React from 'react'
import { Eye, EyeOff, Code, LayoutGrid, Zap } from "@/app/components/ui/icons"
import { InstanceLog } from '../types'
import { getToolName, getToolResult, formatBase64Image } from '../utils'
import { renderObjectWithImages } from '../render-helpers'

interface ToolCallItemProps {
  log: InstanceLog
  isDarkMode: boolean
  collapsedToolDetails: Set<string>
  onToggleToolDetails: (logId: string) => void
}

// Helper function to render tool icon
const renderToolIcon = (toolName: string) => {
  switch (toolName.toLowerCase()) {
    case 'computer':
      return <Code className="h-3.5 w-3.5" />
    case 'structured_output':
      return <LayoutGrid className="h-3.5 w-3.5" />
    default:
      return <Zap className="h-3.5 w-3.5" />
  }
}

export const ToolCallItem: React.FC<ToolCallItemProps> = ({
  log,
  isDarkMode,
  collapsedToolDetails,
  onToggleToolDetails
}) => {
  const toolName = getToolName(log)
  const toolResult = getToolResult(log)


  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div 
        className="rounded-lg p-3 text-xs cursor-pointer hover:opacity-80 transition-all duration-200 ease-in-out"
        style={{ 
          backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
          borderLeft: '3px solid var(--primary)',
          borderTop: 'none',
          borderRight: 'none',
          borderBottom: 'none',
          boxShadow: 'none', 
          outline: 'none',
          filter: 'none'
        }}
        onClick={() => onToggleToolDetails(log.id)}
        title={collapsedToolDetails.has(log.id) ? "Click to show details" : "Click to hide details"}
      >
        <div className="flex items-center gap-2">
          {toolName && renderToolIcon(toolName)}
          <span className="font-medium text-muted-foreground">
            {log.log_type === 'tool_call' ? 'Tool Call' : 'Tool Result'}: {toolName || 'Unknown'}
          </span>
          {log.message && (
            <span className="text-muted-foreground/70 ml-2">
              - {log.message}
            </span>
          )}
          <div className="ml-auto">
            {collapsedToolDetails.has(log.id) ? (
              <Eye className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
            ) : (
              <EyeOff className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
            )}
          </div>
        </div>

        {/* Tool details - only show when NOT collapsed (default to collapsed) */}
        {!collapsedToolDetails.has(log.id) && (
          <>
            {log.screenshot_base64 && (
              <div className="mt-2 text-muted-foreground">
                <strong>Screenshot:</strong>
                <div className="mt-2">
                  <img 
                    src={formatBase64Image(log.screenshot_base64)} 
                    alt="Tool Screenshot" 
                    className="w-full h-auto rounded border shadow-sm"
                    style={{ maxHeight: '400px' }}
                  />
                </div>
              </div>
            )}
            {toolResult && Object.keys(toolResult).length > 0 && (
              <div className="mt-2 text-muted-foreground">
                <strong>Result:</strong> 
                <div className="mt-1">
                  {renderObjectWithImages(toolResult)}
                </div>
              </div>
            )}
            {log.details && Object.keys(log.details).length > 0 && (
              <div className="mt-3 text-muted-foreground">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-3.5 w-3.5 text-blue-600" />
                  <strong className="text-sm text-blue-600">Details Overview:</strong>
                </div>
                <div 
                  className="rounded-lg p-3"
                  style={{ 
                    backgroundColor: isDarkMode ? '#1a1a2e' : '#f8f9fa',
                    border: 'none', 
                    boxShadow: 'none', 
                    outline: 'none',
                    filter: 'none'
                  }}
                >
                  {renderObjectWithImages(log.details)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
