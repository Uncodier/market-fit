import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { subDays, format } from 'date-fns';
import {
  aggregateSalesByCategory,
  buildMonthlyChannelData,
  getSalesAmount,
  isOnlineSource,
  isRetailSource,
  percentChangeFrom,
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

    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam ? new Date(startDateParam) : subDays(endDate, 30);

    const now = new Date();
    if (startDate > now || endDate > now) {
      console.warn(
        `[Revenue API] Future date detected in request - startDate: ${startDate.toISOString()}, endDate: ${endDate.toISOString()}`
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

    const periodLength = endDate.getTime() - startDate.getTime();
    const previousPeriodEnd = new Date(startDate.getTime() - 1);
    const previousPeriodStart = new Date(previousPeriodEnd.getTime() - periodLength);

    const supabase = await createClient();

    let periodType = 'custom';
    const daysDiff = Math.floor(periodLength / (1000 * 60 * 60 * 24));

    if (daysDiff <= 1) periodType = 'daily';
    else if (daysDiff <= 7) periodType = 'weekly';
    else if (daysDiff <= 31) periodType = 'monthly';
    else if (daysDiff <= 92) periodType = 'quarterly';
    else periodType = 'yearly';

    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    let salesQuerySaleDate = supabase
      .from('sales')
      .select('*')
      .eq('site_id', siteId)
      .gte('sale_date', startDateStr)
      .lte('sale_date', endDateStr)
      .eq('status', 'completed');

    if (segmentId && segmentId !== 'all') {
      salesQuerySaleDate = salesQuerySaleDate.eq('segment_id', segmentId);
    }

    const { data: currentSalesDataSaleDate, error: currentSalesErrorSaleDate } =
      await salesQuerySaleDate;

    let currentSalesData = currentSalesDataSaleDate;
    let currentSalesError = currentSalesErrorSaleDate;

    if (
      currentSalesErrorSaleDate ||
      !currentSalesDataSaleDate ||
      currentSalesDataSaleDate.length === 0
    ) {
      console.log('[Revenue API] Using created_at fallback for current period');

      let salesQuery = supabase
        .from('sales')
        .select('*')
        .eq('site_id', siteId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('status', 'completed');

      if (segmentId && segmentId !== 'all') {
        salesQuery = salesQuery.eq('segment_id', segmentId);
      }

      const result = await salesQuery;
      currentSalesData = result.data;
      currentSalesError = result.error;
    } else {
      console.log('[Revenue API] Using sale_date for current period');
    }

    if (currentSalesError) {
      console.error('Error fetching current sales:', currentSalesError);
      return NextResponse.json(
        { error: 'Failed to fetch sales data' },
        { status: 500 }
      );
    }

    const prevStartDateStr = format(previousPeriodStart, 'yyyy-MM-dd');
    const prevEndDateStr = format(previousPeriodEnd, 'yyyy-MM-dd');

    let prevSalesQuerySaleDate = supabase
      .from('sales')
      .select('*')
      .eq('site_id', siteId)
      .gte('sale_date', prevStartDateStr)
      .lte('sale_date', prevEndDateStr)
      .eq('status', 'completed');

    if (segmentId && segmentId !== 'all') {
      prevSalesQuerySaleDate = prevSalesQuerySaleDate.eq('segment_id', segmentId);
    }

    const { data: prevSalesDataSaleDate, error: prevSalesErrorSaleDate } =
      await prevSalesQuerySaleDate;

    let prevSalesData = prevSalesDataSaleDate;
    let prevSalesError = prevSalesErrorSaleDate;

    if (
      prevSalesErrorSaleDate ||
      !prevSalesDataSaleDate ||
      prevSalesDataSaleDate.length === 0
    ) {
      console.log('[Revenue API] Using created_at fallback for previous period');

      let prevSalesQuery = supabase
        .from('sales')
        .select('*')
        .eq('site_id', siteId)
        .gte('created_at', previousPeriodStart.toISOString())
        .lte('created_at', previousPeriodEnd.toISOString())
        .eq('status', 'completed');

      if (segmentId && segmentId !== 'all') {
        prevSalesQuery = prevSalesQuery.eq('segment_id', segmentId);
      }

      const result = await prevSalesQuery;
      prevSalesData = result.data;
      prevSalesError = result.error;
    } else {
      console.log('[Revenue API] Using sale_date for previous period');
    }

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
            prevStartDate: previousPeriodStart.toISOString(),
            prevEndDate: previousPeriodEnd.toISOString(),
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
        prevStartDate: previousPeriodStart.toISOString(),
        prevEndDate: previousPeriodEnd.toISOString(),
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
