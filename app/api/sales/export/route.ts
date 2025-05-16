import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch all sales for the site
    const { data: sales, error } = await supabase
      .from('sales')
      .select('*, leads(name)')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sales:', error);
      return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 });
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

    const rows = sales.map(sale => [
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
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
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
  }
} 