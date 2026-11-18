import { useState } from 'react'
import type { InstanceNode } from '@/app/types/instance-nodes'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'

export function ImprentaNodePicker({ nodes, onSelect }: {
  nodes: InstanceNode[]
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const label = (node: InstanceNode) => String(node.prompt?.text || node.type).slice(0, 120)
  const visible = nodes.filter(node => !node.id.startsWith('dummy-')
    && `${label(node)} ${node.type}`.toLowerCase().includes(query.toLowerCase())).slice(0, 50)
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button data-imprenta-node-picker variant="ghost" size="sm">Find node</Button></PopoverTrigger>
    <PopoverContent className="w-80" side="top" align="start">
      <Input aria-label="Search canvas nodes" placeholder="Search nodes..." value={query} onChange={e => setQuery(e.target.value)} />
      <div className="mt-2 max-h-64 overflow-y-auto" role="list" aria-label="Canvas nodes">
        {visible.map(node => <div key={node.id} role="listitem">
          <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => {
            setOpen(false)
            // Wait for the popover's focus restoration before focusing the editor.
            requestAnimationFrame(() => onSelect(node.id))
          }}>{label(node)}</Button>
        </div>)}
        {!visible.length && <p className="p-2 text-sm text-muted-foreground">No matching nodes</p>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Showing up to 50 nodes. Search to narrow the list.</p>
    </PopoverContent>
  </Popover>
}