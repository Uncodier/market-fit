"use client"

import { useState } from 'react'
import { ZipViewer } from '@/app/components/simple-messages-view/components/ZipViewer'
import { Folder, ChevronDown, ChevronRight } from '@/app/components/ui/icons'

export interface CloudFileFolder {
  url: string
  title?: string | null
}

export function CloudFilesViewer({ url, files, onFileSelect, className }: {
  url: string
  files: CloudFileFolder[]
  onFileSelect?: (path: string) => void
  className?: string
}) {
  const [chosenUrl, setChosenUrl] = useState<string | null>(null)
  const [collapsedUrl, setCollapsedUrl] = useState<string | null>(null)
  const folders = [...new Map([{ url }, ...files].map(file => [file.url, file])).values()]
  const selectedUrl = folders.some(file => file.url === chosenUrl) ? chosenUrl! : url
  const navigation = (tree: React.ReactNode) => (
    <div className="space-y-1">
      <p className="px-2 py-2 text-xs font-medium text-muted-foreground">Deliveries</p>
      {folders.map((file, index) => {
        const active = file.url === selectedUrl
        const expanded = active && collapsedUrl !== file.url
        const Chevron = expanded ? ChevronDown : ChevronRight
        const title = file.title?.replace(/^File (\d+)$/, 'Delivery $1') || `Delivery ${index + 1}`
        return <div key={file.url}>
          <button type="button" aria-current={active ? 'page' : undefined} aria-expanded={expanded}
            onClick={() => {
              setCollapsedUrl(active && expanded ? file.url : null)
              if (!active) { setChosenUrl(file.url); onFileSelect?.('') }
            }}
            className={`flex w-full min-w-0 items-center !justify-start gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground'}`}>
            <Chevron className="!m-0 h-3.5 w-3.5 shrink-0" />
            <Folder className="!m-0 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate text-left" title={title}>{title}</span>
          </button>
          {expanded && <div className="ml-3.5 my-1 border-l border-border pl-1">{tree}</div>}
        </div>
      })}
    </div>
  )
  return <ZipViewer url={selectedUrl} className={className} onFileSelect={onFileSelect} folderNavigation={navigation} />
}