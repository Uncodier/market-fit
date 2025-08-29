/**
 * Fuzzy Logic Engine for ROI Calculator
 * Generates intelligent recommendations using fuzzy logic principles
 */

import type { ROIInputs } from './calculator-engine';

export interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  expectedROI: number;
  implementationCost: number;
  timeToImplement: number;
  confidence: number;
}

export class FuzzyLogicEngine {
  private activityDatabase: Record<string, ActivityData>;
  private ruleBase: FuzzyRule[];

  constructor() {
    this.initializeActivityDatabase();
    this.initializeRuleBase();
  }

  /**
   * Generate recommendations using fuzzy logic
   */
  generateRecommendations(inputs: ROIInputs, currentState: any): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Calculate fuzzy inputs
    const fuzzyInputs = this.calculateFuzzyInputs(inputs, currentState);
    
    // Apply fuzzy rules to generate recommendations
    for (const activity of Object.keys(this.activityDatabase)) {
      if (!inputs.salesProcess.activities[activity]) {
        const recommendation = this.evaluateActivity(activity, fuzzyInputs, inputs);
        if (recommendation.confidence > 30) { // Only include viable recommendations
          recommendations.push(recommendation);
        }
      }
    }
    
    // Sort by priority and confidence
    return recommendations
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];
        
        if (aPriority !== bPriority) return bPriority - aPriority;
        return b.confidence - a.confidence;
      })
      .slice(0, 8); // Return top 8 recommendations
  }

  /**
   * Calculate fuzzy input variables
   */
  private calculateFuzzyInputs(inputs: ROIInputs, currentState: any): FuzzyInputs {
    const { kpis, costs, companyInfo } = inputs;
    
    return {
      // Performance metrics (0-100 scale)
      conversionPerformance: this.fuzzifyConversionRate(kpis.conversionRate),
      costEfficiency: this.fuzzifyCostEfficiency(currentState.cac, kpis.customerLifetimeValue),
      revenueHealth: this.fuzzifyRevenueHealth(kpis.monthlyRevenue, companyInfo.size),
      digitalMaturity: this.fuzzifyDigitalMaturity(inputs.salesProcess.tools),
      marketPosition: this.fuzzifyMarketPosition(currentState.roi, companyInfo.industry),
      
      // Company characteristics
      companyStage: this.fuzzifyCompanyStage(kpis.monthlyRevenue, companyInfo.size),
      budgetCapacity: this.fuzzifyBudgetCapacity(costs.marketingBudget, kpis.monthlyRevenue),
      teamMaturity: this.fuzzifyTeamMaturity(costs.salesTeamCost, kpis.monthlyRevenue),
      
      // Market factors
      industryFactor: this.getIndustryFactor(companyInfo.industry),
      sizeFactor: this.getSizeFactor(companyInfo.size),
      urgencyFactor: this.calculateUrgencyFactor(inputs.goals, currentState)
    };
  }

  /**
   * Evaluate a specific activity using fuzzy logic
   */
  private evaluateActivity(activity: string, fuzzyInputs: FuzzyInputs, inputs: ROIInputs): Recommendation {
    const activityData = this.activityDatabase[activity];
    
    // Apply fuzzy rules
    let score = 0;
    let confidence = 50; // Base confidence
    
    // Rule 1: Performance Gap Analysis
    if (fuzzyInputs.conversionPerformance < 40 && activityData.impactsConversion) {
      score += 25;
      confidence += 15;
    }
    
    // Rule 2: Cost Efficiency Analysis
    if (fuzzyInputs.costEfficiency < 50 && activityData.reducesCosts) {
      score += 20;
      confidence += 10;
    }
    
    // Rule 3: Digital Maturity Alignment
    const maturityAlignment = this.calculateMaturityAlignment(activityData.requiredMaturity, fuzzyInputs.digitalMaturity);
    score += maturityAlignment * 0.3;
    confidence += maturityAlignment * 0.1;
    
    // Rule 4: Industry Alignment
    const industryBonus = activityData.industryMultipliers[inputs.companyInfo.industry.toLowerCase()] || 1.0;
    score *= industryBonus;
    confidence += (industryBonus - 1) * 20;
    
    // Rule 5: Budget Feasibility
    const budgetFeasibility = this.calculateBudgetFeasibility(
      activityData.implementationCost,
      fuzzyInputs.budgetCapacity
    );
    score *= budgetFeasibility;
    confidence += (budgetFeasibility - 0.5) * 40;
    
    // Rule 6: Urgency Factor
    score += fuzzyInputs.urgencyFactor * 0.2;
    
    // Determine priority based on score
    const priority = this.determinePriority(score);
    
    // Calculate expected ROI
    const expectedROI = activityData.baseROI * industryBonus * this.getSizeMultiplier(inputs.companyInfo.size);
    
    return {
      priority,
      category: activityData.category,
      title: `Implement ${activityData.name}`,
      description: this.generateDescription(activity, fuzzyInputs, inputs),
      expectedROI: Math.round(expectedROI),
      implementationCost: activityData.implementationCost,
      timeToImplement: activityData.timeToImplement,
      confidence: Math.min(95, Math.max(30, Math.round(confidence)))
    };
  }

  /**
   * Initialize activity database
   */
  private initializeActivityDatabase(): void {
    this.activityDatabase = {
      contentMarketing: {
        name: 'Content Marketing',
        category: 'Marketing',
        baseROI: 400,
        implementationCost: 8000,
        timeToImplement: 6,
        requiredMaturity: 60,
        impactsConversion: true,
        reducesCosts: true,
        industryMultipliers: {
          technology: 1.5,
          healthcare: 1.2,
          finance: 1.3,
          retail: 1.1,
          manufacturing: 1.0,
          services: 1.2
        }
      },
      
      personalizedFollowUp: {
        name: 'Personalized Follow-up',
        category: 'Sales',
        baseROI: 180,
        implementationCost: 3000,
        timeToImplement: 2,
        requiredMaturity: 40,
        impactsConversion: true,
        reducesCosts: false,
        industryMultipliers: {
          technology: 1.2,
          healthcare: 1.4,
          finance: 1.5,
          retail: 1.0,
          manufacturing: 1.3,
          services: 1.3
        }
      },
      
      referralProgram: {
        name: 'Referral Program',
        category: 'Growth',
        baseROI: 350,
        implementationCost: 6000,
        timeToImplement: 3,
        requiredMaturity: 50,
        impactsConversion: false,
        reducesCosts: true,
        industryMultipliers: {
          technology: 1.3,
          healthcare: 1.3,
          finance: 1.1,
          retail: 1.4,
          manufacturing: 1.0,
          services: 1.4
        }
      },
      
      seoContent: {
        name: 'SEO & Organic Content',
        category: 'Marketing',
        baseROI: 500,
        implementationCost: 12000,
        timeToImplement: 12,
        requiredMaturity: 70,
        impactsConversion: true,
        reducesCosts: true,
        industryMultipliers: {
          technology: 1.4,
          healthcare: 1.1,
          finance: 1.2,
          retail: 1.3,
          manufacturing: 1.0,
          services: 1.3
        }
      },
      
      socialSelling: {
        name: 'Social Selling',
        category: 'Sales',
        baseROI: 250,
        implementationCost: 4000,
        timeToImplement: 2,
        requiredMaturity: 45,
        impactsConversion: true,
        reducesCosts: false,
        industryMultipliers: {
          technology: 1.3,
          healthcare: 1.1,
          finance: 1.2,
          retail: 1.4,
          manufacturing: 0.9,
          services: 1.2
        }
      },
      
      paidAds: {
        name: 'Paid Advertising',
        category: 'Marketing',
        baseROI: 150,
        implementationCost: 10000,
        timeToImplement: 1,
        requiredMaturity: 55,
        impactsConversion: false,
        reducesCosts: false,
        industryMultipliers: {
          technology: 1.2,
          healthcare: 0.9,
          finance: 1.0,
          retail: 1.4,
          manufacturing: 0.8,
          services: 1.1
        }
      },
      
      videoCalls: {
        name: 'Video Calls',
        category: 'Sales',
        baseROI: 200,
        implementationCost: 1500,
        timeToImplement: 1,
        requiredMaturity: 30,
        impactsConversion: true,
        reducesCosts: false,
        industryMultipliers: {
          technology: 1.3,
          healthcare: 1.2,
          finance: 1.4,
          retail: 0.9,
          manufacturing: 1.1,
          services: 1.3
        }
      },
      
      webinarsEvents: {
        name: 'Webinars & Events',
        category: 'Marketing',
        baseROI: 280,
        implementationCost: 7000,
        timeToImplement: 2,
        requiredMaturity: 60,
        impactsConversion: true,
        reducesCosts: false,
        industryMultipliers: {
          technology: 1.4,
          healthcare: 1.3,
          finance: 1.2,
          retail: 1.0,
          manufacturing: 1.1,
          services: 1.2
        }
      }
    };
  }

  /**
   * Initialize fuzzy rule base
   */
  private initializeRuleBase(): void {
    this.ruleBase = [
      {
        condition: (inputs: FuzzyInputs) => inputs.conversionPerformance < 40,
        action: 'prioritize_conversion_activities',
        weight: 0.8
      },
      {
        condition: (inputs: FuzzyInputs) => inputs.costEfficiency < 50,
        action: 'prioritize_cost_reduction',
        weight: 0.7
      },
      {
        condition: (inputs: FuzzyInputs) => inputs.digitalMaturity < 40,
        action: 'prioritize_basic_digital_tools',
        weight: 0.6
      },
      {
        condition: (inputs: FuzzyInputs) => inputs.budgetCapacity > 70,
        action: 'consider_high_investment_activities',
        weight: 0.5
      },
      {
        condition: (inputs: FuzzyInputs) => inputs.urgencyFactor > 60,
        action: 'prioritize_quick_wins',
        weight: 0.9
      }
    ];
  }

  /**
   * Fuzzy logic helper methods
   */
  private fuzzifyConversionRate(rate: number): number {
    // Convert conversion rate to 0-100 scale
    return Math.min(100, (rate / 10) * 100);
  }

  private fuzzifyCostEfficiency(cac: number, ltv: number): number {
    const ratio = ltv > 0 ? ltv / cac : 0;
    return Math.min(100, (ratio / 5) * 100); // 5:1 ratio = 100%
  }

  private fuzzifyRevenueHealth(revenue: number, companySize: string): number {
    const sizeTargets = {
      '1-10': 10000,
      '11-50': 50000,
      '51-200': 200000,
      '201-500': 500000,
      '501+': 1000000
    };
    
    const target = sizeTargets[companySize as keyof typeof sizeTargets] || 50000;
    return Math.min(100, (revenue / target) * 100);
  }

  private fuzzifyDigitalMaturity(tools: Record<string, boolean>): number {
    const totalTools = Object.keys(tools).length;
    const activeTools = Object.values(tools).filter(Boolean).length;
    return totalTools > 0 ? (activeTools / totalTools) * 100 : 0;
  }

  private fuzzifyMarketPosition(roi: number, industry: string): number {
    const industryBenchmarks = {
      technology: 180,
      healthcare: 220,
      finance: 280,
      retail: 140,
      manufacturing: 320,
      services: 160
    };
    
    const benchmark = industryBenchmarks[industry.toLowerCase() as keyof typeof industryBenchmarks] || 160;
    return Math.min(100, (roi / benchmark) * 100);
  }

  private fuzzifyCompanyStage(revenue: number, size: string): number {
    // Combine revenue and size to determine stage
    const revenueScore = Math.min(100, revenue / 100000 * 100);
    const sizeScore = this.getSizeFactor(size) * 25;
    return (revenueScore + sizeScore) / 2;
  }

  private fuzzifyBudgetCapacity(marketingBudget: number, revenue: number): number {
    const budgetRatio = revenue > 0 ? marketingBudget / revenue : 0;
    return Math.min(100, budgetRatio * 1000); // 10% budget ratio = 100%
  }

  private fuzzifyTeamMaturity(salesCost: number, revenue: number): number {
    const teamRatio = revenue > 0 ? salesCost / revenue : 0;
    return Math.min(100, teamRatio * 500); // 20% team cost ratio = 100%
  }

  private getIndustryFactor(industry: string): number {
    const factors = {
      technology: 1.2,
      healthcare: 1.1,
      finance: 1.3,
      retail: 1.0,
      manufacturing: 0.9,
      services: 1.0
    };
    
    return factors[industry.toLowerCase() as keyof typeof factors] || 1.0;
  }

  private getSizeFactor(size: string): number {
    const factors = {
      '1-10': 0.8,
      '11-50': 1.0,
      '51-200': 1.2,
      '201-500': 1.4,
      '501+': 1.6
    };
    
    return factors[size as keyof typeof factors] || 1.0;
  }

  private getSizeMultiplier(size: string): number {
    return this.getSizeFactor(size);
  }

  private calculateUrgencyFactor(goals: any, currentState: any): number {
    let urgency = 30; // Base urgency
    
    // High urgency if revenue target is ambitious
    if (goals.revenueTarget > currentState.monthlyRevenue * 2) {
      urgency += 30;
    }
    
    // High urgency if timeframe is short
    if (goals.timeframe === '3-months' || goals.timeframe === '6-months') {
      urgency += 25;
    }
    
    // High urgency if performance is below average
    if (currentState.roi < 100) {
      urgency += 15;
    }
    
    return Math.min(100, urgency);
  }

  private calculateMaturityAlignment(requiredMaturity: number, currentMaturity: number): number {
    if (currentMaturity >= requiredMaturity) return 100;
    return (currentMaturity / requiredMaturity) * 100;
  }

  private calculateBudgetFeasibility(cost: number, budgetCapacity: number): number {
    // Convert budget capacity (0-100) to feasibility multiplier (0.2-1.0)
    return 0.2 + (budgetCapacity / 100) * 0.8;
  }

  private determinePriority(score: number): 'critical' | 'high' | 'medium' | 'low' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private generateDescription(activity: string, fuzzyInputs: FuzzyInputs, inputs: ROIInputs): string {
    const activityData = this.activityDatabase[activity];
    const reasons = [];
    
    if (fuzzyInputs.conversionPerformance < 40 && activityData.impactsConversion) {
      reasons.push('improve conversion rates');
    }
    
    if (fuzzyInputs.costEfficiency < 50 && activityData.reducesCosts) {
      reasons.push('reduce customer acquisition costs');
    }
    
    if (fuzzyInputs.digitalMaturity < 50) {
      reasons.push('enhance digital capabilities');
    }
    
    if (fuzzyInputs.urgencyFactor > 60) {
      reasons.push('achieve quick wins');
    }
    
    const reasonText = reasons.length > 0 ? ` to ${reasons.join(' and ')}` : '';
    
    return `Implement ${activityData.name}${reasonText}. Expected to deliver ${activityData.baseROI}% ROI within ${activityData.timeToImplement} months.`;
  }
}

// Supporting interfaces
interface ActivityData {
  name: string;
  category: string;
  baseROI: number;
  implementationCost: number;
  timeToImplement: number;
  requiredMaturity: number;
  impactsConversion: boolean;
  reducesCosts: boolean;
  industryMultipliers: Record<string, number>;
}

interface FuzzyInputs {
  conversionPerformance: number;
  costEfficiency: number;
  revenueHealth: number;
  digitalMaturity: number;
  marketPosition: number;
  companyStage: number;
  budgetCapacity: number;
  teamMaturity: number;
  industryFactor: number;
  sizeFactor: number;
  urgencyFactor: number;
}

interface FuzzyRule {
  condition: (inputs: FuzzyInputs) => boolean;
  action: string;
  weight: number;
}
