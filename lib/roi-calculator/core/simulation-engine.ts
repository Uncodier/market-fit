/**
 * Simulation Engine for ROI Calculator
 * Handles scenario modeling and what-if analysis
 */

import type { ROIInputs, ROIOutputs, ROICalculatorEngine } from './calculator-engine';

export interface SimulationScenario {
  name: string;
  description: string;
  multipliers: {
    revenueMultiplier?: number;
    costMultiplier?: number;
    conversionRateMultiplier?: number;
    churnRateMultiplier?: number;
    marketingBudgetMultiplier?: number;
    cogsMultiplier?: number;
    leadGenerationMultiplier?: number;
    ltvMultiplier?: number;
  };
}

export interface SimulationResult {
  scenario: SimulationScenario;
  results: ROIOutputs;
  comparison: {
    revenueChange: number;
    costChange: number;
    roiChange: number;
    profitChange: number;
  };
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface MonthlyProjection {
  month: number;
  monthName: string;
  leads: number;
  conversionRate: number;
  convertedCustomers: number;
  averageOrderValue: number;
  monthlyRevenue: number;
  cumulativeRevenue: number;
  marketingBudget: number;
  salesTeamCost: number;
  technologyCosts: number;
  operationalCosts: number;
  totalCosts: number;
  cumulativeCosts: number;
  monthlyProfit: number;
  cumulativeProfit: number;
  roi: number;
  cac: number;
  ltv: number;
  ltvCacRatio: number;
}

export class SimulationEngine {
  private predefinedScenarios: SimulationScenario[];

  constructor() {
    this.initializePredefinedScenarios();
  }

  /**
   * Run a specific scenario simulation
   */
  runScenario(
    inputs: ROIInputs, 
    multipliers: Record<string, number>, 
    calculatorEngine: ROICalculatorEngine
  ): ROIOutputs {
    // Apply multipliers to create modified inputs
    const modifiedInputs = this.applyMultipliers(inputs, multipliers);
    
    // Calculate results with modified inputs
    return calculatorEngine.calculate(modifiedInputs);
  }

  /**
   * Run multiple scenario comparison
   */
  runMultipleScenarios(
    inputs: ROIInputs,
    scenarios: SimulationScenario[],
    calculatorEngine: ROICalculatorEngine
  ): SimulationResult[] {
    const baselineResults = calculatorEngine.calculate(inputs);
    const results: SimulationResult[] = [];

    for (const scenario of scenarios) {
      const scenarioResults = this.runScenario(inputs, scenario.multipliers, calculatorEngine);
      
      const comparison = this.compareResults(baselineResults, scenarioResults);
      const confidence = this.calculateScenarioConfidence(scenario, inputs);
      const riskLevel = this.assessRiskLevel(scenario, comparison);

      results.push({
        scenario,
        results: scenarioResults,
        comparison,
        confidence,
        riskLevel
      });
    }

    return results.sort((a, b) => b.comparison.roiChange - a.comparison.roiChange);
  }

