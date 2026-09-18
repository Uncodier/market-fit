"use client"

import { useCallback, useRef, useState } from "react"

export type RecordNodeMarkdownCommand =
  | "bold"
  | "italic"
  | "heading"
  | "bullet"
  | "ordered"
  | "quote"
  | "code"
  | "link"

type ActiveNodeEditor = {
  nodeId: string
  element: HTMLTextAreaElement
}

const MAX_NODE_CONTENT_LENGTH = 12_000

export function useRecordNodeMarkdownEditor(
  onChange: (nodeId: string, content: string) => void,
) {
  const activeRef = useRef<ActiveNodeEditor | null>(null)
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)

  const focus = useCallback((nodeId: string, element: HTMLTextAreaElement) => {
    activeRef.current = { nodeId, element }
    setActiveNodeId(nodeId)
  }, [])

  const blur = useCallback(() => {
    window.setTimeout(() => {
      if (document.activeElement === activeRef.current?.element) return
      activeRef.current = null
      setActiveNodeId(null)
    }, 0)
  }, [])

  const format = useCallback((command: RecordNodeMarkdownCommand) => {
    const active = activeRef.current
    if (!active) return
    const { element, nodeId } = active
    const start = element.selectionStart
    const end = element.selectionEnd
    const value = element.value
    const result = formatMarkdown(value, start, end, command)
    if (!result || result.value.length > MAX_NODE_CONTENT_LENGTH) return
    onChange(nodeId, result.value)
    requestAnimationFrame(() => {
      element.focus()
      element.setSelectionRange(result.start, result.end)
    })
  }, [onChange])

  return {
    activeNodeId,
    focus,
    blur,
    format,
  }
}

function formatMarkdown(
  value: string,
  start: number,
  end: number,
  command: RecordNodeMarkdownCommand,
) {
  const selected = value.slice(start, end)
  if (command === "heading") return prefixLines(value, start, end, "## ")
  if (command === "bullet") return prefixLines(value, start, end, "- ")
  if (command === "ordered") return prefixLines(value, start, end, "1. ")
  if (command === "quote") return prefixLines(value, start, end, "> ")
  if (command === "link") {
    const url = window.prompt("Enter the URL")?.trim()
    if (!url || !isSafeMarkdownUrl(url)) return null
    return wrapSelection(value, start, end, `[${selected || "link"}](${url})`, 1, selected ? 1 + selected.length : 5)
  }
  const markers = command === "bold"
    ? ["**", "**"]
    : command === "italic"
      ? ["_", "_"]
      : selected.includes("\n")
        ? ["```\n", "\n```"]
        : ["`", "`"]
  return wrapSelection(
    value,
    start,
    end,
    `${markers[0]}${selected}${markers[1]}`,
    markers[0].length,
    markers[0].length + selected.length,
  )
}

function isSafeMarkdownUrl(url: string) {
  return /^(https?:\/\/|mailto:|\/|#)/i.test(url)
}

function wrapSelection(
  value: string,
  start: number,
  end: number,
  replacement: string,
  selectionStartOffset: number,
  selectionEndOffset: number,
) {
  return {
    value: value.slice(0, start) + replacement + value.slice(end),
    start: start + selectionStartOffset,
    end: start + selectionEndOffset,
  }
}

function prefixLines(value: string, start: number, end: number, prefix: string) {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1
  const nextBreak = value.indexOf("\n", end)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const block = value.slice(lineStart, lineEnd)
  const replacement = block.split("\n").map((line) => `${prefix}${line}`).join("\n")
  return {
    value: value.slice(0, lineStart) + replacement + value.slice(lineEnd),
    start: lineStart + prefix.length,
    end: lineStart + replacement.length,
  }
}
