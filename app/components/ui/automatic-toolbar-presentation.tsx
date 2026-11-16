"use client"

import * as React from "react"
import * as Icons from "./icons"
import { getNodeText } from "@/lib/permissions/button-heuristic"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"

const iconTypes = new Set<unknown>(Object.values(Icons))
const excludedRoles = ["tab", "tablist", "combobox", "menu", "menuitem", "listbox", "option", "dialog", "alertdialog"]
const excludedSelector = excludedRoles.map(role => `[role='${role}']`).join(",")

export function isToolbarActionHost(host: HTMLElement) {
  const scope = host.closest("[data-toolbar-icon-actions]")
  if (!scope || scope.getAttribute("data-toolbar-icon-actions") === "off") return false
  if (host.closest("[data-toolbar-icon-action='off']") || host.closest(excludedSelector)) return false
  return true
}

export function hasExistingToolbarTooltip(host: HTMLElement) {
  // Tooltip identity is explicit: popup and toggle triggers also have data-state.
  for (let node: HTMLElement | null = host; node; node = node.parentElement) {
    if (node.hasAttribute("data-toolbar-tooltip-trigger") && !node.hasAttribute("data-automatic-toolbar-tooltip")) return true
    if (node.hasAttribute("data-toolbar-icon-actions")) break
  }
  return false
}

export function useAutomaticToolbarHost() {
  const host = React.useRef<HTMLElement | null>(null)
  const [presentation, setPresentation] = React.useState({ active: false, existingTooltip: false })
  React.useLayoutEffect(() => {
    const node = host.current
    if (!node) return
    const update = () => {
      const active = isToolbarActionHost(node)
      const existingTooltip = hasExistingToolbarTooltip(node)
      setPresentation(previous => previous.active === active && previous.existingTooltip === existingTooltip
        ? previous : { active, existingTooltip })
    }
    update()
    if (!node.closest("[data-toolbar-icon-actions]")) return
    const observer = new MutationObserver(update)
    for (let ancestor: HTMLElement | null = node; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, { attributes: true, attributeFilter: ["role", "data-toolbar-icon-actions", "data-toolbar-icon-action", "data-toolbar-tooltip-trigger"] })
    }
    return () => observer.disconnect()
  })
  return { host, ...presentation }
}

type ChildProps = { children?: React.ReactNode; className?: string; style?: React.CSSProperties; "aria-label"?: string; title?: string }

export function toolbarActionLabel(children: React.ReactNode, ariaLabel?: string, title?: string) {
  const child = React.isValidElement<ChildProps>(children) ? children.props : undefined
  return (ariaLabel || child?.["aria-label"] || title || child?.title || getNodeText(children)).replace(/\s+/g, " ").trim()
}

function stripIconMargins(props: ChildProps) {
  const className = props.className?.split(/\s+/).filter(token => !/(^|:)!?-?m[trblxyse]?-[^ ]+$/.test(token)).join(" ")
  const style = props.style && Object.fromEntries(Object.entries(props.style).filter(([key]) => !key.startsWith("margin")))
  return { className, style, "aria-hidden": true as const }
}

export function extractToolbarIcons(children: React.ReactNode): React.ReactNode[] {
  const result: React.ReactNode[] = []
  React.Children.forEach(children, child => {
    if (!React.isValidElement<ChildProps>(child)) return
    if (iconTypes.has(child.type) || child.type === "svg") {
      result.push(React.cloneElement(child, { ...stripIconMargins(child.props), key: result.length }))
    } else {
      for (const icon of extractToolbarIcons(child.props.children)) result.push(icon)
    }
  })
  // Flattened fragments/wrappers can each have local keys; give the final list
  // stable unique keys without evaluating icon components or their hooks.
  return result.map((icon, key) => React.isValidElement(icon) ? React.cloneElement(icon, { key }) : icon)
}

const fallbackCategories: [RegExp, Icons.LucideIcon][] = [
  [/\b(save|update)\b/i, Icons.SaveIcon],
  [/\b(delete|remove)\b/i, Icons.Trash2],
  [/\b(create|add|new)\b/i, Icons.Plus],
  [/\b(edit|rename)\b/i, Icons.Pencil],
  [/\b(download|export)\b/i, Icons.Download],
  [/\b(upload|import)\b/i, Icons.UploadCloud],
  [/\b(filter)\b/i, Icons.Filter],
  [/\b(search|find)\b/i, Icons.Search],
  [/\b(print)\b/i, Icons.Printer],
  [/\b(copy|duplicate)\b/i, Icons.Copy],
  [/\b(send|share)\b/i, Icons.Send],
  [/\b(back|previous)\b/i, Icons.ArrowLeft],
  [/\b(cancel|close)\b/i, Icons.X],
  [/\b(confirm|apply|approve|submit)\b/i, Icons.Check],
]

export function toolbarActionChildren(children: React.ReactNode, label: string, asChild: boolean) {
  const icons = extractToolbarIcons(children)
  const Fallback = fallbackCategories.find(([pattern]) => pattern.test(label))?.[1] || Icons.MoreHorizontal
  const content = icons.length ? icons : <Fallback aria-hidden />
  if (asChild && React.isValidElement<ChildProps>(children)) {
    return React.cloneElement(children, { children: content })
  }
  return content
}

export function splitToolbarLayoutClasses(className?: string) {
  const outer: string[] = []
  const inner: string[] = []
  for (const token of className?.split(/\s+/) || []) {
    // Move placement and responsive visibility to the actual flex/grid child.
    // Width/growth intentionally stay out: toolbar actions are fixed squares.
    if (/(^|:)(!?-?m[trblxyse]?-[\w\[\]./-]+|order-[\w-]+|self-[\w-]+|hidden|inline-flex|flex)$/.test(token)) outer.push(token)
    else inner.push(token)
  }
  return { outer: outer.join(" "), inner: inner.join(" ") }
}

export function AutomaticToolbarTooltip({ enabled, label, disabled, children, className }: {
  enabled: boolean; label: string; disabled?: boolean; children: React.ReactNode; className?: string
}) {
  const [open, setOpen] = React.useState(false)
  // Unscoped/opted-out controls must retain their exact original DOM structure.
  // Only eligible controls acquire the wrapper after actual-host discovery.
  if (!enabled) return <>{children}</>
  return <TooltipProvider delayDuration={200}>
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <span data-automatic-toolbar-tooltip="" className={cn("inline-flex shrink-0", className)}
          tabIndex={enabled && disabled ? 0 : undefined} aria-label={enabled && disabled ? label : undefined}>
          {children}
        </span>
      </TooltipTrigger>
      {enabled && <TooltipContent side="bottom">{label}</TooltipContent>}
    </Tooltip>
  </TooltipProvider>
}