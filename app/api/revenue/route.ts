import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { addDays, endOfDay, startOfDay, subDays } from 'date-fns';
import {
  addCalendarDays,
  inclusiveEndWithUtcSlack,
  parseDateParam,
  periodTypeFromDays,
  toDateOnly,
} from '@/lib/costs/aggregate-costs';
import {
  aggregateSalesByCategory,
  buildMonthlyChannelData,
  getSalesAmount,
  isOnlineSource,
  isRetailSource,
  mergeSalesById,
  percentChangeFrom,
  salesInLocalRange,
} from './revenue-aggregations';

export const dynamic = 'force-dynamic';

const emptyRevenuePayload = (extras: Record<string, unknown> = {}) => ({
  totalSales: {
    actual: 0,
    previous: 0,
    percentChange: 0,
    formattedActual: '0',
    formattedPrevious: '0',
  },
  channelSales: {
    online: { amount: 0, prevAmount: 0, percentChange: 0 },
    retail: { amount: 0, prevAmount: 0, percentChange: 0 },
  },
  averageOrderValue: { actual: 0, previous: 0, percentChange: 0 },
  salesCategories: [],
  monthlyData: [],
  salesDistribution: [],
  periodType: 'custom',
  noData: true,
  ...extras,
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');
    const segmentId = searchParams.get('segmentId');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const useDemoData = searchParams.get('useDemoData') === 'true';

    if (!siteId) {
      return NextResponse.json(
        { error: 'Site ID is required' },
        { status: 400 }
      );
    }

    if (siteId.startsWith('demo-')) {
      return NextResponse.json(
        emptyRevenuePayload({
          metadata: { warning: 'Demo site detected' },
        })
      );
    }

    const endDate = parseDateParam(endDateParam, new Date());
    const startDate = parseDateParam(startDateParam, subDays(endDate, 30));
    const today = toDateOnly(new Date());

    if (toDateOnly(startDate) > today) {
      console.warn(
        `[Revenue API] Future date detected in request - startDate: ${toDateOnly(startDate)}, endDate: ${toDateOnly(endDate)}`
      );
      return NextResponse.json(
        emptyRevenuePayload({
          metadata: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            prevStartDate: null,
            prevEndDate: null,
            segmentId: segmentId || 'all',
            message: 'Future dates were requested - no data available',
          },
        })
      );
    }

    const supabase = await createClient();
    const currentStart = toDateOnly(startDate);
    const currentEnd = toDateOnly(endDate);
    const periodLength = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.max(1, Math.floor(periodLength / (1000 * 60 * 60 * 24)));
    const periodType = periodTypeFromDays(daysDiff);
    const previousEnd = addCalendarDays(currentStart, -1);
    const previousStart = addCalendarDays(previousEnd, -(daysDiff - 1));

    const { data: currentSalesData, error: currentSalesError } = await fetchPeriodSales(
      supabase,
      siteId,
      segmentId,
      startDate,
      parseDateParam(currentEnd, endDate)
    );

    if (currentSalesError) {
      console.error('Error fetching current sales:', currentSalesError);
      return NextResponse.json(
        { error: 'Failed to fetch sales data' },
        { status: 500 }
      );
    }

    const { data: prevSalesData, error: prevSalesError } = await fetchPeriodSales(
      supabase,
      siteId,
      segmentId,
      parseDateParam(previousStart, startDate),
      parseDateParam(previousEnd, startDate)
    );

    if (prevSalesError) {
      console.error('Error fetching previous sales:', prevSalesError);
      return NextResponse.json(
        { error: 'Failed to fetch previous sales data' },
        { status: 500 }
      );
    }

    const hasSalesData = currentSalesData && currentSalesData.length > 0;

    if (!hasSalesData) {
      if (useDemoData) {
        console.log(
          'Using demo values for sales as explicitly requested, but delegating to empty structure since we have real demo mock data now.'
        );
      }

      console.log(
        'No sales data found for the specified period. Returning empty dataset.'
      );
      return NextResponse.json(
        emptyRevenuePayload({
          periodType,
          metadata: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            prevStartDate: previousStart,
            prevEndDate: previousEnd,
            segmentId: segmentId || 'all',
          },
        })
      );
    }

    const currentSales = currentSalesData || [];
    const prevSales = prevSalesData || [];

    const totalSales = currentSales.reduce(
      (sum, sale) => sum + getSalesAmount(sale),
      0
    );
    const prevTotalSales = prevSales.reduce(
      (sum, sale) => sum + getSalesAmount(sale),
      0
    );
    const percentChange = percentChangeFrom(prevTotalSales, totalSales);

    const onlineSalesAmount = currentSales
      .filter((sale) => isOnlineSource(sale.source))
      .reduce((sum, sale) => sum + getSalesAmount(sale), 0);

    const prevOnlineSalesAmount = prevSales
      .filter((sale) => isOnlineSource(sale.source))
      .reduce((sum, sale) => sum + getSalesAmount(sale), 0);

    const retailSalesAmount = currentSales
      .filter((sale) => isRetailSource(sale.source))
      .reduce((sum, sale) => sum + getSalesAmount(sale), 0);

    const prevRetailSalesAmount = prevSales
      .filter((sale) => isRetailSource(sale.source))
      .reduce((sum, sale) => sum + getSalesAmount(sale), 0);

    const onlinePercentChange = percentChangeFrom(
      prevOnlineSalesAmount,
      onlineSalesAmount
    );
    const retailPercentChange = percentChangeFrom(
      prevRetailSalesAmount,
      retailSalesAmount
    );

    const currentTransactions = currentSales.length;
    const prevTransactions = prevSales.length;
    const currentAOV =
      currentTransactions > 0 ? totalSales / currentTransactions : 0;
    const prevAOV = prevTransactions > 0 ? prevTotalSales / prevTransactions : 0;
    const aovPercentChange = percentChangeFrom(prevAOV, currentAOV);

    const categories = await aggregateSalesByCategory(supabase, currentSales);
    const prevCategories = await aggregateSalesByCategory(supabase, prevSales);

    const salesCategories = Array.from(categories.entries()).map(
      ([name, amount]) => {
        const prevAmount = prevCategories.get(name) || 0;
        return {
          name,
          amount,
          prevAmount,
          percentChange:
            parseFloat(percentChangeFrom(prevAmount, amount).toFixed(1)) || 0,
        };
      }
    );

    const salesDistribution = Array.from(categories.entries()).map(
      ([category, amount]) => {
        const percentage =
          totalSales > 0 ? Math.round((amount / totalSales) * 100) : 0;
        return { category, percentage, amount };
      }
    );

    const monthlyData = buildMonthlyChannelData(currentSales);

    return NextResponse.json({
      totalSales: {
        actual: totalSales,
        previous: prevTotalSales,
        percentChange: parseFloat(percentChange.toFixed(1)) || 0,
        formattedActual: totalSales.toLocaleString(),
        formattedPrevious: prevTotalSales.toLocaleString(),
      },
      channelSales: {
        online: {
          amount: onlineSalesAmount,
          prevAmount: prevOnlineSalesAmount,
          percentChange: parseFloat(onlinePercentChange.toFixed(1)) || 0,
        },
        retail: {
          amount: retailSalesAmount,
          prevAmount: prevRetailSalesAmount,
          percentChange: parseFloat(retailPercentChange.toFixed(1)) || 0,
        },
      },
      averageOrderValue: {
        actual: currentAOV,
        previous: prevAOV,
        percentChange: parseFloat(aovPercentChange.toFixed(1)) || 0,
      },
      salesCategories,
      monthlyData,
      salesDistribution,
      periodType,
      metadata: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        prevStartDate: previousStart,
        prevEndDate: previousEnd,
        segmentId: segmentId || 'all',
      },
    });
  } catch (error) {
    console.error('Error in Revenue API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function fetchPeriodSales(
  supabase: { from: (table: string) => any },
  siteId: string,
  segmentId: string | null,
  startDate: Date,
  endDate: Date
) {
  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  const endInclusive = inclusiveEndWithUtcSlack(end);
  const startSlack = addCalendarDays(start, -1);

  const applyFilters = (query: any) => {
    let next = query
      .eq('site_id', siteId)
      .in('status', ['completed', 'pending']);
    if (segmentId && segmentId !== 'all') {
      next = next.eq('segment_id', segmentId);
    }
    return next;
  };

  const bySaleDate = applyFilters(supabase.from('sales').select('*'))
    .gte('sale_date', startSlack)
    .lte('sale_date', endInclusive);

  const byCreatedAt = applyFilters(supabase.from('sales').select('*'))
    .gte('created_at', startOfDay(addDays(startDate, -1)).toISOString())
    .lte('created_at', endOfDay(addDays(endDate, 1)).toISOString());

  const [saleDateResult, createdAtResult] = await Promise.all([
    bySaleDate,
    byCreatedAt,
  ]);

  if (saleDateResult.error) {
    return { data: null, error: saleDateResult.error };
  }
  if (createdAtResult.error) {
    return { data: null, error: createdAtResult.error };
  }

  return {
    data: salesInLocalRange(
      mergeSalesById(saleDateResult.data, createdAtResult.data),
      start,
      endInclusive
    ),
    error: null,
  };
}
