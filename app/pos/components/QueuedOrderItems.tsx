import { useEffect, useMemo, useState } from "react";
import type { CheckoutLine } from "@/app/commerce/checkout-types";
import { getPosDb } from "../local/db";
import { readPosLocalWithDeadline } from "../local/read-deadline";
import type { PosOrderSnapshot } from "../order-snapshot";

export function QueuedOrderItems({ siteId, lines, order }: {
  siteId: string; lines: CheckoutLine[]; order?: PosOrderSnapshot | null;
}) {
  const registered = useMemo(() => {
    const names = new Map<string, string>();
    if (order?.site_id === siteId) for (const item of order.sale_order_items) {
      if (item.catalog_item_id && item.name) names.set(item.catalog_item_id, item.name);
    }
    return names;
  }, [order, siteId]);
  const [catalog, setCatalog] = useState<{ siteId: string; names: Map<string, string> } | null>(null);
  useEffect(() => {
    const missing = [...new Set(lines.flatMap(line => [line.catalogItemId,
      ...(line.modifiers ?? []).map(item => item.catalogItemId)]))].filter(id => !registered.has(id)).slice(0, 200);
    if (!missing.length) return;
    let active = true;
    void readPosLocalWithDeadline(() => getPosDb().catalogItems.bulkGet(missing)).then(items => {
      if (!active) return;
      const names = new Map<string, string>();
      for (const item of items) if (item?.site_id === siteId && item.name) names.set(item.id, item.name);
      setCatalog({ siteId, names });
    }).catch(() => { /* Catalog labels are optional; keep the original queued identifiers. */ });
    return () => { active = false; };
  }, [siteId, registered, lines]);
  const label = (id: string) => registered.get(id) || (catalog?.siteId === siteId && catalog.names.get(id)) || id;
  return <div>
    <h4 className="font-medium">Queued order items</h4>
    <ul className="space-y-1 break-words">
      {lines.map((line, index) => <li key={`${line.catalogItemId}:${index}`}>
        {line.quantity} × {label(line.catalogItemId)}
        {line.modifiers?.length ? <ul className="pl-4">
          {line.modifiers.map((modifier, i) => <li key={i}>{line.quantity * modifier.quantity} × {label(modifier.catalogItemId)}</li>)}
        </ul> : null}
      </li>)}
    </ul>
  </div>;
}