  /**
   * Generate 12-month projections
   */
  generateProjections(
    inputs: ROIInputs,
    multipliers: Record<string, number> = {},
    scenario: 'current' | 'optimized' | 'simulated' = 'current'
  ): MonthlyProjection[] {
    const projections: MonthlyProjection[] = [];
    const currentDate = new Date();
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    // Apply multipliers to base metrics
    const baseMetrics = this.applyMultipliers(inputs, multipliers);
    
    // Growth factors based on scenario
    const growthFactors = this.getGrowthFactors(scenario);
    
    let cumulativeRevenue = 0;
    let cumulativeCosts = 0;
    let cumulativeProfit = 0;

    for (let month = 1; month <= 12; month++) {
      const actualMonthIndex = (currentDate.getMonth() + month - 1) % 12;
      const actualYear = currentDate.getFullYear() + Math.floor((currentDate.getMonth() + month - 1) / 12);
      const monthName = `${monthNames[actualMonthIndex]} ${actualYear.toString().slice(-2)}`;

      // Apply growth factors
      const growthMultiplier = Math.pow(growthFactors.revenue, month - 1);
      const efficiencyMultiplier = Math.pow(growthFactors.efficiency, month - 1);

      // Calculate monthly metrics
      const leads = Math.round(baseMetrics.kpis.monthlyLeads * growthMultiplier);
      const conversionRate = baseMetrics.kpis.conversionRate * efficiencyMultiplier;
      const convertedCustomers = Math.round(leads * (conversionRate / 100));
      const averageOrderValue = baseMetrics.kpis.averageOrderValue * growthMultiplier;
      const monthlyRevenue = convertedCustomers * averageOrderValue;

      // Calculate costs with efficiency improvements
      const marketingBudget = baseMetrics.costs.marketingBudget * growthMultiplier / efficiencyMultiplier;
      const salesTeamCost = baseMetrics.costs.salesTeamCost * growthMultiplier;
      const technologyCosts = baseMetrics.costs.technologyCosts * Math.pow(1.02, month - 1); // 2% monthly increase
      const operationalCosts = baseMetrics.costs.operationalCosts * growthMultiplier / Math.sqrt(efficiencyMultiplier);
      
      const totalCosts = marketingBudget + salesTeamCost + technologyCosts + operationalCosts + 
                        baseMetrics.costs.cogs + baseMetrics.costs.salesCommission + baseMetrics.costs.otherCosts;

      // Calculate cumulative values
      cumulativeRevenue += monthlyRevenue;
      cumulativeCosts += totalCosts;
      const monthlyProfit = monthlyRevenue - totalCosts;
      cumulativeProfit += monthlyProfit;

      // Calculate performance metrics
      const roi = totalCosts > 0 ? (monthlyProfit / totalCosts) * 100 : 0;
      const cac = convertedCustomers > 0 ? marketingBudget / convertedCustomers : 0;
      const ltv = baseMetrics.kpis.customerLifetimeValue * efficiencyMultiplier;
      const ltvCacRatio = cac > 0 ? ltv / cac : 0;

      projections.push({
        month,
        monthName,
        leads,
        conversionRate: Math.round(conversionRate * 100) / 100,
        convertedCustomers,
        averageOrderValue: Math.round(averageOrderValue),
        monthlyRevenue: Math.round(monthlyRevenue),
        cumulativeRevenue: Math.round(cumulativeRevenue),
        marketingBudget: Math.round(marketingBudget),
        salesTeamCost: Math.round(salesTeamCost),
        technologyCosts: Math.round(technologyCosts),
        operationalCosts: Math.round(operationalCosts),
        totalCosts: Math.round(totalCosts),
        cumulativeCosts: Math.round(cumulativeCosts),
        monthlyProfit: Math.round(monthlyProfit),
        cumulativeProfit: Math.round(cumulativeProfit),
        roi: Math.round(roi * 100) / 100,
        cac: Math.round(cac),
        ltv: Math.round(ltv),
        ltvCacRatio: Math.round(ltvCacRatio * 100) / 100
      });
    }

    return projections;
  }

  /**
   * Generate sensitivity analysis
   */
  generateSensitivityAnalysis(
    inputs: ROIInputs,
    calculatorEngine: ROICalculatorEngine
  ): Record<string, { low: number; base: number; high: number }> {
    const baseResults = calculatorEngine.calculate(inputs);
    const baseROI = baseResults.currentState.roi;
    
    const sensitivityFactors = [
      'revenueMultiplier',
      'costMultiplier',
      'conversionRateMultiplier',
      'marketingBudgetMultiplier'
    ];

    const analysis: Record<string, { low: number; base: number; high: number }> = {};

    for (const factor of sensitivityFactors) {
      // Test -20%, base, +20% scenarios
      const lowScenario = { [factor]: 0.8 };
      const highScenario = { [factor]: 1.2 };

      const lowResults = this.runScenario(inputs, lowScenario, calculatorEngine);
      const highResults = this.runScenario(inputs, highScenario, calculatorEngine);

      analysis[factor] = {
        low: lowResults.currentState.roi,
        base: baseROI,
        high: highResults.currentState.roi
      };
    }

    return analysis;
  }

