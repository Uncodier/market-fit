"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  // Check if style-slider-thumb class is applied
  const isStyleSliderThumb = className?.includes('style-slider-thumb')
  const isColorClass = className?.includes('bg-')
  const colorClass = isColorClass ? className : ''
  
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
      data-slider-root
    >
      <SliderPrimitive.Track 
        className={cn(
          "relative h-4 w-full grow rounded-full bg-secondary",
          isStyleSliderThumb && "slider-track"
        )}
        data-radix-slider-track
      >
        <SliderPrimitive.Range 
          className={cn(
            "absolute h-full rounded-[inherit]", 
            isStyleSliderThumb ? "slider-range" : (colorClass || "bg-primary")
          )}
          data-radix-slider-range
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb 
        className={cn(
          "block h-7 w-7 rounded-full border-3 border-primary bg-background shadow-md hover:scale-110 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", 
          isStyleSliderThumb ? "slider-thumb" : colorClass
        )}
        style={{ borderRadius: '9999px' }}
        data-radix-slider-thumb
      />
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider } 