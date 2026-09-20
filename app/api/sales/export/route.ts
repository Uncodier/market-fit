import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import { requireSiteAccess } from '@/lib/auth/api-site-access';
import {
  acquireSemaphore,
  hashRedisKeyPart,
  releaseSemaphore,
} from '@/lib/redis/control-plane';
import { isRedisConfigured } from '@/lib/redis/upstash-rest';

const MAX_EXPORT_ROWS = 10_000;

export async function GET(request: Request) {
  let semaphoreKey: string | null = null;
  let semaphoreOwner: string | null = null;
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }

    const access = await requireSiteAccess(request, siteId);
    if (access.error) return access.error;

    if (isRedisConfigured()) {
      semaphoreKey = `sem:v1:sales-export:${await hashRedisKeyPart(siteId)}`;
      semaphoreOwner = crypto.randomUUID();
      const admitted = await acquireSemaphore(
        semaphoreKey,
        semaphoreOwner,
        1,
        120_000
      );
      if (!admitted) {
        return NextResponse.json(
          { error: 'An export is already running for this site' },
          { status: 429, headers: { 'Retry-After': '5' } }
        );
      }
    }

    const supabase = await createClient();

    // Fetch all sales for the site
    const { data: sales, error } = await supabase
      .from('sales')
      .select('*, leads(name)')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(MAX_EXPORT_ROWS + 1);

    if (error) {
      console.error('Error fetching sales:', error);
      return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 });
    }
    if (sales.length > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        { error: 'This export is too large. Narrow the result set and try again.' },
        { status: 413 }
      );
    }

    // Convert sales data to CSV format
    const headers = [
      'Title',
      'Product',
      'Type',
      'Amount',
      'Amount Due',
      'Status',
      'Lead',
      'Source',
      'Date',
      'Payment Method',
      'Created At'
    ];

    const rows = sales.map((sale: any) => [
      sale.title,
      sale.product_name || '',
      sale.product_type || '',
      sale.amount,
      sale.amount_due || sale.amount,
      sale.status,
      sale.leads?.name || 'Anonymous',
      sale.source,
      format(new Date(sale.sale_date), 'yyyy-MM-dd'),
      sale.payment_method || '',
      format(new Date(sale.created_at), 'yyyy-MM-dd HH:mm:ss')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: unknown[]) =>
        row.map((cell: unknown) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n');

    // Create and return the CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=sales-${format(new Date(), 'yyyy-MM-dd')}.csv`
      }
    });
  } catch (error) {
    console.error('Error in export endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    if (semaphoreKey && semaphoreOwner) {
      await releaseSemaphore(semaphoreKey, semaphoreOwner);
    }
  }
} 