  /**
   * Apply multipliers to inputs
   */
  private applyMultipliers(inputs: ROIInputs, multipliers: Record<string, number>): ROIInputs {
    const modified = JSON.parse(JSON.stringify(inputs)); // Deep clone

    // Apply lead generation multipliers first (affects funnel top)
    if (multipliers.leadGenerationMultiplier) {
      modified.kpis.monthlyLeads *= multipliers.leadGenerationMultiplier;
    }

    // Apply conversion rate multipliers
    if (multipliers.conversionRateMultiplier) {
      modified.kpis.conversionRate *= multipliers.conversionRateMultiplier;
    }

    // Recalculate converted customers based on leads and conversion rate
    modified.kpis.convertedCustomers = Math.round(
      modified.kpis.monthlyLeads * (modified.kpis.conversionRate / 100)
    );

    // Apply LTV multipliers
    if (multipliers.ltvMultiplier) {
      modified.kpis.customerLifetimeValue *= multipliers.ltvMultiplier;
    }

    // Apply churn rate multipliers (inverse relationship with LTV)
    if (multipliers.churnRateMultiplier) {
      modified.kpis.churnRate *= multipliers.churnRateMultiplier;
      // Recalculate customer lifetime span based on churn
      if (modified.kpis.churnRate > 0) {
        modified.kpis.customerLifetimeSpan = Math.round(100 / modified.kpis.churnRate);
      }
    }

    // Calculate revenue based on funnel: leads -> conversion -> customers -> revenue
    const revenueFromFunnel = modified.kpis.convertedCustomers * modified.kpis.averageOrderValue;
    
    // Apply direct revenue multiplier if specified, otherwise use funnel calculation
    if (multipliers.revenueMultiplier) {
      modified.kpis.monthlyRevenue = (modified.kpis.monthlyRevenue || revenueFromFunnel) * multipliers.revenueMultiplier;
      // Also adjust AOV proportionally
      modified.kpis.averageOrderValue *= multipliers.revenueMultiplier;
    } else {
      // Use funnel-based revenue calculation
      modified.kpis.monthlyRevenue = revenueFromFunnel;
    }

    // Apply cost multipliers
    if (multipliers.costMultiplier) {
      // Apply to operational costs but not marketing budget (handled separately)
      modified.costs.salesTeamCost *= multipliers.costMultiplier;
      modified.costs.technologyCosts *= multipliers.costMultiplier;
      modified.costs.operationalCosts *= multipliers.costMultiplier;
      modified.costs.salesCommission *= multipliers.costMultiplier;
      modified.costs.otherCosts *= multipliers.costMultiplier;
    }

    // Apply specific cost multipliers
    if (multipliers.marketingBudgetMultiplier) {
      modified.costs.marketingBudget *= multipliers.marketingBudgetMultiplier;
    }

    if (multipliers.cogsMultiplier) {
      modified.costs.cogs *= multipliers.cogsMultiplier;
    }

    // Recalculate customer acquisition cost based on new marketing budget and customers
    if (modified.kpis.convertedCustomers > 0) {
      modified.kpis.customerAcquisitionCost = modified.costs.marketingBudget / modified.kpis.convertedCustomers;
    }

    return modified;
  }

  /**
   * Compare two sets of results
   */
  private compareResults(baseline: ROIOutputs, scenario: ROIOutputs) {
    return {
      revenueChange: ((scenario.currentState.monthlyRevenue - baseline.currentState.monthlyRevenue) / baseline.currentState.monthlyRevenue) * 100,
      costChange: ((scenario.currentState.totalCosts - baseline.currentState.totalCosts) / baseline.currentState.totalCosts) * 100,
      roiChange: scenario.currentState.roi - baseline.currentState.roi,
      profitChange: ((scenario.currentState.monthlyProfit - baseline.currentState.monthlyProfit) / Math.abs(baseline.currentState.monthlyProfit || 1)) * 100
    };
  }

