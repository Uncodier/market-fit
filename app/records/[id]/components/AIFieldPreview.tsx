import React, { useEffect, useState } from "react"
import { publicPromptImageUrl } from "@/app/lib/image-utils"
import { useDebounce } from "use-debounce"

export function AIFieldPreview({ promptTemplate, value, fieldName }: { promptTemplate: string, value: string, fieldName: string }) {
  const [debouncedValue] = useDebounce(value, 1000)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!debouncedValue || debouncedValue.trim() === "") {
      setImageUrl(null)
      return
    }

    const finalPrompt = (promptTemplate || "Generate an image about: {value}").replace(/{value}/g, debouncedValue)
    setImageUrl(publicPromptImageUrl(finalPrompt, 512))
  }, [debouncedValue, promptTemplate])

  if (!imageUrl) return null

  return (
    <div className="w-full mt-2 flex flex-col">
      <div className="rounded-lg overflow-hidden border border-border/50 bg-muted/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={imageUrl} 
          alt={`AI generated preview for ${fieldName}`} 
          className="w-full h-auto object-cover max-h-[300px]" 
          loading="lazy"
        />
      </div>
      <span className="text-xs text-muted-foreground text-center mt-2">{fieldName}</span>
    </div>
  )
}
