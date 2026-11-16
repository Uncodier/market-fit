"use client"

import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Folder } from '@/app/components/ui/icons'
import { ToolbarIconButton } from '@/app/components/ui/toolbar-icon-button'
import { createPortal } from 'react-dom'

export function ArchiveViewerToolbar({ canPreview, mode, onModeChange, filesVisible, onToggleFiles, previewLabel = 'Isolated preview', toolbarTarget, filesToggleTarget }: {
  canPreview: boolean
  mode: 'preview' | 'source'
  onModeChange: (mode: 'preview' | 'source') => void
  filesVisible: boolean
  onToggleFiles: () => void
  previewLabel?: string
  toolbarTarget?: HTMLElement | null
  filesToggleTarget?: HTMLElement | null
}) {
  const filesToggle = (
    <ToolbarIconButton onClick={onToggleFiles} label={filesVisible ? 'Hide files' : 'Show files'}
        aria-expanded={filesVisible}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
        <Folder className="h-3.5 w-3.5" />
    </ToolbarIconButton>
  )
  const controls = (compact: boolean) => (
    <div data-toolbar-icon-actions role="group" aria-label="File viewer controls" className="flex shrink-0 items-center gap-1">
      {(!compact || !filesToggleTarget) && filesToggle}
      {canPreview && <Tabs value={mode} onValueChange={value => {
        if (value === 'preview' || value === 'source') onModeChange(value)
      }}>
        <TabsList aria-label="File view" className={compact ? 'rounded-full !h-6 !p-0.5' : 'rounded-full'}>
          <TabsTrigger value="preview" className={compact ? 'rounded-full !h-5 !px-2 !py-0 text-xs' : 'rounded-full'}>Preview</TabsTrigger>
          <TabsTrigger value="source" className={compact ? 'rounded-full !h-5 !px-2 !py-0 text-xs' : 'rounded-full'}>Source</TabsTrigger>
        </TabsList>
      </Tabs>}
    </div>
  )
  return (
    <>
      {toolbarTarget && createPortal(controls(true), toolbarTarget)}
      {toolbarTarget && filesToggleTarget && createPortal(filesToggle, filesToggleTarget)}
      <div data-toolbar-icon-actions className={`flex items-center justify-end gap-2 border-b border-border px-3 py-2 shrink-0 ${toolbarTarget ? 'lg:hidden' : ''}`}>
        {!toolbarTarget && <span className="mr-auto text-xs text-muted-foreground hidden sm:block">
          {canPreview ? previewLabel : ''}
        </span>}
        {controls(false)}
      </div>
    </>
  )
}