  /**
   * Calculate confidence for a scenario
   */
  private calculateScenarioConfidence(scenario: SimulationScenario, inputs: ROIInputs): number {
    let confidence = 70; // Base confidence

    // Reduce confidence for extreme multipliers
    Object.values(scenario.multipliers).forEach(multiplier => {
      if (multiplier && (multiplier < 0.5 || multiplier > 2.0)) {
        confidence -= 15;
      }
    });

    // Increase confidence based on data quality
    const dataCompleteness = this.calculateDataCompleteness(inputs);
    confidence += dataCompleteness * 20;

    return Math.min(95, Math.max(30, confidence));
  }

  /**
   * Assess risk level for a scenario
   */
  private assessRiskLevel(scenario: SimulationScenario, comparison: any): 'low' | 'medium' | 'high' {
    const totalChange = Math.abs(comparison.revenueChange) + Math.abs(comparison.costChange);
    
    if (totalChange > 50) return 'high';
    if (totalChange > 25) return 'medium';
    return 'low';
  }

  /**
   * Get growth factors for different scenarios
   */
  private getGrowthFactors(scenario: 'current' | 'optimized' | 'simulated') {
    const factors = {
      current: { revenue: 1.02, efficiency: 1.0 }, // 2% monthly growth
      optimized: { revenue: 1.05, efficiency: 1.03 }, // 5% revenue growth, 3% efficiency improvement
      simulated: { revenue: 1.02, efficiency: 1.0 } // Base growth, multipliers applied directly
    };

    return factors[scenario];
  }

  /**
   * Calculate data completeness
   */
  private calculateDataCompleteness(inputs: ROIInputs): number {
    let completeness = 0;
    let totalFields = 0;

    // Check KPIs completeness
    Object.values(inputs.kpis).forEach(value => {
      totalFields++;
      if (value && value > 0) completeness++;
    });

    // Check costs completeness
    Object.values(inputs.costs).forEach(value => {
      totalFields++;
      if (value && value > 0) completeness++;
    });

    return totalFields > 0 ? completeness / totalFields : 0;
  }

  /**
   * Initialize predefined scenarios
   */
  private initializePredefinedScenarios(): void {
    this.predefinedScenarios = [
      {
        name: 'Conservative Growth',
        description: 'Modest improvements with low risk',
        multipliers: {
          revenueMultiplier: 1.1,
          costMultiplier: 0.95,
          conversionRateMultiplier: 1.05
        }
      },
      {
        name: 'Aggressive Growth',
        description: 'High growth with increased investment',
        multipliers: {
          revenueMultiplier: 1.5,
          costMultiplier: 1.3,
          conversionRateMultiplier: 1.2,
          marketingBudgetMultiplier: 1.8
        }
      },
      {
        name: 'Efficiency Focus',
        description: 'Cost reduction and process optimization',
        multipliers: {
          costMultiplier: 0.8,
          conversionRateMultiplier: 1.15,
          churnRateMultiplier: 0.7
        }
      },
      {
        name: 'Market Expansion',
        description: 'Increased lead generation and market reach',
        multipliers: {
          leadGenerationMultiplier: 2.0,
          marketingBudgetMultiplier: 1.6,
          conversionRateMultiplier: 0.9
        }
      },
      {
        name: 'Premium Strategy',
        description: 'Higher prices, better margins',
        multipliers: {
          revenueMultiplier: 1.3,
          leadGenerationMultiplier: 0.8,
          ltvMultiplier: 1.4,
          cogsMultiplier: 0.9
        }
      }
    ];
  }

  /**
   * Get predefined scenarios
   */
  getPredefinedScenarios(): SimulationScenario[] {
    return [...this.predefinedScenarios];
  }

  /**
   * Create custom scenario
   */
  createCustomScenario(
    name: string,
    description: string,
    multipliers: Record<string, number>
  ): SimulationScenario {
    return {
      name,
      description,
      multipliers
    };
  }
}
