/**
 * Integration Service
 * Connects the new ROI calculator with existing systems
 */

import { roiCalculatorEngine, type ROIInputs, type ROIOutputs } from '../core/calculator-engine';

export class IntegrationService {
  /**
   * Convert new ROI results to dashboard widget format
   */
  static toDashboardWidget(results: ROIOutputs): {
    actual: number;
    unit: string;
    percentChange: number;
    periodType: string;
  } {
    return {
      actual: Math.round(results.currentState.roi * 100) / 100,
      unit: '%',
      percentChange: Math.round(results.projections.potentialIncrease * 100) / 100,
      periodType: 'projected'
    };
  }

  /**
   * Convert new ROI inputs to legacy lead analysis format
   */
  static toLegacyLeadAnalysis(inputs: ROIInputs): any {
    return {
      company_name: inputs.companyInfo.name,
      industry: inputs.companyInfo.industry,
      company_size: inputs.companyInfo.size,
      annual_revenue: inputs.companyInfo.annualRevenue?.toString(),
      current_kpis: {
        monthlyRevenue: inputs.kpis.monthlyRevenue,
        customerAcquisitionCost: inputs.kpis.customerAcquisitionCost,
        customerLifetimeValue: inputs.kpis.customerLifetimeValue,
        conversionRate: inputs.kpis.conversionRate,
        averageOrderValue: inputs.kpis.averageOrderValue,
        monthlyLeads: inputs.kpis.monthlyLeads,
        salesCycleLength: inputs.kpis.salesCycleLength,
        convertedCustomers: inputs.kpis.convertedCustomers,
        customerLifetimeSpan: inputs.kpis.customerLifetimeSpan,
        churnRate: inputs.kpis.churnRate
      },
      current_costs: {
        marketingBudget: inputs.costs.marketingBudget,
        salesTeamCost: inputs.costs.salesTeamCost,
        salesCommission: inputs.costs.salesCommission,
        technologyCosts: inputs.costs.technologyCosts,
        operationalCosts: inputs.costs.operationalCosts,
        cogs: inputs.costs.cogs,
        otherCosts: inputs.costs.otherCosts
      },
      sales_process: {
        leadSources: [],
        qualificationProcess: inputs.salesProcess.qualificationMethods,
        followUpFrequency: '',
        closingTechniques: [],
        painPoints: [],
        salesActivities: inputs.salesProcess.activities,
        availableTools: inputs.salesProcess.tools
      },
      goals: {
        revenueTarget: inputs.goals.revenueTarget,
        timeframe: inputs.goals.timeframe,
        primaryObjectives: inputs.goals.primaryObjectives,
        growthChallenges: inputs.goals.growthChallenges
      },
      contact_info: {}
    };
  }

  /**
   * Convert legacy lead analysis to new ROI inputs format
   */
  static fromLegacyLeadAnalysis(data: any): ROIInputs {
    return {
      companyInfo: {
        name: data.company_name || '',
        industry: data.industry || '',
        size: data.company_size || '',
        annualRevenue: data.annual_revenue ? parseInt(data.annual_revenue) : undefined
      },
      kpis: {
        monthlyRevenue: data.current_kpis?.monthlyRevenue || 0,
        customerAcquisitionCost: data.current_kpis?.customerAcquisitionCost || 0,
        customerLifetimeValue: data.current_kpis?.customerLifetimeValue || 0,
        conversionRate: data.current_kpis?.conversionRate || 0,
        averageOrderValue: data.current_kpis?.averageOrderValue || 0,
        monthlyLeads: data.current_kpis?.monthlyLeads || 0,
        salesCycleLength: data.current_kpis?.salesCycleLength || 0,
        convertedCustomers: data.current_kpis?.convertedCustomers || 0,
        customerLifetimeSpan: data.current_kpis?.customerLifetimeSpan || 0,
        churnRate: data.current_kpis?.churnRate || 0
      },
      costs: {
        marketingBudget: data.current_costs?.marketingBudget || 0,
        salesTeamCost: data.current_costs?.salesTeamCost || 0,
        salesCommission: data.current_costs?.salesCommission || 0,
        technologyCosts: data.current_costs?.technologyCosts || 0,
        operationalCosts: data.current_costs?.operationalCosts || 0,
        cogs: data.current_costs?.cogs || 0,
        otherCosts: data.current_costs?.otherCosts || 0
      },
      salesProcess: {
        activities: data.sales_process?.salesActivities || {},
        tools: data.sales_process?.availableTools || {},
        qualificationMethods: data.sales_process?.qualificationProcess || {}
      },
      goals: {
        revenueTarget: data.goals?.revenueTarget || 0,
        timeframe: data.goals?.timeframe || '',
        primaryObjectives: data.goals?.primaryObjectives || [],
        growthChallenges: data.goals?.growthChallenges || []
      }
    };
  }

  /**
   * Generate dashboard-compatible metrics from ROI results
   */
  static generateDashboardMetrics(results: ROIOutputs): {
    revenue: number;
    costs: number;
    roi: number;
    cac: number;
    ltv: number;
    conversionRate: number;
    projectedGrowth: number;
  } {
    return {
      revenue: results.currentState.monthlyRevenue,
      costs: results.currentState.totalCosts,
      roi: results.currentState.roi,
      cac: results.currentState.cac,
      ltv: results.currentState.ltv,
      conversionRate: results.currentState.conversionRate,
      projectedGrowth: results.projections.potentialIncrease
    };
  }

