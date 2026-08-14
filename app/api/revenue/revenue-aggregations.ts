import { subMonths } from 'date-fns';
import { isRecognizedRevenueSale } from '@/lib/sales/recognized-sale';

export { isRecognizedRevenueSale };

const ONLINE_SOURCES = new Set(['online', 'shop', 'marketplace']);
const RETAIL_SOURCES = new Set(['retail', 'pos']);

export function isOnlineSource(source: string | null | undefined): boolean {
  return !!source && ONLINE_SOURCES.has(source);
}

export function isRetailSource(source: string | null | undefined): boolean {
  return !!source && RETAIL_SOURCES.has(source);
}

export function getSalesAmount(sale: any): number {
  if (!sale || sale.amount == null) return 0;
  const amount =
    typeof sale.amount === 'number'
      ? sale.amount
      : parseFloat(String(sale.amount).replace(/[^0-9.-]+/g, ''));
  return isNaN(amount) ? 0 : amount;
}

export function percentChangeFrom(previous: number, current: number): number {
  let change = 0;
  if (previous > 0) {
    change = ((current - previous) / previous) * 100;
  } else if (current > 0) {
    change = 100;
  }
  return isNaN(change) ? 0 : change;
}

export function saleCalendarDate(sale: {
  sale_date?: string | null;
  created_at?: string | null;
}): string {
  if (sale?.sale_date && /^\d{4}-\d{2}-\d{2}/.test(sale.sale_date)) {
    return sale.sale_date.slice(0, 10);
  }
  if (sale?.created_at) return String(sale.created_at).slice(0, 10);
  return '';
}

export function salesInLocalRange<T extends {
  status?: string | null;
  amount_due?: number | string | null;
  sale_date?: string | null;
  created_at?: string | null;
}>(sales: T[], startDate: string, endInclusive: string): T[] {
  return sales.filter((sale) => {
    if (!isRecognizedRevenueSale(sale)) return false;
    const date = saleCalendarDate(sale);
    return date >= startDate && date <= endInclusive;
  });
}

export function mergeSalesById<T extends { id?: string }>(...groups: Array<T[] | null | undefined>): T[] {
  const byId = new Map<string, T>();
  for (const group of groups) {
    for (const sale of group || []) {
      if (sale?.id) byId.set(sale.id, sale);
    }
  }
  return Array.from(byId.values());
}

type SupabaseLike = {
  from: (table: string) => any;
};

/**
 * Aggregate sale amounts by catalog category (via order line items).
 * Falls back to product_type / product_category / Other for sales without items.
 */
export async function aggregateSalesByCategory(
  supabase: SupabaseLike,
  sales: any[],
): Promise<Map<string, number>> {
  const categories = new Map<string, number>();
  if (!sales.length) return categories;

  const add = (name: string, amount: number) => {
    if (amount === 0) return;
    categories.set(name, (categories.get(name) || 0) + amount);
  };

  const saleIds = sales.map((s) => s.id).filter(Boolean);
  const { data: orders } = await supabase
    .from('sale_orders')
    .select('id, sale_id')
    .in('sale_id', saleIds);

  const orderBySaleId = new Map<string, string>();
  for (const order of orders || []) {
    if (order.sale_id) orderBySaleId.set(order.sale_id, order.id);
  }

  const orderIds = Array.from(orderBySaleId.values());
  const categoryBySaleId = new Map<string, Map<string, number>>();

  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from('sale_order_items')
      .select(
        'sale_order_id, catalog_item_id, subtotal, parent_sale_order_item_id, catalog_item:catalog_items(category_id, category:catalog_categories(name))',
      )
      .in('sale_order_id', orderIds);

    const saleIdByOrderId = new Map<string, string>();
    for (const [saleId, orderId] of orderBySaleId.entries()) {
      saleIdByOrderId.set(orderId, saleId);
    }

    for (const item of items || []) {
      if (item.parent_sale_order_item_id) continue;
      const saleId = saleIdByOrderId.get(item.sale_order_id);
      if (!saleId) continue;

      const catalogItem = Array.isArray(item.catalog_item)
        ? item.catalog_item[0]
        : item.catalog_item;
      const categoryRel = Array.isArray(catalogItem?.category)
        ? catalogItem.category[0]
        : catalogItem?.category;
      const categoryName =
        (categoryRel?.name as string | undefined)?.trim() || 'Uncategorized';
      const lineAmount = Number(item.subtotal) || 0;

      if (!categoryBySaleId.has(saleId)) {
        categoryBySaleId.set(saleId, new Map());
      }
      const saleCats = categoryBySaleId.get(saleId)!;
      saleCats.set(categoryName, (saleCats.get(categoryName) || 0) + lineAmount);
    }
  }

  for (const sale of sales) {
    const saleAmount = getSalesAmount(sale);
    if (saleAmount === 0) continue;

    const lineCats = categoryBySaleId.get(sale.id);
    if (lineCats && lineCats.size > 0) {
      const lineTotal = Array.from(lineCats.values()).reduce((s, v) => s + v, 0);
      if (lineTotal > 0) {
        for (const [name, lineAmount] of lineCats.entries()) {
          add(name, saleAmount * (lineAmount / lineTotal));
        }
        continue;
      }
    }

    const fallback =
      sale.product_type || sale.product_category || 'Other';
    add(fallback, saleAmount);
  }

  return categories;
}

export function buildMonthlyChannelData(currentSales: any[]) {
  const monthlyData: {
    month: string;
    onlineSales: number;
    retailSales: number;
  }[] = [];
  const today = new Date();

  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(today, i);
    const month = monthDate.toLocaleString('en-US', { month: 'short' });
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const monthOnlineSales = currentSales
      .filter((sale) => {
        const saleDate = sale.sale_date
          ? new Date(sale.sale_date)
          : new Date(sale.created_at);
        return (
          isOnlineSource(sale.source) &&
          saleDate >= monthStart &&
          saleDate <= monthEnd
        );
      })
      .reduce((sum, sale) => sum + getSalesAmount(sale), 0);

    const monthRetailSales = currentSales
      .filter((sale) => {
        const saleDate = sale.sale_date
          ? new Date(sale.sale_date)
          : new Date(sale.created_at);
        return (
          isRetailSource(sale.source) &&
          saleDate >= monthStart &&
          saleDate <= monthEnd
        );
      })
      .reduce((sum, sale) => sum + getSalesAmount(sale), 0);

    monthlyData.push({
      month,
      onlineSales: monthOnlineSales,
      retailSales: monthRetailSales,
    });
  }

  return monthlyData;
}
