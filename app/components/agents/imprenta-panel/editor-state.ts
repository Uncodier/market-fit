import { useCallback, useEffect, useMemo, useState } from 'react'
import type { InstanceNode } from '@/app/types/instance-nodes'
import { useImprentaEditorFocus } from './editor-focus'

function createPromptDrafts(scope?: string) {
  const drafts = new Map<string, string>()
  return {
    scope,
    get: (id: string) => drafts.get(id),
    set: (id: string, text: string) => { drafts.set(id, text) },
    saved: (id: string, text: string) => { if (drafts.get(id) === text) drafts.delete(id) },
    prune(ids: Set<string>) { for (const id of drafts.keys()) if (!ids.has(id)) drafts.delete(id) },
  }
}

export function useImprentaEditorState(instanceId: string | undefined, nodes: InstanceNode[]) {
  const focusedEditorNodeId = useImprentaEditorFocus(instanceId)
  const promptDrafts = useMemo(() => createPromptDrafts(instanceId), [instanceId])
  const [selection, setSelection] = useState<{ instanceId?: string; nodeId: string } | null>(null)
  const activeEditorNodeId = selection && selection.instanceId === instanceId
    && nodes.some(node => node.id === selection.nodeId) ? selection.nodeId : null
  const activateEditor = useCallback((nodeId: string | null) => {
    // Native canvas pointerdown prevents focus changes; commit an uncontrolled
    // prompt before swapping cards. Drafts also survive a failed save/remount.
    const focused = typeof document !== 'undefined' ? document.activeElement : null
    if (focused instanceof HTMLElement && focused.closest('[data-imprenta-editor], [data-imprenta-editable-node]')) focused.blur()
    setSelection(nodeId ? { instanceId, nodeId } : null)
    if (!nodeId && typeof document !== 'undefined') {
      document.querySelector<HTMLButtonElement>('[data-imprenta-node-picker]')?.focus({ preventScroll: true })
    }
  }, [instanceId])
  useEffect(() => {
    promptDrafts.prune(new Set(nodes.map(node => node.id)))
  }, [nodes, promptDrafts])
  return { activeEditorNodeId, focusedEditorNodeId, activateEditor, promptDrafts }
}