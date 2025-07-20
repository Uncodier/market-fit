"use client"

import React, { useCallback, useRef } from "react"

export function DebugTextarea() {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const valueRef = useRef("")
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    valueRef.current = value
    console.log('Debug: Character captured:', value)
  }, [])
  
  const handleSubmit = useCallback(() => {
    const currentValue = textareaRef.current?.value || ""
    console.log('Debug: Submit value:', currentValue)
    console.log('Debug: Ref value:', valueRef.current)
    
    // Clear textarea
    if (textareaRef.current) {
      textareaRef.current.value = ""
      valueRef.current = ""
    }
  }, [])
  
  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="font-semibold mb-2">Debug Textarea Test</h3>
      <textarea
        ref={textareaRef}
        onChange={handleChange}
        placeholder="Type here to test character capture..."
        className="w-full h-20 p-2 border rounded"
      />
      <button 
        onClick={handleSubmit}
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Test Submit & Clear
      </button>
      <div className="mt-2 text-sm text-gray-600">
        Check console for character capture logs
      </div>
    </div>
  )
} 