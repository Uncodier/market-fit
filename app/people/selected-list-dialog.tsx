import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog'
import type { SelectedListActions } from './use-selected-list-actions'

export function SelectedListDialog({ actions }: { actions: SelectedListActions }) {
  const creating = actions.mode === 'create'
  return <Dialog open={actions.mode !== null} onOpenChange={open => { if (!open) actions.close() }}>
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>{creating ? 'Create list with selected people' : 'Add selected people to a list'}</DialogTitle>
        <DialogDescription>
          Save {actions.people.length} selected people for background enrichment. This does not enrich them now.
          Processing depends on enabled background enrichment and available credits.
        </DialogDescription>
      </DialogHeader>
      {creating ? <div className="space-y-2">
        <label htmlFor="selected-list-name" className="text-sm">List name</label>
        <Input id="selected-list-name" value={actions.name} maxLength={200} disabled={actions.pending}
          placeholder="e.g. Summer 2026 Outreach" onChange={event => actions.setName(event.target.value)} />
      </div> : actions.lists.loading ? <p role="status">Loading lists...</p>
        : actions.lists.error ? <div role="alert" className="space-y-2">
          <p>Could not load your available lists.</p>
          <Button variant="outline" onClick={actions.lists.refresh}>Retry</Button>
        </div> : actions.lists.lists.length === 0 ? <p>No accessible lists yet. Create a new list with your selection.</p>
          : <Select value={actions.listId} onValueChange={actions.setListId} disabled={actions.pending}>
            <SelectTrigger aria-label="Destination list"><SelectValue placeholder="Choose a list" /></SelectTrigger>
            <SelectContent>{actions.lists.lists.map(list => <SelectItem key={list.id} value={list.id}>
              {list.name?.trim() || `List ${list.id.slice(0, 8)}`}
            </SelectItem>)}</SelectContent>
          </Select>}
      <DialogFooter>
        <Button variant="outline" disabled={actions.pending} onClick={actions.close}>Cancel</Button>
        <Button onClick={actions.submit} disabled={actions.pending || (creating ? !actions.name.trim()
          : actions.lists.loading || actions.lists.error || !actions.listId)}>
          {actions.pending ? 'Saving...' : creating ? 'Create list' : 'Add to list'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}