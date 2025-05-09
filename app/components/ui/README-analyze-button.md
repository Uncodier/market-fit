# AnalyzeWithAI Button

The AnalyzeWithAI button is a UI component that provides a consistent way to trigger AI analysis functionality across the application. It's hidden by default and only appears when enabled by specific pages or components.

## Basic Usage

The button is already integrated into the TopBar component and is controlled through the `AnalyzeContext`.

To display the button on a specific page:

```tsx
"use client"

import { useEffect } from "react"
import { useAnalyze } from "@/app/context/AnalyzeContext"

export default function MyPage() {
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
    <div>
      {/* Your page content */}
    </div>
  )
}
```

## Custom Analyze Function

You can customize the analyze functionality by creating your own handler. There's already a default handler in the TopBarActions component, but you can create a custom one where needed:

```tsx
import { useAnalyze } from "@/app/context/AnalyzeContext"
import { toast } from "sonner"

export function MyComponent() {
  const { setShowAnalyzeButton } = useAnalyze()
  
  const handleCustomAnalyze = async () => {
    toast.info("Starting custom analysis...")
    
    try {
      // Your custom analysis logic here
      const result = await myCustomAnalysisFunction()
      
      // Handle the result
      toast.success("Analysis completed successfully!")
      
      // Do something with the result
      console.log(result)
    } catch (error) {
      console.error("Analysis failed:", error)
      toast.error("Analysis failed. Please try again.")
    }
  }
  
  // In a useEffect or event handler:
  useEffect(() => {
    // Custom event to trigger the custom analysis
    const customHandler = (event) => {
      if (event.detail?.analysisType === 'myCustomType') {
        handleCustomAnalyze()
      }
    }
    
    window.addEventListener('analyze:trigger', customHandler)
    setShowAnalyzeButton(true)
    
    return () => {
      window.removeEventListener('analyze:trigger', customHandler)
      setShowAnalyzeButton(false)
    }
  }, [])
  
  return <div>{/* Component content */}</div>
}
```

## Button Properties

The `AnalyzeButton` component accepts the following props:

- `onAnalyze`: Optional custom function to execute when the button is clicked
- `customLabel`: Optional custom label for the button

## Events

The button dispatches events that can be listened to:

```tsx
// Dispatch an event to trigger analysis
window.dispatchEvent(new CustomEvent('analyze:trigger', {
  detail: {
    analysisType: 'content', // or any other type
    targetId: '123', // optional target ID
    // any other metadata needed
  }
}))

// Listen for analysis results
useEffect(() => {
  const handleAnalysisComplete = (event) => {
    const { result, analysisType } = event.detail
    // Handle the result
  }
  
  window.addEventListener('analyze:complete', handleAnalysisComplete)
  
  return () => {
    window.removeEventListener('analyze:complete', handleAnalysisComplete)
  }
}, [])
```

## Example Page

Check out the example implementation at `/example` in the app to see the button in action. 