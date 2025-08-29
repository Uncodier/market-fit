"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Target, BarChart, PieChart } from "@/app/components/ui/icons";
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut";
import { ROIMetrics } from "@/app/roi-calculator/utils";

interface FinancialModelProps {
  currentMetrics: ROIMetrics;
  simulatedMetrics: ROIMetrics;
  simulationValues: {
    revenueMultiplier: number;
    costMultiplier: number;
    conversionRateMultiplier: number;
    churnRateMultiplier: number;
    marketingBudgetMultiplier: number;
    cogsMultiplier: number;
    leadGenerationMultiplier: number;
    ltvMultiplier: number;
  };
}

interface MonthlyProjection {
  month: number;
  monthName: string;
  // Revenue metrics
  leads: number;
  conversionRate: number;
  convertedCustomers: number;
  averageOrderValue: number;
  monthlyRevenue: number;
  cumulativeRevenue: number;
  // Cost metrics
  marketingBudget: number;
  salesTeamCost: number;
  technologyCosts: number;
  operationalCosts: number;
  totalCosts: number;
  cumulativeCosts: number;
  // Performance metrics
  monthlyProfit: number;
  cumulativeProfit: number;
  roi: number;
  cac: number;
  ltv: number;
  ltvCacRatio: number;
}

export function FinancialModel({ currentMetrics, simulatedMetrics, simulationValues }: FinancialModelProps) {
  // Debug logging
  console.log('🔍 FinancialModel Debug:', {
    currentMetrics,
    simulatedMetrics,
    simulationValues,
    currentRevenue: currentMetrics.filledKpis.monthlyRevenue,
    simulatedRevenue: simulatedMetrics.filledKpis.monthlyRevenue,
    projectedRevenue: simulatedMetrics.projectedRevenue,
    currentCosts: currentMetrics.totalCurrentCosts,
    simulatedCosts: simulatedMetrics.totalCurrentCosts
  });

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  // Get current date to start projections from today
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth(); // 0-based (0 = January)
  const currentYear = currentDate.getFullYear();

  // Generate 12-month projections
  const generateProjections = (metrics: ROIMetrics, scenario: string): MonthlyProjection[] => {
    const projections: MonthlyProjection[] = [];
    let cumulativeRevenue = 0;
    let cumulativeCosts = 0;
    let cumulativeProfit = 0;
    
    // Initialize recurring revenue tracking
    let recurringMonthlyRevenue = 0;

    // Growth factors based on scenario
    const growthFactors = {
      current: { revenue: 1.02, efficiency: 1.0 }, // 2% monthly growth
      optimized: { revenue: 1.05, efficiency: 1.03 }, // 5% revenue growth, 3% efficiency improvement
      simulated: { 
        revenue: 1.02, // Base growth, multipliers applied directly to costs/revenue
        efficiency: 1.0 // Base efficiency, multipliers applied directly
      }
    };

    const factor = growthFactors[scenario as keyof typeof growthFactors] || growthFactors.current;

    for (let month = 1; month <= 12; month++) {
      // Calculate the actual month index starting from current month
      const actualMonthIndex = (currentMonth + month - 1) % 12;
      const actualYear = currentYear + Math.floor((currentMonth + month - 1) / 12);
      const monthName = monthNames[actualMonthIndex];
      const monthLabel = `${monthName} ${actualYear.toString().slice(-2)}`;

      // Apply growth over time
      const revenueGrowth = Math.pow(factor.revenue, month - 1);
      const efficiencyGrowth = Math.pow(factor.efficiency, month - 1);

      // Calculate monthly metrics
      let leads, conversionRate, convertedCustomers, averageOrderValue, newCustomerRevenue, monthlyRevenue;
      
      if (scenario === 'simulated') {
        // Apply simulation multipliers directly for simulated scenario
        leads = Math.round(metrics.filledKpis.monthlyLeads * simulationValues.leadGenerationMultiplier * revenueGrowth);
        conversionRate = metrics.filledKpis.conversionRate * simulationValues.conversionRateMultiplier;
        convertedCustomers = Math.round(leads * conversionRate / 100);
        averageOrderValue = metrics.filledKpis.averageOrderValue * revenueGrowth;
        newCustomerRevenue = convertedCustomers * averageOrderValue;
      } else {
        // Standard calculation for current/optimized scenarios
        leads = Math.round(metrics.filledKpis.monthlyLeads * revenueGrowth);
        conversionRate = scenario === 'optimized' 
          ? metrics.filledKpis.conversionRate * 1.25 
          : metrics.filledKpis.conversionRate;
        convertedCustomers = Math.round(leads * conversionRate / 100);
        averageOrderValue = metrics.filledKpis.averageOrderValue * revenueGrowth;
        newCustomerRevenue = convertedCustomers * averageOrderValue;
      }

      // Calculate total monthly revenue (recurring + new customers)
      // Use actual churn rate from KPIs to calculate retention
      const churnRate = metrics.filledKpis.churnRate || 5; // Default 5% if not provided
      const retentionRate = (100 - churnRate) / 100;
      
      if (month === 1) {
        // First month: start with base monthly revenue + new customers
        recurringMonthlyRevenue = metrics.filledKpis.monthlyRevenue + newCustomerRevenue;
        monthlyRevenue = recurringMonthlyRevenue;
      } else {
        // Subsequent months: apply retention to previous month + add new customers
        recurringMonthlyRevenue = recurringMonthlyRevenue * retentionRate;
        recurringMonthlyRevenue += newCustomerRevenue;
        monthlyRevenue = recurringMonthlyRevenue;
      }

      // Calculate costs with efficiency improvements
      let marketingBudget, salesTeamCost, technologyCosts, operationalCosts, cogs;
      
      if (scenario === 'simulated') {
        // Apply simulation multipliers directly for simulated scenario
        marketingBudget = metrics.filledCosts.marketingBudget * simulationValues.marketingBudgetMultiplier;
        salesTeamCost = metrics.filledCosts.salesTeamCost * simulationValues.costMultiplier;
        technologyCosts = metrics.filledCosts.technologyCosts * simulationValues.costMultiplier;
        operationalCosts = metrics.filledCosts.operationalCosts * simulationValues.costMultiplier;
        cogs = metrics.filledCosts.cogs * simulationValues.cogsMultiplier;
      } else {
        // Apply growth and efficiency for current/optimized scenarios
        marketingBudget = metrics.filledCosts.marketingBudget * revenueGrowth / efficiencyGrowth;
        salesTeamCost = metrics.filledCosts.salesTeamCost / efficiencyGrowth;
        technologyCosts = metrics.filledCosts.technologyCosts / efficiencyGrowth;
        operationalCosts = metrics.filledCosts.operationalCosts / efficiencyGrowth;
        cogs = metrics.filledCosts.cogs / efficiencyGrowth;
      }
      
      const totalCosts = marketingBudget + salesTeamCost + technologyCosts + operationalCosts + cogs;

      // Update cumulatives
      cumulativeRevenue += monthlyRevenue;
      cumulativeCosts += totalCosts;
      const monthlyProfit = monthlyRevenue - totalCosts;
      cumulativeProfit += monthlyProfit;

      // Calculate performance metrics
      const roi = totalCosts > 0 ? (monthlyProfit / totalCosts) * 100 : 0;
      const cac = convertedCustomers > 0 ? marketingBudget / convertedCustomers : 0;
      const ltv = scenario === 'simulated' 
        ? metrics.filledKpis.customerLifetimeValue * simulationValues.ltvMultiplier
        : metrics.filledKpis.customerLifetimeValue;
      const ltvCacRatio = cac > 0 ? ltv / cac : 0;

      projections.push({
        month,
        monthName: monthLabel,
        leads,
        conversionRate,
        convertedCustomers,
        averageOrderValue,
        monthlyRevenue,
        cumulativeRevenue,
        marketingBudget,
        salesTeamCost,
        technologyCosts,
        operationalCosts,
        totalCosts,
        cumulativeCosts,
        monthlyProfit,
        cumulativeProfit,
        roi,
        cac,
        ltv,
        ltvCacRatio
      });
    }

    return projections;
  };

  const currentProjections = generateProjections(currentMetrics, 'current');
  const simulatedProjections = generateProjections(simulatedMetrics, 'simulated');

  // Calculate key financial ratios
  const calculateRatios = (projections: MonthlyProjection[]) => {
    const lastMonth = projections[projections.length - 1];
    const totalRevenue = lastMonth.cumulativeRevenue;
    const totalCosts = lastMonth.cumulativeCosts;
    const totalProfit = lastMonth.cumulativeProfit;
    
    return {
      annualROI: totalCosts > 0 ? (totalProfit / totalCosts) * 100 : 0,
      profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      averageCAC: projections.reduce((sum, p) => sum + p.cac, 0) / 12,
      averageLTVCAC: projections.reduce((sum, p) => sum + p.ltvCacRatio, 0) / 12,
      paybackPeriod: projections.findIndex(p => p.cumulativeProfit > 0) + 1 || 12,
      breakEvenMonth: projections.findIndex(p => p.monthlyProfit > 0) + 1 || 12
    };
  };

  const currentRatios = calculateRatios(currentProjections);
  const simulatedRatios = calculateRatios(simulatedProjections);

  return (
    <div className="space-y-6">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-800">Current Scenario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Annual Revenue:</span>
              <span className="font-medium">{formatCurrency(currentProjections[11].cumulativeRevenue)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Annual Profit:</span>
              <span className="font-medium">{formatCurrency(currentProjections[11].cumulativeProfit)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>ROI:</span>
              <span className="font-medium">{currentRatios.annualROI.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Payback Period:</span>
              <span className="font-medium">{currentRatios.paybackPeriod} months</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-purple-800">Simulated Scenario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Annual Revenue:</span>
              <span className="font-medium">{formatCurrency(simulatedProjections[11].cumulativeRevenue)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Annual Profit:</span>
              <span className="font-medium">{formatCurrency(simulatedProjections[11].cumulativeProfit)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>ROI:</span>
              <span className="font-medium text-purple-600">{simulatedRatios.annualROI.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Payback Period:</span>
              <span className="font-medium">{simulatedRatios.paybackPeriod} months</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Excel-like Financial Model Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Complete Financial Model - 12 Month Projection
          </CardTitle>
          <CardDescription>
            Detailed month-by-month breakdown starting from {monthNames[currentMonth]} {currentYear}, comparing current and simulated scenarios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left p-2 font-semibold bg-gray-50">Month</th>
                  <th className="text-right p-2 font-semibold bg-blue-50">Current Revenue</th>
                  <th className="text-right p-2 font-semibold bg-blue-50">Current Costs</th>
                  <th className="text-right p-2 font-semibold bg-blue-50">Current Profit</th>
                  <th className="text-right p-2 font-semibold bg-blue-50">Current ROI</th>
                  <th className="text-right p-2 font-semibold bg-purple-50">Simulated Revenue</th>
                  <th className="text-right p-2 font-semibold bg-purple-50">Simulated Costs</th>
                  <th className="text-right p-2 font-semibold bg-purple-50">Simulated Profit</th>
                  <th className="text-right p-2 font-semibold bg-purple-50">Simulated ROI</th>
                </tr>
              </thead>
              <tbody>
                {currentProjections.map((current, index) => {
                  const simulated = simulatedProjections[index];
                  
                  return (
                    <tr key={current.month} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-2 font-medium">{current.monthName}</td>
                      {/* Current Scenario */}
                      <td className="p-2 text-right">{formatCurrency(current.monthlyRevenue)}</td>
                      <td className="p-2 text-right">{formatCurrency(current.totalCosts)}</td>
                      <td className={`p-2 text-right ${current.monthlyProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(current.monthlyProfit)}
                      </td>
                      <td className="p-2 text-right">{current.roi.toFixed(1)}%</td>
                      {/* Simulated Scenario */}
                      <td className="p-2 text-right font-medium text-purple-700">{formatCurrency(simulated.monthlyRevenue)}</td>
                      <td className="p-2 text-right">{formatCurrency(simulated.totalCosts)}</td>
                      <td className={`p-2 text-right font-medium ${simulated.monthlyProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(simulated.monthlyProfit)}
                      </td>
                      <td className="p-2 text-right font-medium text-purple-600">{simulated.roi.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                {/* Totals Row */}
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td className="p-2">TOTAL</td>
                  <td className="p-2 text-right">{formatCurrency(currentProjections[11].cumulativeRevenue)}</td>
                  <td className="p-2 text-right">{formatCurrency(currentProjections[11].cumulativeCosts)}</td>
                  <td className={`p-2 text-right ${currentProjections[11].cumulativeProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(currentProjections[11].cumulativeProfit)}
                  </td>
                  <td className="p-2 text-right">{currentRatios.annualROI.toFixed(1)}%</td>
                  <td className="p-2 text-right text-purple-700">{formatCurrency(simulatedProjections[11].cumulativeRevenue)}</td>
                  <td className="p-2 text-right">{formatCurrency(simulatedProjections[11].cumulativeCosts)}</td>
                  <td className={`p-2 text-right ${simulatedProjections[11].cumulativeProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(simulatedProjections[11].cumulativeProfit)}
                  </td>
                  <td className="p-2 text-right text-purple-600">{simulatedRatios.annualROI.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed KPIs Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Key Performance Indicators - Monthly Detail
          </CardTitle>
          <CardDescription>
            Operational metrics starting from {monthNames[currentMonth]} {currentYear} with simulated scenario values
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left p-2 font-semibold bg-gray-50">Month</th>
                  <th className="text-right p-2 font-semibold bg-gray-50">Leads</th>
                  <th className="text-right p-2 font-semibold bg-gray-50">Conv. Rate</th>
                  <th className="text-right p-2 font-semibold bg-gray-50">Customers</th>
                  <th className="text-right p-2 font-semibold bg-gray-50">AOV</th>
                  <th className="text-right p-2 font-semibold bg-gray-50">CAC</th>
                  <th className="text-right p-2 font-semibold bg-gray-50">LTV</th>
                  <th className="text-right p-2 font-semibold bg-gray-50">LTV:CAC</th>
                  <th className="text-right p-2 font-semibold bg-gray-50">Marketing</th>
                  <th className="text-right p-2 font-semibold bg-gray-50">Sales</th>
                  <th className="text-right p-2 font-semibold bg-gray-50">Tech</th>
                  <th className="text-right p-2 font-semibold bg-gray-50">Operations</th>
                </tr>
              </thead>
              <tbody>
                {simulatedProjections.map((projection) => (
                  <tr key={projection.month} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-2 font-medium">{projection.monthName}</td>
                    <td className="p-2 text-right">{projection.leads.toLocaleString()}</td>
                    <td className="p-2 text-right">{projection.conversionRate.toFixed(1)}%</td>
                    <td className="p-2 text-right">{projection.convertedCustomers.toLocaleString()}</td>
                    <td className="p-2 text-right">{formatCurrency(projection.averageOrderValue)}</td>
                    <td className="p-2 text-right">{formatCurrency(projection.cac)}</td>
                    <td className="p-2 text-right">{formatCurrency(projection.ltv)}</td>
                    <td className={`p-2 text-right ${projection.ltvCacRatio >= 3 ? 'text-green-600' : projection.ltvCacRatio >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {projection.ltvCacRatio.toFixed(1)}x
                    </td>
                    <td className="p-2 text-right">{formatCurrency(projection.marketingBudget)}</td>
                    <td className="p-2 text-right">{formatCurrency(projection.salesTeamCost)}</td>
                    <td className="p-2 text-right">{formatCurrency(projection.technologyCosts)}</td>
                    <td className="p-2 text-right">{formatCurrency(projection.operationalCosts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Financial Ratios Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Financial Ratios & Key Metrics Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-blue-800">Current Scenario</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Annual ROI:</span>
                  <Badge variant="outline">{currentRatios.annualROI.toFixed(1)}%</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Profit Margin:</span>
                  <Badge variant="outline">{currentRatios.profitMargin.toFixed(1)}%</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Avg CAC:</span>
                  <Badge variant="outline">{formatCurrency(currentRatios.averageCAC)}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Avg LTV:CAC:</span>
                  <Badge variant="outline">{currentRatios.averageLTVCAC.toFixed(1)}x</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Payback Period:</span>
                  <Badge variant="outline">{currentRatios.paybackPeriod} months</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Break-even:</span>
                  <Badge variant="outline">Month {currentRatios.breakEvenMonth}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-purple-800">Simulated Scenario</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Annual ROI:</span>
                  <Badge className="bg-purple-100 text-purple-800">{simulatedRatios.annualROI.toFixed(1)}%</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Profit Margin:</span>
                  <Badge className="bg-purple-100 text-purple-800">{simulatedRatios.profitMargin.toFixed(1)}%</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Avg CAC:</span>
                  <Badge className="bg-purple-100 text-purple-800">{formatCurrency(simulatedRatios.averageCAC)}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Avg LTV:CAC:</span>
                  <Badge className="bg-purple-100 text-purple-800">{simulatedRatios.averageLTVCAC.toFixed(1)}x</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Payback Period:</span>
                  <Badge className="bg-purple-100 text-purple-800">{simulatedRatios.paybackPeriod} months</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Break-even:</span>
                  <Badge className="bg-purple-100 text-purple-800">Month {simulatedRatios.breakEvenMonth}</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Impact Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Scenario Impact Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md mx-auto">
            <div>
              <h4 className="font-semibold mb-3 text-purple-800 text-center">Simulated vs Current Impact</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Additional Annual Revenue:</span>
                  <span className="font-medium text-purple-600">
                    {formatCurrency(simulatedProjections[11].cumulativeRevenue - currentProjections[11].cumulativeRevenue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Additional Annual Profit:</span>
                  <span className="font-medium text-purple-600">
                    {formatCurrency(simulatedProjections[11].cumulativeProfit - currentProjections[11].cumulativeProfit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>ROI Improvement:</span>
                  <span className="font-medium text-purple-600">
                    {simulatedRatios.annualROI > currentRatios.annualROI ? '+' : ''}
                    {(simulatedRatios.annualROI - currentRatios.annualROI).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Payback Change:</span>
                  <span className="font-medium text-purple-600">
                    {currentRatios.paybackPeriod - simulatedRatios.paybackPeriod > 0 ? 
                      `${currentRatios.paybackPeriod - simulatedRatios.paybackPeriod} months faster` :
                      `${simulatedRatios.paybackPeriod - currentRatios.paybackPeriod} months slower`
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
