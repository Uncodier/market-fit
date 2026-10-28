import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { TopBarPrimaryActions } from '@/app/components/navigation/topbar-primary-actions';
import { SectionCard, SectionCardHeader, SectionCardContent } from '@/app/components/ui/section-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { procurementRuleSchema, type ProcurementRule } from '../domain';
import { Choice, currencyScale, humanize } from './form-fields';
import { SearchInput } from '@/app/components/ui/search-input';
import { Badge } from '@/app/components/ui/badge';
import { Pagination } from '@/app/components/ui/pagination';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { RuleEditor } from './rule-editor';

export function RulesEditor({ rules, onChange, siteId, timeZone, disabled = false }: {
  rules: ProcurementRule[]; onChange: (rules: ProcurementRule[]) => void; siteId: string; timeZone: string; disabled?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | ProcurementRule['status']>('all');
  const [page, setPage] = useState(1);
  const selected = rules.find((rule) => rule.id === editing);
  const visible = rules.filter((rule) => (filter === 'all' || rule.status === filter) && rule.name.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-6">
    <TopBarPrimaryActions><Button type="button" size="sm" disabled={disabled || rules.length >= 500} onClick={() => {
        const rule = procurementRuleSchema.parse({ id: crypto.randomUUID(), name: 'New rule', type: 'approval', event: 'requisition' });
        onChange([...rules, rule]); setEditing(rule.id);
      }}>Create rule</Button></TopBarPrimaryActions>
    <SectionCard><SectionCardHeader title="Procurement rules" description="Draft rules do not match simulations. Archive instead of deleting to retain the rule in policy history." />
      <SectionCardContent>
        <div className="mb-5 flex flex-wrap items-center gap-4"><SearchInput aria-label="Search rules" placeholder="Search rules" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
          <Choice label="Filter status" value={filter} options={['all', 'draft', 'active', 'archived']} onChange={value => { setFilter(value); setPage(1); }} /></div>
        <div className="overflow-hidden rounded-xl border bg-background"><Table className="min-w-[760px]"><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Event / type</TableHead><TableHead>Net threshold</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>{visible.slice((page - 1) * 25, page * 25).map((rule) => <TableRow key={rule.id}>
            <TableCell>{rule.name}<div className="text-xs text-muted-foreground">Version {rule.version}</div></TableCell>
            <TableCell>{humanize(rule.event)} / {humanize(rule.type)}</TableCell>
            <TableCell>{rule.amount ? `${rule.amount.operator.toUpperCase()} ${rule.amount.valueMinor / currencyScale(rule.amount.currency)}${rule.amount.maxMinor !== undefined ? `–${rule.amount.maxMinor / currencyScale(rule.amount.currency)}` : ''} ${rule.amount.currency} (${humanize(rule.amount.basis)})` : 'Any amount'}</TableCell>
            <TableCell><Badge variant="outline">{humanize(rule.status)}</Badge></TableCell>
            <TableCell><div className="flex gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setEditing(rule.id)}>Edit {rule.name}</Button>
              {rule.status !== 'archived' && <Button type="button" variant="ghost" size="sm"
                onClick={() => onChange(rules.map((item) => item.id === rule.id ? { ...item, status: 'archived' } : item))}>Archive {rule.name}</Button>}</div></TableCell>
          </TableRow>)}</TableBody>
        </Table></div>
        <div className="mt-4 flex items-center justify-between"><span className="text-xs text-muted-foreground">{visible.length} rules</span><Pagination currentPage={page} totalPages={Math.ceil(visible.length / 25)} onPageChange={setPage} /></div>
        {!visible.length && <p className="py-6 text-center text-muted-foreground">No rules match this view. Create a rule to configure conditions and requirements.</p>}
      </SectionCardContent>
    </SectionCard>
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent size="xl">
      <DialogHeader><DialogTitle>Edit procurement rule</DialogTitle><DialogDescription>Changes remain in your policy draft until Save policy is selected.</DialogDescription></DialogHeader>
      <DialogBody>{selected && <RuleEditor value={selected} siteId={siteId} timeZone={timeZone} onClose={() => setEditing(null)}
        onChange={(rule) => onChange(rules.map((item) => item.id === rule.id ? rule : item))} />}</DialogBody>
      <DialogFooter><Button type="button" onClick={() => setEditing(null)}>Done editing</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}