/**
 * Fixed Financial Projections Component
 * Compatible with existing ROI calculator data structure
 */

"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { TrendingUp, BarChart, Calendar, Download } from "@/app/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut";

interface MonthlyProjection {
  month: number;
  monthName: string;
  revenue: number;
  costs: number;
  profit: number;
  customers: number;
  leads: number;
  cac: number;
  ltv: number;
  roi: number;
  cumulativeRevenue: number;
  cumulativeProfit: number;
}

interface FinancialProjectionsProps {
  baseMetrics: any;
  simulatedMetrics?: any;
  timeframe?: number;
  state?: any;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function FinancialProjectionsFixed({ 
  baseMetrics, 
  simulatedMetrics, 
  timeframe = 12,
  state
}: FinancialProjectionsProps) {
  const [selectedScenario, setSelectedScenario] = useState<'base' | 'simulated'>('base');
  const [viewMode, setViewMode] = useState<'summary' | 'detailed' | 'quarterly'>('summary');

  // Generate monthly projections
  const projections = useMemo(() => {
    const metrics = selectedScenario === 'simulated' && simulatedMetrics ? simulatedMetrics : baseMetrics;
    
    if (!metrics?.filledKpis) return [];

    const monthlyProjections: MonthlyProjection[] = [];
    let cumulativeRevenue = 0;
    let cumulativeProfit = 0;
    
    // Get current month to start projections from today
    const currentDate = new Date();
    const currentMonthIndex = currentDate.getMonth(); // 0-based (0 = January)
    const currentYear = currentDate.getFullYear();

    // Calculate growth rate from user's actual data
    const calculateMonthlyGrowthRate = () => {
      const currentMonthlyRevenue = metrics.filledKpis.monthlyRevenue || 0;
      const annualRevenue = parseFloat(state?.annual_revenue || '0') || 0;
      
      if (currentMonthlyRevenue > 0 && annualRevenue > 0) {
        // Calculate implied annual revenue from current monthly
        const impliedAnnualFromMonthly = currentMonthlyRevenue * 12;
        
        if (Math.abs(annualRevenue - impliedAnnualFromMonthly) > impliedAnnualFromMonthly * 0.1) {
          // If there's more than 10% difference, calculate the growth rate
          // Assume current monthly is mid-year, so calculate growth to reach annual target
          const growthNeeded = annualRevenue / impliedAnnualFromMonthly;
          const monthsToGrow = 6; // Assume 6 months of growth remaining
          const monthlyGrowthRate = Math.pow(growthNeeded, 1/monthsToGrow) - 1;
          
          // Cap growth rate between -10% and +15% monthly for realism
          return Math.max(-0.10, Math.min(0.15, monthlyGrowthRate));
        }
      }
      
      // Fallback to industry-based growth rate
      const industry = state?.industry || '';
      const companySize = state?.company_size || '';
      
      // Industry-based growth rates
      const industryGrowthRates: { [key: string]: number } = {
        'technology': 0.08,     // 8% monthly for tech
        'saas': 0.10,          // 10% monthly for SaaS
        'ecommerce': 0.06,     // 6% monthly for e-commerce
        'healthcare': 0.04,    // 4% monthly for healthcare
        'finance': 0.03,       // 3% monthly for finance
        'manufacturing': 0.02, // 2% monthly for manufacturing
        'services': 0.05,      // 5% monthly for services (default)
        'retail': 0.04,        // 4% monthly for retail
        'education': 0.03,     // 3% monthly for education
        'real-estate': 0.04,   // 4% monthly for real estate
      };
      
      // Company size multipliers
      const sizeMultipliers: { [key: string]: number } = {
        '1-10': 1.2,      // Startups grow faster
        '11-50': 1.1,     // Small companies
        '51-200': 1.0,    // Medium companies
        '201-1000': 0.9,  // Large companies grow slower
        '1000+': 0.8,     // Enterprise grows slowest
      };
      
      const baseRate = industryGrowthRates[industry.toLowerCase()] || industryGrowthRates['services'];
      const sizeMultiplier = sizeMultipliers[companySize] || 1.0;
      
      return baseRate * sizeMultiplier;
    };

    const monthlyGrowthRate = calculateMonthlyGrowthRate();
    const seasonalityFactors = [0.9, 0.95, 1.0, 1.05, 1.1, 1.05, 0.95, 0.9, 1.0, 1.1, 1.15, 1.2];

    // Base metrics
    const baseMonthlyRevenue = metrics.filledKpis.monthlyRevenue || 0;
    const baseMonthlyLeads = metrics.filledKpis.monthlyLeads || 0;
    const baseConversionRate = metrics.filledKpis.conversionRate || 2.5;
    const baseAOV = metrics.filledKpis.averageOrderValue || 0;
    const churnRate = (metrics.filledKpis.churnRate || 5) / 100; // Convert to decimal
    
    // Calculate cost percentages based on current revenue (consistent with utils.ts)
    const costPercentages = {
      marketing: baseMonthlyRevenue > 0 ? (metrics.filledCosts?.marketingBudget || 0) / baseMonthlyRevenue : 0.15, // Default 15%
      salesTeam: baseMonthlyRevenue > 0 ? (metrics.filledCosts?.salesTeamCost || 0) / baseMonthlyRevenue : 0.20, // Default 20%
      salesCommission: baseMonthlyRevenue > 0 ? (metrics.filledCosts?.salesCommission || 0) / baseMonthlyRevenue : 0.08, // Default 8%
      technology: baseMonthlyRevenue > 0 ? (metrics.filledCosts?.technologyCosts || 0) / baseMonthlyRevenue : 0.05, // Default 5%
      operational: baseMonthlyRevenue > 0 ? (metrics.filledCosts?.operationalCosts || 0) / baseMonthlyRevenue : 0.10, // Default 10%
      other: baseMonthlyRevenue > 0 ? (metrics.filledCosts?.otherCosts || 0) / baseMonthlyRevenue : 0.05, // Default 5%
      cogs: baseMonthlyRevenue > 0 ? (metrics.filledCosts?.cogs || 0) / baseMonthlyRevenue : 0.35, // Default 35%
    };

    // Track accumulated new customers and their revenue
    let accumulatedNewCustomers = 0;
    let accumulatedNewCustomerRevenue = 0;

    for (let month = 1; month <= timeframe; month++) {
      const growthFactor = Math.pow(1 + monthlyGrowthRate, month - 1);
      const seasonalFactor = seasonalityFactors[(month - 1) % 12];
      const combinedFactor = growthFactor * seasonalFactor;

      // Calculate new customers acquired this month
      const monthlyLeads = Math.round(baseMonthlyLeads * combinedFactor);
      const newCustomersThisMonth = Math.round(monthlyLeads * baseConversionRate / 100);
      
      // Apply churn to EXISTING new customers (not base revenue)
      accumulatedNewCustomers = accumulatedNewCustomers * (1 - churnRate) + newCustomersThisMonth;
      
      // Calculate revenue from new customers (with AOV growth)
      const currentAOV = baseAOV * combinedFactor;
      accumulatedNewCustomerRevenue = accumulatedNewCustomers * currentAOV;
      
      // Total revenue = base recurring revenue + revenue from accumulated new customers
      const totalMonthlyRevenue = baseMonthlyRevenue + accumulatedNewCustomerRevenue;
      
      // Calculate costs as percentages of total revenue (consistent with utils.ts breakdown)
      const monthlyCosts = {
        marketing: totalMonthlyRevenue * costPercentages.marketing * combinedFactor,
        salesTeam: totalMonthlyRevenue * costPercentages.salesTeam * combinedFactor,
        salesCommission: totalMonthlyRevenue * costPercentages.salesCommission,
        technology: totalMonthlyRevenue * costPercentages.technology * combinedFactor,
        operational: totalMonthlyRevenue * costPercentages.operational * combinedFactor,
        other: totalMonthlyRevenue * costPercentages.other * combinedFactor,
        cogs: totalMonthlyRevenue * costPercentages.cogs, // COGS always proportional to revenue
      };
      
      const totalMonthlyCosts = Object.values(monthlyCosts).reduce((sum, cost) => sum + cost, 0);
      const monthlyProfit = totalMonthlyRevenue - totalMonthlyCosts;

      cumulativeRevenue += totalMonthlyRevenue;
      cumulativeProfit += monthlyProfit;

      const cac = newCustomersThisMonth > 0 ? 
        monthlyCosts.marketing / newCustomersThisMonth : 
        (metrics.filledKpis.customerAcquisitionCost || 0);

      // Calculate the actual month index starting from current month
      const actualMonthIndex = (currentMonthIndex + month - 1) % 12;
      const actualYear = currentYear + Math.floor((currentMonthIndex + month - 1) / 12);
      const monthName = `${MONTH_NAMES[actualMonthIndex]} ${actualYear.toString().slice(-2)}`;
      
      monthlyProjections.push({
        month,
        monthName,
        revenue: totalMonthlyRevenue,
        costs: totalMonthlyCosts,
        profit: monthlyProfit,
        customers: Math.round(accumulatedNewCustomers), // Only new customers (base customers are implicit in base revenue)
        leads: monthlyLeads,
        cac: cac,
        ltv: metrics.filledKpis.customerLifetimeValue || 0,
        roi: totalMonthlyCosts > 0 ? ((totalMonthlyRevenue - totalMonthlyCosts) / totalMonthlyCosts) * 100 : 0,
        cumulativeRevenue,
        cumulativeProfit,
      });
    }

    return monthlyProjections;
  }, [baseMetrics, simulatedMetrics, selectedScenario, timeframe, state]);

  // Calculate quarterly summaries
  const quarterlyData = useMemo(() => {
    const quarters = [];
    for (let q = 0; q < Math.ceil(projections.length / 3); q++) {
      const quarterMonths = projections.slice(q * 3, (q + 1) * 3);
      if (quarterMonths.length === 0) break;

      const quarterRevenue = quarterMonths.reduce((sum, month) => sum + month.revenue, 0);
      const quarterCosts = quarterMonths.reduce((sum, month) => sum + month.costs, 0);
      const quarterProfit = quarterRevenue - quarterCosts;
      const quarterCustomers = quarterMonths.reduce((sum, month) => sum + month.customers, 0);

      quarters.push({
        quarter: q + 1,
        revenue: quarterRevenue,
        costs: quarterCosts,
        profit: quarterProfit,
        customers: quarterCustomers,
        roi: quarterCosts > 0 ? (quarterProfit / quarterCosts) * 100 : 0,
      });
    }
    return quarters;
  }, [projections]);

  // Key insights
  const insights = useMemo(() => {
    if (projections.length === 0) return [];

    const totalRevenue = projections.reduce((sum, month) => sum + month.revenue, 0);
    const totalCosts = projections.reduce((sum, month) => sum + month.costs, 0);
    const totalProfit = totalRevenue - totalCosts;
    const avgMonthlyGrowth = projections.length > 1 ? 
      Math.pow(projections[projections.length - 1].revenue / projections[0].revenue, 1 / (projections.length - 1)) - 1 : 0;

    return [
      {
        title: 'Total Revenue Projection',
        value: formatCurrency(totalRevenue),
        trend: totalRevenue > 0 ? 'positive' : 'neutral',
      },
      {
        title: 'Total Profit Projection',
        value: formatCurrency(totalProfit),
        trend: totalProfit > 0 ? 'positive' : 'negative',
      },
      {
        title: 'Average Monthly Growth',
        value: `${(avgMonthlyGrowth * 100).toFixed(1)}%`,
        trend: avgMonthlyGrowth > 0 ? 'positive' : 'negative',
      },
      {
        title: 'Break-even Month',
        value: projections.find(p => p.cumulativeProfit > 0)?.month.toString() || 'Not reached',
        trend: 'neutral',
      },
    ];
  }, [projections]);

  if (!baseMetrics?.filledKpis) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-500">Complete your KPIs to see financial projections</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              📈 Financial Projections
            </CardTitle>
            <CardDescription>
              {timeframe}-month financial forecast based on your metrics
              {(() => {
                const metrics = selectedScenario === 'simulated' && simulatedMetrics ? simulatedMetrics : baseMetrics;
                if (!metrics?.filledKpis) return null;
                
                const currentMonthlyRevenue = metrics.filledKpis.monthlyRevenue || 0;
                const annualRevenue = parseFloat(state?.annual_revenue || '0') || 0;
                let growthRate = 0;
                let source = '';
                
                if (currentMonthlyRevenue > 0 && annualRevenue > 0) {
                  const impliedAnnualFromMonthly = currentMonthlyRevenue * 12;
                  if (Math.abs(annualRevenue - impliedAnnualFromMonthly) > impliedAnnualFromMonthly * 0.1) {
                    const growthNeeded = annualRevenue / impliedAnnualFromMonthly;
                    growthRate = Math.pow(growthNeeded, 1/6) - 1;
                    growthRate = Math.max(-0.10, Math.min(0.15, growthRate));
                    source = 'from your annual target';
                  }
                }
                
                if (growthRate === 0) {
                  const industry = state?.industry || '';
                  const companySize = state?.company_size || '';
                  const industryRates: { [key: string]: number } = {
                    'technology': 0.08, 'saas': 0.10, 'ecommerce': 0.06, 'healthcare': 0.04,
                    'finance': 0.03, 'manufacturing': 0.02, 'services': 0.05, 'retail': 0.04,
                    'education': 0.03, 'real-estate': 0.04,
                  };
                  const sizeMultipliers: { [key: string]: number } = {
                    '1-10': 1.2, '11-50': 1.1, '51-200': 1.0, '201-1000': 0.9, '1000+': 0.8,
                  };
                  const baseRate = industryRates[industry.toLowerCase()] || industryRates['services'];
                  const sizeMultiplier = sizeMultipliers[companySize] || 1.0;
                  growthRate = baseRate * sizeMultiplier;
                  source = 'industry average';
                }
                
                return (
                  <span className="block mt-1">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {growthRate > 0 ? '+' : ''}{(growthRate * 100).toFixed(1)}% monthly growth ({source})
                    </span>
                  </span>
                );
              })()}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <Select value={selectedScenario} onValueChange={(value: 'base' | 'simulated') => setSelectedScenario(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base">Base Case</SelectItem>
                      {simulatedMetrics && <SelectItem value="simulated">Simulated</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Choose between your current baseline scenario or the simulated scenario with adjusted parameters.</p>
              </TooltipContent>
            </Tooltip>
            <Button variant="outline" size="sm">
              📥 Export
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={viewMode} onValueChange={(value: 'summary' | 'detailed' | 'quarterly') => setViewMode(value)}>
          <TabsList className="grid w-full grid-cols-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="summary" className="cursor-help">Summary</TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Overview of key financial metrics and trends</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="detailed" className="cursor-help">Monthly Detail</TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Detailed month-by-month breakdown of all financial metrics</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="quarterly" className="cursor-help">Quarterly</TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Quarterly aggregated view of financial performance</p>
              </TooltipContent>
            </Tooltip>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            {/* Key Insights */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {insights.map((insight, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-1">{insight.title}</h4>
                  <div className="text-lg font-semibold flex items-center gap-2">
                    {insight.value}
                    {insight.trend === 'positive' && <TrendingUp className="w-4 h-4 text-green-500" />}
                  </div>
                </div>
              ))}
            </div>

                         {/* Revenue & Profit Chart */}
             <div className="bg-white border rounded-lg p-6">
               <h4 className="font-semibold mb-4 flex items-center gap-2">
                 📊 Revenue & Profit Trend
               </h4>
               <div className="h-64">
                 {projections.length > 0 ? (
                   <div className="h-full flex items-end justify-between gap-1">
                     {projections.map((projection, index) => {
                       const maxRevenue = Math.max(...projections.map(p => p.revenue));
                       const maxProfit = Math.max(...projections.map(p => Math.max(0, p.profit)));
                       const maxValue = Math.max(maxRevenue, maxProfit);
                       
                       const revenueHeight = (projection.revenue / maxValue) * 100;
                       const profitHeight = Math.max(0, (Math.max(0, projection.profit) / maxValue) * 100);
                       
                       return (
                         <div key={index} className="flex-1 flex flex-col items-center group relative">
                           <div className="w-full flex flex-col items-center justify-end h-48 relative">
                             {/* Revenue Bar */}
                             <div 
                               className="w-full bg-blue-500 rounded-t transition-all duration-300 group-hover:bg-blue-600 relative"
                               style={{ height: `${revenueHeight}%` }}
                               title={`Revenue: ${formatCurrency(projection.revenue)}`}
                             />
                             {/* Profit Bar (overlaid) */}
                             {projection.profit > 0 && (
                               <div 
                                 className="w-full bg-green-500 rounded-t absolute bottom-0 transition-all duration-300 group-hover:bg-green-600"
                                 style={{ height: `${profitHeight}%` }}
                                 title={`Profit: ${formatCurrency(projection.profit)}`}
                               />
                             )}
                             {/* Loss indicator */}
                             {projection.profit < 0 && (
                               <div 
                                 className="w-full bg-red-500 rounded-t absolute bottom-0 transition-all duration-300 group-hover:bg-red-600"
                                 style={{ height: `${Math.abs(projection.profit) / maxValue * 20}%` }}
                                 title={`Loss: ${formatCurrency(Math.abs(projection.profit))}`}
                               />
                             )}
                           </div>
                           <div className="text-xs text-gray-600 mt-2 text-center">
                             {projection.monthName}
                           </div>
                           {/* Tooltip on hover */}
                           <div className="opacity-0 group-hover:opacity-100 absolute z-10 bg-black text-white text-xs rounded px-2 py-1 bottom-full mb-2 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                             <div>Revenue: {formatCurrency(projection.revenue)}</div>
                             <div>Profit: {formatCurrency(projection.profit)}</div>
                             <div>ROI: {projection.roi.toFixed(1)}%</div>
                             <div>Customers: {projection.customers}</div>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 ) : (
                   <div className="h-full flex items-center justify-center text-gray-500">
                     <div className="text-center">
                       <span className="text-4xl opacity-50">📊</span>
                       <p>No data available for chart</p>
                     </div>
                   </div>
                 )}
               </div>
               {/* Legend */}
               <div className="flex justify-center gap-6 mt-4 text-sm">
                 <div className="flex items-center gap-2">
                   <div className="w-4 h-4 bg-blue-500 rounded"></div>
                   <span>Revenue</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-4 h-4 bg-green-500 rounded"></div>
                   <span>Profit</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-4 h-4 bg-red-500 rounded"></div>
                   <span>Loss</span>
                 </div>
               </div>
             </div>

            {/* Current vs Projected Comparison */}
            {selectedScenario === 'simulated' && simulatedMetrics && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-3">Simulation vs Base Comparison</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-green-700">Revenue Increase</span>
                    <div className="font-semibold text-green-900">
                      {formatCurrency((simulatedMetrics.filledKpis?.monthlyRevenue || 0) - (baseMetrics.filledKpis?.monthlyRevenue || 0))}
                    </div>
                    <p className="text-xs text-green-600">Monthly impact</p>
                  </div>
                  <div>
                    <span className="text-green-700">ROI Improvement</span>
                    <div className="font-semibold text-green-900">
                      +{((simulatedMetrics.currentROI || 0) - (baseMetrics.currentROI || 0)).toFixed(1)}%
                    </div>
                    <p className="text-xs text-green-600">Percentage points</p>
                  </div>
                  <div>
                    <span className="text-green-700">Annual Impact</span>
                    <div className="font-semibold text-green-900">
                      {formatCurrency(((simulatedMetrics.filledKpis?.monthlyRevenue || 0) - (baseMetrics.filledKpis?.monthlyRevenue || 0)) * 12)}
                    </div>
                    <p className="text-xs text-green-600">Additional revenue</p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="detailed" className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Month</th>
                    <th className="text-right p-2">Revenue</th>
                    <th className="text-right p-2">Costs</th>
                    <th className="text-right p-2">Profit</th>
                    <th className="text-right p-2">Customers</th>
                    <th className="text-right p-2">ROI %</th>
                    <th className="text-right p-2">Cumulative</th>
                  </tr>
                </thead>
                <tbody>
                  {projections.map((month) => (
                    <tr key={month.month} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{month.monthName}</td>
                      <td className="p-2 text-right">{formatCurrency(month.revenue)}</td>
                      <td className="p-2 text-right">{formatCurrency(month.costs)}</td>
                      <td className={`p-2 text-right font-medium ${month.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(month.profit)}
                      </td>
                      <td className="p-2 text-right">{month.customers.toLocaleString()}</td>
                      <td className={`p-2 text-right ${month.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {month.roi.toFixed(1)}%
                      </td>
                      <td className="p-2 text-right font-medium">
                        {formatCurrency(month.cumulativeProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="quarterly" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quarterlyData.map((quarter) => (
                <div key={quarter.quarter} className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold mb-3">Q{quarter.quarter} Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Revenue:</span>
                      <span className="font-medium">{formatCurrency(quarter.revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Costs:</span>
                      <span className="font-medium">{formatCurrency(quarter.costs)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span>Profit:</span>
                      <span className={`font-semibold ${quarter.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(quarter.profit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Customers:</span>
                      <span className="font-medium">{quarter.customers.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ROI:</span>
                      <span className={`font-medium ${quarter.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {quarter.roi.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
