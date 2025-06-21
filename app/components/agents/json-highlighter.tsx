"use client"

import React, { useMemo } from "react"
import { Card } from "@/app/components/ui/card"

interface JsonHighlighterProps {
  data: any
  maxHeight?: string
  className?: string
  commandId?: string
}

// Maximum string length for serialized JSON to prevent UI freezing
const MAX_JSON_LENGTH = 50000; // Increased for more detailed objects

/**
 * Safely stringifies an object with circular reference detection and unlimited depth
 */
function safeStringify(obj: any, visitedObjects = new WeakSet()): string {
  try {
    // Handle primitive values
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (typeof obj !== 'object') return JSON.stringify(obj);
    
    // Check for circular references
    if (visitedObjects.has(obj)) {
      return '"[Circular Reference]"';
    }
    
    // Add to visited objects
    visitedObjects.add(obj);
    
    if (Array.isArray(obj)) {
      const arrayContent = obj.slice(0, 100).map(item => { // Increased limit
        try {
          return safeStringify(item, visitedObjects);
        } catch (e) {
          return '"[Error processing array item]"';
        }
      }).join(',');
      
      return obj.length > 100 
        ? `[${arrayContent},"... (${obj.length - 100} more items)"]` 
        : `[${arrayContent}]`;
    }
    
    // Handle objects - render all properties recursively
    const entries = Object.entries(obj).slice(0, 100); // Increased limit
    const objContent = entries.map(([key, value]) => {
      try {
        return `"${key}":${safeStringify(value, visitedObjects)}`;
      } catch (e) {
        return `"${key}":"[Error processing value]"`;
      }
    }).join(',');
    
    const hasMoreKeys = Object.keys(obj).length > 100;
    return hasMoreKeys 
      ? `{${objContent},"... (${Object.keys(obj).length - 100} more properties)"}` 
      : `{${objContent}}`;
  } catch (e) {
    return '"[Error stringifying object]"';
  }
}

export function JsonHighlighter({ data, maxHeight = "200px", className = "", commandId }: JsonHighlighterProps) {
  // Handle null/undefined data
  if (data === null || data === undefined) {
    return (
      <div className={`overflow-hidden ${className}`}>
        <p className="text-xs text-muted-foreground italic">No data available</p>
      </div>
    );
  }

  // Format data safely
  const formattedJson = useMemo(() => {
    try {
      // Use safe stringify implementation to handle circular refs and deeply nested objects
      let jsonString = safeStringify(data);
      
      // Limit maximum size to prevent UI freezing
      if (jsonString.length > MAX_JSON_LENGTH) {
        jsonString = jsonString.substring(0, MAX_JSON_LENGTH) + '... (truncated)';
      }
      
      // Try to re-parse and format with indentation
      try {
        const parsed = JSON.parse(jsonString);
        return JSON.stringify(parsed, null, 2);
      } catch {
        // If re-parsing fails, use the raw string
        return jsonString;
      }
    } catch (error) {
      console.error("Error formatting JSON:", error);
      return "{ \"error\": \"Invalid data structure - could not format as JSON\" }";
    }
  }, [data]);
  
  // Function to colorize different parts of the JSON
  const syntaxHighlight = (json: string) => {
    try {
      // Replace with HTML spans with appropriate classes for styling
      return json
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, 
          (match) => {
            let cls = 'json-number'; // number
            if (/^"/.test(match)) {
              if (/:$/.test(match)) {
                cls = 'json-key'; // key
              } else {
                cls = 'json-string'; // string
              }
            } else if (/true|false/.test(match)) {
              cls = 'json-boolean'; // boolean
            } else if (/null/.test(match)) {
              cls = 'json-null'; // null
            }
            return `<span class="${cls}">${match}</span>`;
          });
    } catch (error) {
      console.error("Error highlighting JSON:", error);
      return json;
    }
  }

  // Check if this is a tool evaluation with specific format
  const isToolEvaluation = data && 
    typeof data === 'object' && 
    !Array.isArray(data) &&
    data.type === 'function_call' && 
    data.reasoning;

  return (
    <div className={`overflow-hidden ${className}`}>
      {commandId && (
        <div className="flex items-center gap-2 mb-2">
          <span className="font-medium text-xs text-muted-foreground">Command ID:</span>
          <span className="text-xs font-mono text-foreground bg-muted/50 px-1.5 py-0.5 rounded">{commandId}</span>
        </div>
      )}
      
      {isToolEvaluation ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-xs text-muted-foreground">Type:</span>
            <span className="text-xs font-medium text-primary">{data.type}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-medium text-xs text-muted-foreground">Reasoning:</span>
            <p className="text-xs text-foreground bg-muted/30 p-2 rounded-md">{data.reasoning}</p>
          </div>
        </div>
      ) : (
        <pre 
          className="whitespace-pre-wrap overflow-auto text-[10px] font-mono"
          style={{ maxHeight }}
          dangerouslySetInnerHTML={{ 
            __html: syntaxHighlight(formattedJson) 
          }}
        />
      )}
      <style jsx global>{`
        .json-key {
          color: #0f766e; /* Teal-700 - Dark teal for keys */
          font-weight: 500;
        }
        .json-string {
          color: #7c3aed; /* Violet-600 - Rich purple for strings */
        }
        .json-number {
          color: #0891b2; /* Cyan-600 - Cyan for numbers */
        }
        .json-boolean {
          color: #dc2626; /* Red-600 - Red for booleans */
        }
        .json-null {
          color: #6b7280; /* Gray-500 - Gray for null */
        }
      `}</style>
    </div>
  )
} 