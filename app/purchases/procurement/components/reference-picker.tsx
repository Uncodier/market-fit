import { useEffect, useState } from 'react';
import { isDemoSiteId, isDemoModeActive } from '@/lib/demo-utils';
import { demoProcurementReferences } from '@/lib/demo-data/procurement-suppliers';
import { RelationSelect, type RelationSelectOption } from '@/app/components/ui/relation-select';
import { Button } from '@/app/components/ui/button';
import { useProcurementI18n } from '../i18n/use-procurement-i18n';

export function ReferencePicker({ siteId, kind = 'people', label, ids, onChange, single = false, disabled = false }: {
  siteId: string; kind?: 'people' | 'products' | 'categories' | 'agents' | 'locations'; label: string;
  ids: string[]; onChange: (ids: string[]) => void; single?: boolean; disabled?: boolean;
}) {
  const { t, message } = useProcurementI18n();
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<RelationSelectOption[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    if (isDemoSiteId(siteId)) {
      const timer = setTimeout(() => {
        const choices = demoProcurementReferences[kind];
        setOptions(choices.filter(item => item.label.toLowerCase().includes(query.toLowerCase())));
        setLabels(Object.fromEntries(choices.map(item => [item.id, item.label])));
        setLoading(false); setHasMore(false); setError('');
      }, 0)
      return () => clearTimeout(timer)
    }
    if (isDemoModeActive()) return;
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
    <RelationSelect disabled={disabled} label={label} placeholder={t('procurement.common.searchFor', { label })} searchPlaceholder={t('procurement.common.search')} clearLabel={t('procurement.common.clearSelection')} loadingLabel={t('procurement.common.loadingSelection')} value={null}
      options={options.filter((item) => !ids.includes(item.id))} allowCreate={false} clearAfterSelect
      emptyMessage={loading ? t('procurement.common.loadingChoices') : t('procurement.common.noChoices')} onSearchChange={setQuery}
      onValueChange={(value) => { if (!disabled && value?.mode === 'existing') onChange(single ? [value.id] : [...ids, value.id]); }} />
    {hasMore && <p className="text-xs text-muted-foreground">{t('procurement.common.moreChoices')}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{message(error)}</p>}
    <div className="flex flex-wrap gap-2">{ids.map((id) => <Button disabled={disabled} key={id} type="button" variant="outline" size="sm"
      aria-label={t('procurement.common.removeReference', { name: labels[id] ?? id, label })} onClick={() => onChange(ids.filter((value) => value !== id))}>
      {labels[id] ?? t('procurement.common.savedReference', { id })} ×
    </Button>)}</div>
  </div>;
}