import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { subDays, subMonths, format } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');
    const userId = searchParams.get('userId');
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

    // Parse dates
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam ? new Date(startDateParam) : subDays(endDate, 30);

    // Validate against future dates
    const now = new Date();
    if (startDate > now || endDate > now) {
      console.warn(`[Revenue API] Future date detected in request - startDate: ${startDate.toISOString()}, endDate: ${endDate.toISOString()}`);
      return NextResponse.json({
        totalSales: {
          actual: 0,
          previous: 0,
          percentChange: 0,
          formattedActual: "0",
          formattedPrevious: "0"
        },
        channelSales: {
          online: { amount: 0, prevAmount: 0, percentChange: 0 },
          retail: { amount: 0, prevAmount: 0, percentChange: 0 }
        },
        averageOrderValue: { actual: 0, previous: 0, percentChange: 0 },
        salesCategories: [],
        monthlyData: [],
        salesDistribution: [],
        periodType: "custom",
        noData: true,
        metadata: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          prevStartDate: null,
          prevEndDate: null,
          segmentId: segmentId || 'all',
          message: "Future dates were requested - no data available"
        }
      });
    }

    // Calculate previous period
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousPeriodEnd = new Date(startDate.getTime() - 1);
    const previousPeriodStart = new Date(previousPeriodEnd.getTime() - periodLength);

    // Initialize Supabase client
    const supabase = await createClient();

    // Calculate period type
    let periodType = "custom";
    const daysDiff = Math.floor(periodLength / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 1) periodType = "daily";
    else if (daysDiff <= 7) periodType = "weekly";
    else if (daysDiff <= 31) periodType = "monthly";
    else if (daysDiff <= 92) periodType = "quarterly";
    else periodType = "yearly";

    // Fetch sales for current period
    let salesQuery = supabase
      .from('sales')
      .select('*')
      .eq('site_id', siteId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .eq('status', 'completed');
    
    // Apply segment filter if provided and not 'all'
    if (segmentId && segmentId !== 'all') {
      salesQuery = salesQuery.eq('segment_id', segmentId);
    }
    
    const { data: currentSalesData, error: currentSalesError } = await salesQuery;
    
    if (currentSalesError) {
      console.error('Error fetching current sales:', currentSalesError);
      return NextResponse.json(
        { error: 'Failed to fetch sales data' },
        { status: 500 }
      );
    }
    
    // Fetch sales for previous period
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
    
    const { data: prevSalesData, error: prevSalesError } = await prevSalesQuery;
    
    if (prevSalesError) {
      console.error('Error fetching previous sales:', prevSalesError);
      return NextResponse.json(
        { error: 'Failed to fetch previous sales data' },
        { status: 500 }
      );
    }

    // Check if we have any sales data
    const hasSalesData = currentSalesData && currentSalesData.length > 0;
    
    // If no sales data found, either return demo data or minimal response
    if (!hasSalesData) {
      if (useDemoData) {
        console.log('Using demo values for sales as explicitly requested');
        
        // Total sales data
        const totalSales = 125000;
        const prevTotalSales = 105000;
        const percentChange = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : (totalSales > 0 ? 100 : 0);
        
        // Channel sales data
        const onlineSales = { 
          amount: 85000, 
          prevAmount: 70000, 
          percentChange: 70000 > 0 ? ((85000 - 70000) / 70000) * 100 : (85000 > 0 ? 100 : 0)
        };
        const retailSales = { 
          amount: 40000, 
          prevAmount: 35000, 
          percentChange: 35000 > 0 ? ((40000 - 35000) / 35000) * 100 : (40000 > 0 ? 100 : 0)
        };
        
        // Average order value
        const aov = { 
          actual: 125, 
          previous: 115, 
          percentChange: 115 > 0 ? ((125 - 115) / 115) * 100 : (125 > 0 ? 100 : 0)
        };
        
        // Product categories
        const salesCategories = [
          { 
            name: "Electronics", 
            amount: 55000, 
            prevAmount: 42000, 
            percentChange: 42000 > 0 ? ((55000 - 42000) / 42000) * 100 : (55000 > 0 ? 100 : 0)
          },
          { 
            name: "Clothing", 
            amount: 35000, 
            prevAmount: 33000, 
            percentChange: 33000 > 0 ? ((35000 - 33000) / 33000) * 100 : (35000 > 0 ? 100 : 0)
          },
          { 
            name: "Home", 
            amount: 25000, 
            prevAmount: 22000, 
            percentChange: 22000 > 0 ? ((25000 - 22000) / 22000) * 100 : (25000 > 0 ? 100 : 0)
          },
          { 
            name: "Beauty", 
            amount: 10000, 
            prevAmount: 8000, 
            percentChange: 8000 > 0 ? ((10000 - 8000) / 8000) * 100 : (10000 > 0 ? 100 : 0)
          }
        ];
        
        // Sales distribution
        const salesDistribution = [
          { category: "Electronics", percentage: 44, amount: 55000 },
          { category: "Clothing", percentage: 28, amount: 35000 },
          { category: "Home", percentage: 20, amount: 25000 },
          { category: "Beauty", percentage: 8, amount: 10000 }
        ];
        
        // Monthly sales data - last 6 months
        const monthlyData = [];
        const today = new Date();
        
        for (let i = 5; i >= 0; i--) {
          const monthDate = subMonths(today, i);
          const month = monthDate.toLocaleString('en-US', { month: 'short' });
          
          monthlyData.push({
            month,
            onlineSales: 15000 + Math.round(Math.random() * 10000),
            retailSales: 8000 + Math.round(Math.random() * 4000)
          });
        }
        
        return NextResponse.json({
          totalSales: {
            actual: totalSales,
            previous: prevTotalSales,
            percentChange,
            formattedActual: totalSales.toLocaleString(),
            formattedPrevious: prevTotalSales.toLocaleString()
          },
          channelSales: {
            online: onlineSales,
            retail: retailSales
          },
          averageOrderValue: aov,
          salesCategories,
          monthlyData,
          salesDistribution,
          periodType,
          isDemoData: true,
          metadata: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            prevStartDate: previousPeriodStart.toISOString(),
            prevEndDate: previousPeriodEnd.toISOString(),
            segmentId: segmentId || 'all'
          }
        });
      } else {
        console.log('No sales data found for the specified period. Returning empty dataset.');
        // Return minimal data structure with zeros
        return NextResponse.json({
          totalSales: {
            actual: 0,
            previous: 0,
            percentChange: 0,
            formattedActual: "0",
            formattedPrevious: "0"
          },
          channelSales: {
            online: { amount: 0, prevAmount: 0, percentChange: 0 },
            retail: { amount: 0, prevAmount: 0, percentChange: 0 }
          },
          averageOrderValue: { actual: 0, previous: 0, percentChange: 0 },
          salesCategories: [],
          monthlyData: [],
          salesDistribution: [],
          periodType,
          noData: true,
          metadata: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            prevStartDate: previousPeriodStart.toISOString(),
            prevEndDate: previousPeriodEnd.toISOString(),
            segmentId: segmentId || 'all'
          }
        });
      }
    }
    
    // Process real sales data
    const currentSales = currentSalesData || [];
    const prevSales = prevSalesData || [];
    
    // Calculate total sales
    const getSalesAmount = (sale: any) => {
      if (!sale || !sale.amount) return 0;
      const amount = typeof sale.amount === 'number' ? sale.amount : 
                     parseFloat(String(sale.amount).replace(/[^0-9.-]+/g, ''));
      return isNaN(amount) ? 0 : amount;
    };
    
    const totalSales = currentSales.reduce((sum, sale) => sum + getSalesAmount(sale), 0);
    const prevTotalSales = prevSales.reduce((sum, sale) => sum + getSalesAmount(sale), 0);
    
    // Calculate percent change - if previous value is 0 and current value > 0, show 100% increase
    let percentChange = 0;
    if (prevTotalSales > 0) {
      percentChange = ((totalSales - prevTotalSales) / prevTotalSales) * 100;
    } else if (totalSales > 0) {
      percentChange = 100; // 100% increase when coming from 0
    }
    // Ensure percentChange is not NaN
    percentChange = isNaN(percentChange) ? 0 : percentChange;
    
    // Group by sales source
    const onlineSalesAmount = currentSales
      .filter(sale => sale.source === 'online')
      .reduce((sum, sale) => sum + getSalesAmount(sale), 0);
      
    const prevOnlineSalesAmount = prevSales
      .filter(sale => sale.source === 'online')
      .reduce((sum, sale) => sum + getSalesAmount(sale), 0);
      
    const retailSalesAmount = currentSales
      .filter(sale => sale.source === 'retail')
      .reduce((sum, sale) => sum + getSalesAmount(sale), 0);
      
    const prevRetailSalesAmount = prevSales
      .filter(sale => sale.source === 'retail')
      .reduce((sum, sale) => sum + getSalesAmount(sale), 0);
    
    // Calculate channel percent changes with same logic as above
    let onlinePercentChange = 0;
    if (prevOnlineSalesAmount > 0) {
      onlinePercentChange = ((onlineSalesAmount - prevOnlineSalesAmount) / prevOnlineSalesAmount) * 100;
    } else if (onlineSalesAmount > 0) {
      onlinePercentChange = 100;
    }
    onlinePercentChange = isNaN(onlinePercentChange) ? 0 : onlinePercentChange;
      
    let retailPercentChange = 0;
    if (prevRetailSalesAmount > 0) {
      retailPercentChange = ((retailSalesAmount - prevRetailSalesAmount) / prevRetailSalesAmount) * 100;
    } else if (retailSalesAmount > 0) {
      retailPercentChange = 100;
    }
    retailPercentChange = isNaN(retailPercentChange) ? 0 : retailPercentChange;
    
    // Calculate AOV (Average Order Value)
    const currentTransactions = currentSales.length;
    const prevTransactions = prevSales.length;
    
    const currentAOV = currentTransactions > 0 ? totalSales / currentTransactions : 0;
    const prevAOV = prevTransactions > 0 ? prevTotalSales / prevTransactions : 0;
    
    // Apply same logic to AOV percent change
    let aovPercentChange = 0;
    if (prevAOV > 0) {
      aovPercentChange = ((currentAOV - prevAOV) / prevAOV) * 100;
    } else if (currentAOV > 0) {
      aovPercentChange = 100;
    }
    aovPercentChange = isNaN(aovPercentChange) ? 0 : aovPercentChange;
    
    // Group by product category
    const categories = new Map<string, number>();
    const prevCategories = new Map<string, number>();
    
    // Group sales by category
    currentSales.forEach(sale => {
      const category = sale.product_type || sale.product_category || 'Other';
      const amount = getSalesAmount(sale);
      
      if (categories.has(category)) {
        categories.set(category, (categories.get(category) || 0) + amount);
      } else {
        categories.set(category, amount);
      }
    });
    
    prevSales.forEach(sale => {
      const category = sale.product_type || sale.product_category || 'Other';
      const amount = getSalesAmount(sale);
      
      if (prevCategories.has(category)) {
        prevCategories.set(category, (prevCategories.get(category) || 0) + amount);
      } else {
        prevCategories.set(category, amount);
      }
    });
    
    // Create sales categories array with percent changes
    const salesCategories = Array.from(categories.entries()).map(([name, amount]) => {
      const prevAmount = prevCategories.get(name) || 0;
      
      // Calculate percent change with same logic
      let percentChange = 0;
      if (prevAmount > 0) {
        percentChange = ((amount - prevAmount) / prevAmount) * 100;
      } else if (amount > 0) {
        percentChange = 100;
      }
      percentChange = isNaN(percentChange) ? 0 : percentChange;
      
      return {
        name,
        amount,
        prevAmount,
        percentChange: parseFloat(percentChange.toFixed(1)) || 0
      };
    });
    
    // Create sales distribution with percentages
    const salesDistribution = Array.from(categories.entries()).map(([category, amount]) => {
      const percentage = totalSales > 0 ? Math.round((amount / totalSales) * 100) : 0;
      
      return {
        category,
        percentage,
        amount
      };
    });
    
    // Monthly sales data - last 6 months
    const monthlyData = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(today, i);
      const month = monthDate.toLocaleString('en-US', { month: 'short' });
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      
      // Filter sales for this month
      const monthOnlineSales = currentSales
        .filter(sale => {
          const saleDate = new Date(sale.created_at);
          return sale.source === 'online' && 
                 saleDate >= monthStart && 
                 saleDate <= monthEnd;
        })
        .reduce((sum, sale) => sum + getSalesAmount(sale), 0);
        
      const monthRetailSales = currentSales
        .filter(sale => {
          const saleDate = new Date(sale.created_at);
          return sale.source === 'retail' && 
                 saleDate >= monthStart && 
                 saleDate <= monthEnd;
        })
        .reduce((sum, sale) => sum + getSalesAmount(sale), 0);
      
      monthlyData.push({
        month,
        onlineSales: monthOnlineSales,
        retailSales: monthRetailSales
      });
    }
    
    // Return the formatted response with real data
    return NextResponse.json({
      totalSales: {
        actual: totalSales,
        previous: prevTotalSales,
        percentChange: isNaN(parseFloat(percentChange.toFixed(1))) ? 0 : parseFloat(percentChange.toFixed(1)),
        formattedActual: totalSales.toLocaleString(),
        formattedPrevious: prevTotalSales.toLocaleString()
      },
      channelSales: {
        online: {
          amount: onlineSalesAmount,
          prevAmount: prevOnlineSalesAmount,
          percentChange: isNaN(parseFloat(onlinePercentChange.toFixed(1))) ? 0 : parseFloat(onlinePercentChange.toFixed(1))
        },
        retail: {
          amount: retailSalesAmount,
          prevAmount: prevRetailSalesAmount,
          percentChange: isNaN(parseFloat(retailPercentChange.toFixed(1))) ? 0 : parseFloat(retailPercentChange.toFixed(1))
        }
      },
      averageOrderValue: {
        actual: currentAOV,
        previous: prevAOV,
        percentChange: isNaN(parseFloat(aovPercentChange.toFixed(1))) ? 0 : parseFloat(aovPercentChange.toFixed(1))
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
        segmentId: segmentId || 'all'
      }
    });
    
  } catch (error) {
    console.error('Error in Revenue API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 