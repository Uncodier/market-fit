"use client"

import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Folder } from '@/app/components/ui/icons'

export function ArchiveViewerToolbar({ canPreview, mode, onModeChange, filesVisible, onToggleFiles }: {
  canPreview: boolean
  mode: 'preview' | 'source'
  onModeChange: (mode: 'preview' | 'source') => void
  filesVisible: boolean
  onToggleFiles: () => void
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border px-3 py-2 shrink-0">
      <button type="button" onClick={onToggleFiles} aria-label={filesVisible ? 'Hide files' : 'Show files'}
        aria-expanded={filesVisible} title={filesVisible ? 'Hide files' : 'Show files'}
        className="justify-self-start inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
        <Folder className="h-4 w-4" />
      </button>
      {canPreview ? (
        <Tabs value={mode} onValueChange={value => {
          if (value === 'preview' || value === 'source') onModeChange(value)
        }}>
          <TabsList aria-label="File view" className="rounded-full">
            <TabsTrigger value="preview" className="rounded-full">Preview</TabsTrigger>
            <TabsTrigger value="source" className="rounded-full">Source</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : <span />}
      <span className="justify-self-end text-xs text-muted-foreground hidden sm:block">
        {canPreview ? 'Static preview' : ''}
      </span>
    </div>
  )
}