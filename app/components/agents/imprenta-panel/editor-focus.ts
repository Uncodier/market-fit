import { useEffect, useMemo, useState } from 'react'

/** Keep the form owning keyboard focus through viewport/LOD changes, including
 * its portaled menus. The pin is released when focus moves outside the editor. */
export function useImprentaEditorFocus(instanceId?: string) {
  const scope = useMemo(() => ({ instanceId }), [instanceId])
  const [focused, setFocused] = useState<{ scope: object; id: string } | null>(null)
  useEffect(() => {
    let current = true
    const sync = () => {
      if (!current) return
      const element = document.activeElement
      const editor = element instanceof Element ? element.closest<HTMLElement>('[data-imprenta-editable-node]') : null
      const id = editor?.dataset.imprentaEditableNode
      if (id) setFocused(previous => previous?.scope === scope && previous.id === id ? previous : { scope, id })
      else if (!(element instanceof Element) || !element.closest('[data-radix-popper-content-wrapper], [role="dialog"], [role="menu"], [role="listbox"]')) {
        setFocused(previous => previous === null ? previous : null)
      }
    }
    const afterBlur = () => { queueMicrotask(sync) }
    document.addEventListener('focusin', sync)
    document.addEventListener('focusout', afterBlur)
    sync()
    return () => {
      current = false
      document.removeEventListener('focusin', sync)
      document.removeEventListener('focusout', afterBlur)
    }
  }, [scope])
  return focused?.scope === scope ? focused.id : null
}