  /**
   * Create lead analysis record for admin dashboard
   */
  static createLeadAnalysisRecord(inputs: ROIInputs, results: ROIOutputs): any {
    const legacyFormat = this.toLegacyLeadAnalysis(inputs);
    
    return {
      ...legacyFormat,
      analysis_results: {
        currentROI: results.currentState.roi,
        projectedROI: results.projections.optimizedROI,
        potentialIncrease: results.projections.potentialIncrease,
        projectedRevenue: results.projections.projectedRevenue,
        currentRevenue: results.currentState.monthlyRevenue,
        confidenceScore: results.projections.confidenceScore,
        recommendations: results.recommendations.map(rec => ({
          title: rec.title,
          description: rec.description,
          priority: rec.priority,
          expectedROI: rec.expectedROI,
          implementationCost: rec.implementationCost,
          timeToImplement: rec.timeToImplement
        }))
      },
      roi_projections: {
        threeMonth: results.projections.projectedRevenue * 0.25,
        sixMonth: results.projections.projectedRevenue * 0.5,
        twelveMonth: results.projections.projectedRevenue,
        twentyFourMonth: results.projections.projectedRevenue * 1.15
      },
      strategies: results.recommendations.map(rec => ({
        category: rec.category,
        title: rec.title,
        description: rec.description,
        priority: rec.priority,
        expectedROI: rec.expectedROI
      })),
      status: this.calculateCompletionStatus(inputs),
      completion_percentage: this.calculateCompletionPercentage(inputs),
      source: 'roi-calculator-v2'
    };
  }

  /**
   * Calculate completion status
   */
  private static calculateCompletionStatus(inputs: ROIInputs): 'draft' | 'completed' {
    const completionPercentage = this.calculateCompletionPercentage(inputs);
    return completionPercentage >= 80 ? 'completed' : 'draft';
  }

  /**
   * Calculate completion percentage
   */
  private static calculateCompletionPercentage(inputs: ROIInputs): number {
    let score = 0;
    
    // Company info (30 points)
    if (inputs.companyInfo.name) score += 10;
    if (inputs.companyInfo.industry) score += 10;
    if (inputs.companyInfo.size) score += 10;
    
    // KPIs (30 points)
    if (inputs.kpis.monthlyRevenue > 0) score += 15;
    if (inputs.kpis.customerAcquisitionCost > 0) score += 15;
    
    // Costs (20 points)
    if (inputs.costs.marketingBudget > 0) score += 20;
    
    // Goals (20 points)
    if (inputs.goals.revenueTarget > 0) score += 10;
    if (inputs.goals.timeframe) score += 10;
    
    return Math.min(100, score);
  }

  /**
   * Migrate existing lead analysis to new format
   */
  static async migrateExistingAnalysis(analysisId: string): Promise<ROIInputs | null> {
    try {
      const response = await fetch(`/api/lead-analysis?id=${analysisId}`);
      if (!response.ok) return null;
      
      const result = await response.json();
      if (!result.success) return null;
      
      return this.fromLegacyLeadAnalysis(result.data);
    } catch (error) {
      console.error('Migration error:', error);
      return null;
    }
  }

  /**
   * Save analysis using new format but compatible with existing API
   */
  static async saveAnalysis(inputs: ROIInputs, results?: ROIOutputs): Promise<{
    success: boolean;
    id?: string;
    error?: string;
  }> {
    try {
      const payload = results 
        ? this.createLeadAnalysisRecord(inputs, results)
        : this.toLegacyLeadAnalysis(inputs);

      const response = await fetch('/api/lead-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (!response.ok) {
        return { success: false, error: result.error || 'Failed to save analysis' };
      }

      return { success: true, id: result.id };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Update existing analysis
   */
  static async updateAnalysis(
    analysisId: string, 
    inputs: ROIInputs, 
    results?: ROIOutputs
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const payload = results 
        ? this.createLeadAnalysisRecord(inputs, results)
        : this.toLegacyLeadAnalysis(inputs);

      const response = await fetch('/api/lead-analysis', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: analysisId, ...payload })
      });

      const result = await response.json();
      
      if (!response.ok) {
        return { success: false, error: result.error || 'Failed to update analysis' };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get enhanced ROI data for dashboard widgets
   */
  static async getEnhancedROIData(
    siteId: string, 
    segmentId: string = 'all',
    startDate?: string,
    endDate?: string
  ): Promise<any> {
    try {
      // Get existing ROI data
      const params = new URLSearchParams({
        segmentId,
        siteId,
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      });

      const response = await fetch(`/api/roi?${params.toString()}`);
      if (!response.ok) return null;

      const roiData = await response.json();
      
      // Enhance with calculator engine insights if we have enough data
      if (roiData.actual && roiData.actual > 0) {
        // This would require more context about the business
        // For now, return the existing data with enhanced formatting
        return {
          ...roiData,
          enhanced: true,
          insights: this.generateROIInsights(roiData.actual, roiData.percentChange)
        };
      }

      return roiData;
    } catch (error) {
      console.error('Enhanced ROI data error:', error);
      return null;
    }
  }

  /**
   * Generate insights for ROI data
   */
  private static generateROIInsights(roi: number, change: number): string[] {
    const insights: string[] = [];
    
    if (roi > 200) {
      insights.push('Excellent ROI performance');
    } else if (roi > 100) {
      insights.push('Good ROI, room for optimization');
    } else if (roi > 0) {
      insights.push('Positive ROI, significant improvement potential');
    } else {
      insights.push('Negative ROI, immediate optimization needed');
    }

    if (change > 20) {
      insights.push('Strong positive trend');
    } else if (change > 0) {
      insights.push('Improving performance');
    } else if (change < -20) {
      insights.push('Declining performance needs attention');
    }

    return insights;
  }
}
