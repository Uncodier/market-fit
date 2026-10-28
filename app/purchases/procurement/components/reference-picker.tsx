import { useEffect, useState } from 'react';
import { RelationSelect, type RelationSelectOption } from '@/app/components/ui/relation-select';
import { Button } from '@/app/components/ui/button';

export function ReferencePicker({ siteId, kind = 'people', label, ids, onChange, single = false, disabled = false }: {
  siteId: string; kind?: 'people' | 'products' | 'categories' | 'agents'; label: string;
  ids: string[]; onChange: (ids: string[]) => void; single?: boolean; disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<RelationSelectOption[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError(''); setOptions([]);
      try {
        const params = new URLSearchParams({ site_id: siteId, kind, q: query.slice(0, 100) });
        const response = await fetch(`/api/procurement/references?${params}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Could not load choices. Check your access or try searching again.');
        const data = await response.json();
        if (!Array.isArray(data.options)) throw new Error('Invalid reference response.');
        if (controller.signal.aborted) return;
        setOptions(data.options); setHasMore(data.has_more === true);
        setLabels((previous) => ({ ...previous, ...Object.fromEntries(data.options.map((item: RelationSelectOption) => [item.id, item.label])) }));
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load choices.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [siteId, kind, query]);
  return <div className="space-y-2">
    <RelationSelect disabled={disabled} label={label} placeholder={`Search ${label.toLowerCase()}`} value={null}
      options={options.filter((item) => !ids.includes(item.id))} allowCreate={false} clearAfterSelect
      emptyMessage={loading ? 'Loading choices…' : 'No matching choices'} onSearchChange={setQuery}
      onValueChange={(value) => { if (!disabled && value?.mode === 'existing') onChange(single ? [value.id] : [...ids, value.id]); }} />
    {hasMore && <p className="text-xs text-muted-foreground">More results available. Search to narrow the list.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2">{ids.map((id) => <Button disabled={disabled} key={id} type="button" variant="outline" size="sm"
      aria-label={`Remove ${labels[id] ?? id} from ${label}`} onClick={() => onChange(ids.filter((value) => value !== id))}>
      {labels[id] ?? `Saved reference: ${id}`} ×
    </Button>)}</div>
  </div>;
}