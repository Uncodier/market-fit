"use client"

import { useLayoutEffect, useRef, type ComponentProps } from "react"
import { Textarea } from "@/app/components/ui/textarea"

const MIN_HEIGHT = 60

export function resizeImprentaTextarea(textarea: HTMLTextAreaElement): number {
  textarea.style.height = "0px"
  const nextHeight = Math.max(textarea.scrollHeight, MIN_HEIGHT)
  textarea.style.height = `${nextHeight}px`
  textarea.style.overflowY = "hidden"
  textarea.scrollTop = 0
  return nextHeight
}

export function ImprentaAutoResizeTextarea({
  onInput,
  ...props
}: ComponentProps<typeof Textarea>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    if (textareaRef.current) resizeImprentaTextarea(textareaRef.current)
  }, [props.defaultValue, props.value])

  return (
    <Textarea
      {...props}
      ref={textareaRef}
      rows={1}
      onInput={(event) => {
        resizeImprentaTextarea(event.currentTarget)
        onInput?.(event)
      }}
    />
  )
}
