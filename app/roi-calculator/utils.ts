// Enhanced Client-side utility functions for ROI calculator with advanced benchmarks and fuzzy logic

import { 
  INDUSTRY_BENCHMARKS, 
  COMPANY_SIZE_MULTIPLIERS, 
  getIndustryBenchmark, 
  calculateBenchmarkConfidence 
} from './industry-benchmarks';
import { 
  generateFuzzyRecommendation, 
  calculateFuzzyInputs 
} from './fuzzy-logic';

export interface ROIMetrics {
  currentROI: number;
  projectedROI: number;
  potentialIncrease: number;
  projectedRevenue: number;
  projectedCosts: number;
  totalCurrentCosts: number;
  previousMonthlyRevenue?: number;
  projectedImprovement: {
    conversionRateIncrease: number;
    leadQualityIncrease: number;
    salesCycleReduction: number;
    costReduction: number;
  };
  opportunityCosts: number;
  filledKpis: CurrentKPIs;
  filledCosts: CurrentCosts;
  isUsingDefaults: {
    monthlyRevenue: boolean;
    customerAcquisitionCost: boolean;
    customerLifetimeValue: boolean;
    conversionRate: boolean;
    averageOrderValue: boolean;
    monthlyLeads: boolean;
    convertedCustomers: boolean;
    customerLifetimeSpan: boolean;
    churnRate: boolean;
    marketingBudget: boolean;
    salesTeamCost: boolean;
    salesCommission: boolean;
    technologyCosts: boolean;
    operationalCosts: boolean;
    cogs: boolean;
  };
}

export interface CurrentKPIs {
  monthlyRevenue: number;
  customerAcquisitionCost: number;
  customerLifetimeValue: number;
  conversionRate: number;
  averageOrderValue: number;
  monthlyLeads: number;
  salesCycleLength: number;
  convertedCustomers: number;
  customerLifetimeSpan: number; // in months
  churnRate: number; // percentage
}

export interface CurrentCosts {
  marketingBudget: number;
  salesTeamCost: number;
  salesCommission: number;
  technologyCosts: number;
  operationalCosts: number;
  cogs: number; // Cost of Goods Sold
  otherCosts: number;
}

export interface Goals {
  revenueTarget: number;
  timeframe: string;
  primaryObjectives: string[];
  growthChallenges: string[];
}

// Get intelligent defaults based on enhanced industry benchmarks and company size
export function getIntelligentDefaults(industry: string, companySize: string, existingData: any) {
  const defaults: any = {};
  
  // Use enhanced industry benchmarks with fallbacks
  const safeIndustry = industry || 'services';
  const safeCompanySize = companySize || '11-50';
  
  const conversionRate = getIndustryBenchmark(safeIndustry, 'conversionRate', safeCompanySize, 'avg') || 3;
  const customerLifetimeValue = getIndustryBenchmark(safeIndustry, 'customerLifetimeValue', safeCompanySize, 'avg') || 2500;
  const customerAcquisitionCost = getIndustryBenchmark(safeIndustry, 'customerAcquisitionCost', safeCompanySize, 'avg') || 300;
  const averageOrderValue = getIndustryBenchmark(safeIndustry, 'averageOrderValue', safeCompanySize, 'avg') || 300;
  const salesCycleLength = getIndustryBenchmark(safeIndustry, 'salesCycleLength', safeCompanySize, 'avg') || 30;
  
  // Get company size multipliers for more precise adjustments
  const sizeMultipliers = COMPANY_SIZE_MULTIPLIERS[companySize || '11-50'] || COMPANY_SIZE_MULTIPLIERS['11-50'];

  // Calculate intelligent defaults using enhanced benchmarks
  if (!existingData.monthlyRevenue && existingData.customerAcquisitionCost && existingData.monthlyLeads) {
    defaults.monthlyRevenue = (existingData.monthlyLeads * conversionRate / 100) * averageOrderValue;
  }
  
  if (!existingData.customerAcquisitionCost && existingData.marketingBudget && existingData.monthlyLeads) {
    defaults.customerAcquisitionCost = existingData.marketingBudget / (existingData.monthlyLeads * conversionRate / 100);
  }
  
  if (!existingData.customerLifetimeValue) {
    defaults.customerLifetimeValue = customerLifetimeValue;
  }
  
  if (!existingData.conversionRate) {
    defaults.conversionRate = conversionRate;
  }
  
  if (!existingData.averageOrderValue) {
    defaults.averageOrderValue = averageOrderValue;
  }
  
  if (!existingData.salesCycleLength) {
    defaults.salesCycleLength = salesCycleLength;
  }
  
  if (!existingData.customerAcquisitionCost) {
    defaults.customerAcquisitionCost = customerAcquisitionCost;
  }
  
  if (!existingData.monthlyLeads && existingData.marketingBudget) {
    defaults.monthlyLeads = Math.round(existingData.marketingBudget / (defaults.customerAcquisitionCost || customerAcquisitionCost));
  }

  if (!existingData.convertedCustomers) {
    const leads = existingData.monthlyLeads || defaults.monthlyLeads || 100;
    const rate = existingData.conversionRate || defaults.conversionRate || conversionRate;
    defaults.convertedCustomers = Math.round(leads * rate / 100);
  }
  
  // Add churn rate and customer lifetime span defaults
  if (!existingData.churnRate) {
    const industryKey = industry?.toLowerCase() || 'services';
    const churnData = INDUSTRY_BENCHMARKS[industryKey]?.churnRate || INDUSTRY_BENCHMARKS.services.churnRate;
    defaults.churnRate = churnData?.monthly || 5;
  }
  
  if (!existingData.customerLifetimeSpan) {
    // Calculate based on churn rate: 1 / (monthly churn rate / 100)
    const churnRate = existingData.churnRate || defaults.churnRate || 5;
    defaults.customerLifetimeSpan = Math.round(100 / churnRate);
  }

  return defaults;
}

// Calculate ROI metrics with intelligent defaults
export function calculateROIMetrics(
  currentKpis: CurrentKPIs,
  currentCosts: CurrentCosts,
  goals: Goals,
  industry: string = 'services',
  companySize: string = '11-50'
): ROIMetrics {
  // Get intelligent defaults for missing data
  const defaults = getIntelligentDefaults(industry, companySize, { ...currentKpis, ...currentCosts });
  
  // Fill in missing values with intelligent defaults
  const filledKpis = {
    monthlyRevenue: currentKpis.monthlyRevenue || defaults.monthlyRevenue || 10000,
    customerAcquisitionCost: currentKpis.customerAcquisitionCost || defaults.customerAcquisitionCost || 150,
    customerLifetimeValue: currentKpis.customerLifetimeValue || defaults.customerLifetimeValue || 1800,
    conversionRate: currentKpis.conversionRate || defaults.conversionRate || 2.5,
    averageOrderValue: currentKpis.averageOrderValue || defaults.averageOrderValue || 200,
    monthlyLeads: currentKpis.monthlyLeads || defaults.monthlyLeads || 100,
    salesCycleLength: currentKpis.salesCycleLength || defaults.salesCycleLength || 60,
    convertedCustomers: currentKpis.convertedCustomers || defaults.convertedCustomers || Math.round((currentKpis.monthlyLeads || defaults.monthlyLeads || 100) * (currentKpis.conversionRate || defaults.conversionRate || 2.5) / 100),
    customerLifetimeSpan: currentKpis.customerLifetimeSpan || defaults.customerLifetimeSpan || 24, // 24 months average
    churnRate: currentKpis.churnRate || defaults.churnRate || 5, // 5% monthly churn rate
  };

  const filledCosts = {
    marketingBudget: currentCosts.marketingBudget || Math.round(filledKpis.monthlyRevenue * 0.15),
    salesTeamCost: currentCosts.salesTeamCost || Math.round(filledKpis.monthlyRevenue * 0.20),
    salesCommission: currentCosts.salesCommission || Math.round(filledKpis.monthlyRevenue * 0.08), // 8% of revenue as default commission
    technologyCosts: currentCosts.technologyCosts || Math.round(filledKpis.monthlyRevenue * 0.05),
    operationalCosts: currentCosts.operationalCosts || Math.round(filledKpis.monthlyRevenue * 0.10),
    cogs: currentCosts.cogs || Math.round(filledKpis.monthlyRevenue * 0.35), // 35% of revenue as default COGS
    otherCosts: currentCosts.otherCosts || Math.round(filledKpis.monthlyRevenue * 0.05),
  };

  const totalCurrentCosts = Object.values(filledCosts).reduce((sum, cost) => sum + cost, 0);
  const annualRevenue = filledKpis.monthlyRevenue * 12;
  const currentROI = totalCurrentCosts > 0 ? ((annualRevenue - totalCurrentCosts) / totalCurrentCosts) * 100 : 0;
  
  // Enhanced projected improvements based on industry benchmarks and fuzzy logic
  const industryBenchmark = getIndustryBenchmark(industry, 'conversionRate', companySize, 'top10Percent');
  const currentPerformanceGap = Math.max(0, industryBenchmark - filledKpis.conversionRate);
  
  // Calculate improvement potential based on current position vs industry benchmarks
  const improvementPotential = {
    conversionRate: currentPerformanceGap / industryBenchmark,
    efficiency: Math.min(0.4, (filledKpis.customerAcquisitionCost - getIndustryBenchmark(industry, 'customerAcquisitionCost', companySize, 'min')) / filledKpis.customerAcquisitionCost),
    cycle: Math.min(0.3, (filledKpis.salesCycleLength - getIndustryBenchmark(industry, 'salesCycleLength', companySize, 'min')) / filledKpis.salesCycleLength)
  };
  
  // Company size and maturity adjustments
  const sizeMultipliers = COMPANY_SIZE_MULTIPLIERS[companySize || '11-50'] || COMPANY_SIZE_MULTIPLIERS['11-50'];
  
  const projectedImprovement = {
    conversionRateIncrease: Math.round(Math.min(50, 15 + (improvementPotential.conversionRate * 40)) * sizeMultipliers.efficiency),
    leadQualityIncrease: Math.round(Math.min(45, 20 + (improvementPotential.efficiency * 30)) * sizeMultipliers.scalability),
    salesCycleReduction: Math.round(Math.min(35, 10 + (improvementPotential.cycle * 30)) * sizeMultipliers.efficiency),
    costReduction: Math.round(Math.min(25, 8 + (improvementPotential.efficiency * 20)) * sizeMultipliers.resources),
  };

  const projectedRevenue = annualRevenue * (1 + projectedImprovement.conversionRateIncrease / 100);
  const projectedCosts = totalCurrentCosts * (1 - projectedImprovement.costReduction / 100);
  const projectedROI = projectedCosts > 0 ? ((projectedRevenue - projectedCosts) / projectedCosts) * 100 : 0;
  
  return {
    currentROI,
    projectedROI,
    potentialIncrease: projectedROI - currentROI,
    projectedRevenue,
    projectedCosts,
    totalCurrentCosts,
    projectedImprovement,
    opportunityCosts: Math.max(0, (goals.revenueTarget || projectedRevenue * 1.2) - annualRevenue) * 0.7,
    filledKpis,
    filledCosts,
    isUsingDefaults: {
      monthlyRevenue: !currentKpis.monthlyRevenue,
      customerAcquisitionCost: !currentKpis.customerAcquisitionCost,
      customerLifetimeValue: !currentKpis.customerLifetimeValue,
      conversionRate: !currentKpis.conversionRate,
      averageOrderValue: !currentKpis.averageOrderValue,
      monthlyLeads: !currentKpis.monthlyLeads,
      convertedCustomers: !currentKpis.convertedCustomers,
      customerLifetimeSpan: !currentKpis.customerLifetimeSpan,
      churnRate: !currentKpis.churnRate,
      marketingBudget: !currentCosts.marketingBudget,
      salesTeamCost: !currentCosts.salesTeamCost,
      salesCommission: !currentCosts.salesCommission,
      technologyCosts: !currentCosts.technologyCosts,
      operationalCosts: !currentCosts.operationalCosts,
      cogs: !currentCosts.cogs,
    }
  };
}

// Generate industry-specific recommendations
export function getIndustryRecommendations(industry: string, companySize: string): string[] {
  const recommendations: Record<string, string[]> = {
    technology: [
      "Implement product-led growth strategies",
      "Focus on user onboarding optimization",
      "Leverage freemium models for lead generation",
      "Invest in developer community building"
    ],
    finance: [
      "Enhance compliance and security messaging",
      "Develop trust-building content strategies",
      "Focus on ROI and cost-saving benefits",
      "Implement white-glove onboarding processes"
    ],
    healthcare: [
      "Emphasize HIPAA compliance and security",
      "Create educational content for decision makers",
      "Focus on patient outcome improvements",
      "Develop case studies and testimonials"
    ],
    retail: [
      "Optimize for mobile and omnichannel experience",
      "Implement seasonal marketing strategies",
      "Focus on customer lifetime value optimization",
      "Leverage social proof and reviews"
    ],
    manufacturing: [
      "Emphasize efficiency and cost reduction",
      "Create technical documentation and specs",
      "Focus on B2B relationship building",
      "Implement account-based marketing"
    ],
    services: [
      "Showcase expertise through thought leadership",
      "Develop case studies and success stories",
      "Focus on relationship-based selling",
      "Implement referral programs"
    ]
  };

  return recommendations[industry] || [
    "Develop targeted buyer personas",
    "Create industry-specific content",
    "Focus on pain point solutions",
    "Build trust through social proof"
  ];
}

// Get company size specific strategies
export function getCompanySizeStrategies(companySize: string): string[] {
  const strategies: Record<string, string[]> = {
    "1-10": [
      "Focus on cost-effective marketing channels",
      "Leverage automation to scale efficiently",
      "Build strong customer relationships",
      "Prioritize high-impact, low-cost tactics"
    ],
    "11-50": [
      "Implement scalable processes and systems",
      "Develop specialized sales roles",
      "Invest in marketing automation",
      "Create repeatable success frameworks"
    ],
    "51-200": [
      "Establish dedicated marketing and sales teams",
      "Implement advanced CRM and analytics",
      "Develop multi-channel strategies",
      "Focus on process optimization"
    ],
    "201-500": [
      "Create specialized go-to-market teams",
      "Implement enterprise-grade solutions",
      "Develop account-based strategies",
      "Focus on operational excellence"
    ],
    "501-1000": [
      "Establish centers of excellence",
      "Implement advanced analytics and AI",
      "Develop global market strategies",
      "Focus on innovation and differentiation"
    ],
    "1000+": [
      "Create enterprise transformation programs",
      "Implement AI-driven personalization",
      "Develop ecosystem partnerships",
      "Focus on market leadership"
    ]
  };

  return strategies[companySize] || strategies["11-50"];
}

// Validate section completion - more flexible, allows partial completion
export function validateSectionCompletion(section: string, data: any): boolean {
  switch (section) {
    case "company-info":
      return !!(data.company_name || data.industry || data.company_size);
    case "current-kpis":
      return !!(data.current_kpis?.monthlyRevenue > 0 || data.current_kpis?.customerAcquisitionCost > 0 || data.current_kpis?.customerLifetimeValue > 0);
    case "current-costs":
      return !!(data.current_costs?.marketingBudget > 0 || data.current_costs?.salesTeamCost > 0 || data.current_costs?.technologyCosts > 0);
    case "sales-process":
      return !!(data.sales_process?.qualificationProcess && Object.values(data.sales_process.qualificationProcess).some(Boolean));
    case "goals":
      return !!(data.goals?.revenueTarget > 0 || data.goals?.timeframe);
    default:
      return false;
  }
}

// Get section validation errors
export function getSectionValidationErrors(section: string, data: any): string[] {
  const errors: string[] = [];
  
  switch (section) {
    case "company-info":
      if (!data.company_name) errors.push("Company name is required");
      if (!data.industry) errors.push("Industry is required");
      if (!data.company_size) errors.push("Company size is required");
      break;
    case "current-kpis":
      if (!data.current_kpis?.monthlyRevenue || data.current_kpis.monthlyRevenue <= 0) {
        errors.push("Monthly revenue must be greater than 0");
      }
      if (!data.current_kpis?.customerAcquisitionCost || data.current_kpis.customerAcquisitionCost <= 0) {
        errors.push("Customer acquisition cost must be greater than 0");
      }
      break;
    case "current-costs":
      if (!data.current_costs?.marketingBudget || data.current_costs.marketingBudget <= 0) {
        errors.push("Marketing budget must be greater than 0");
      }
      break;
    case "sales-process":
      if (!data.sales_process?.qualificationProcess || !Object.values(data.sales_process.qualificationProcess).some(Boolean)) {
        errors.push("At least one lead qualification method is required");
      }
      break;
    case "goals":
      if (!data.goals?.revenueTarget || data.goals.revenueTarget <= 0) {
        errors.push("Revenue target must be greater than 0");
      }
      if (!data.goals?.timeframe) {
        errors.push("Timeframe is required");
      }
      break;
  }
  
  return errors;
}

// Calculate completion percentage
export function calculateCompletionPercentage(data: any): number {
  let completionScore = 0;
  if (data.company_name) completionScore += 20;
  if (data.industry) completionScore += 15;
  if (data.current_kpis?.monthlyRevenue > 0) completionScore += 25;
  if (data.current_costs?.marketingBudget > 0) completionScore += 20;
  if (data.sales_process?.qualificationProcess && Object.values(data.sales_process.qualificationProcess).some(Boolean)) completionScore += 10;
  if (data.goals?.revenueTarget > 0) completionScore += 10;
  
  return Math.min(100, completionScore);
}

// Opportunity Cost Analysis Interfaces
export interface OpportunityCost {
  activity: string;
  activityKey: keyof SalesActivities;
  estimatedROI: number;
  implementationCost: number;
  timeToImplement: number; // in months
  riskLevel: 'low' | 'medium' | 'high';
  opportunityCost: number;
  priority: number; // 1-10 scale
  reasoning: string;
  toolValidation?: ValidationResult;
}

export interface SalesActivities {
  coldCalls: boolean;
  personalizedFollowUp: boolean;
  videoCalls: boolean;
  transactionalEmails: boolean;
  socialSelling: boolean;
  contentMarketing: boolean;
  referralProgram: boolean;
  webinarsEvents: boolean;
  paidAds: boolean;
  seoContent: boolean;
  partnerships: boolean;
  directMail: boolean;
  tradeShows: boolean;
  influencerMarketing: boolean;
  retargeting: boolean;
  activations: boolean;
  physicalVisits: boolean;
  personalBrand: boolean;
}

export interface CompanyMaturity {
  stage: 'startup' | 'growth' | 'mature' | 'enterprise';
  digitalMaturity: number; // 1-10 scale
  salesTeamSize: number;
  marketingBudget: number;
  techStack: 'basic' | 'intermediate' | 'advanced';
  industryType: string;
  targetMarket: 'b2b' | 'b2c' | 'both';
}

export interface FuzzyLogicRecommendation {
  activity: string;
  activityKey: keyof SalesActivities;
  score: number; // 0-100
  confidence: number; // 0-100
  reasoning: string[];
  implementationPlan: {
    phase: number;
    timeframe: string;
    resources: string[];
    expectedROI: number;
  };
  prerequisites: string[];
  risks: string[];
}

// Fuzzy Logic System for Activity Recommendations
export function calculateOpportunityCosts(
  currentActivities: SalesActivities,
  kpis: CurrentKPIs,
  costs: CurrentCosts,
  industry: string,
  companySize: string,
  availableTools?: LeadAnalysisFormData['sales_process']['availableTools']
): OpportunityCost[] {
  const allActivities: Array<{
    key: keyof SalesActivities;
    name: string;
    baseROI: number;
    baseCost: number;
    timeToImplement: number;
    riskLevel: 'low' | 'medium' | 'high';
  }> = [
    { key: 'coldCalls', name: 'Cold Calls', baseROI: 120, baseCost: 2000, timeToImplement: 1, riskLevel: 'low' },
    { key: 'personalizedFollowUp', name: 'Personalized Follow-up', baseROI: 180, baseCost: 3000, timeToImplement: 2, riskLevel: 'low' },
    { key: 'videoCalls', name: 'Video Calls', baseROI: 200, baseCost: 1500, timeToImplement: 1, riskLevel: 'low' },
    { key: 'transactionalEmails', name: 'Transactional Emails', baseROI: 300, baseCost: 5000, timeToImplement: 3, riskLevel: 'medium' },
    { key: 'socialSelling', name: 'Social Selling', baseROI: 250, baseCost: 4000, timeToImplement: 2, riskLevel: 'medium' },
    { key: 'contentMarketing', name: 'Content Marketing', baseROI: 400, baseCost: 8000, timeToImplement: 6, riskLevel: 'medium' },
    { key: 'referralProgram', name: 'Referral Program', baseROI: 350, baseCost: 6000, timeToImplement: 3, riskLevel: 'low' },
    { key: 'webinarsEvents', name: 'Webinars & Events', baseROI: 280, baseCost: 7000, timeToImplement: 2, riskLevel: 'medium' },
    { key: 'paidAds', name: 'Paid Advertising', baseROI: 150, baseCost: 10000, timeToImplement: 1, riskLevel: 'high' },
    { key: 'seoContent', name: 'SEO & Organic Content', baseROI: 500, baseCost: 12000, timeToImplement: 12, riskLevel: 'low' },
    { key: 'partnerships', name: 'Strategic Partnerships', baseROI: 600, baseCost: 15000, timeToImplement: 6, riskLevel: 'medium' },
    { key: 'directMail', name: 'Direct Mail', baseROI: 130, baseCost: 8000, timeToImplement: 2, riskLevel: 'medium' },
    { key: 'tradeShows', name: 'Trade Shows & Conferences', baseROI: 220, baseCost: 20000, timeToImplement: 3, riskLevel: 'high' },
    { key: 'influencerMarketing', name: 'Influencer Marketing', baseROI: 180, baseCost: 12000, timeToImplement: 3, riskLevel: 'high' },
    { key: 'retargeting', name: 'Retargeting Campaigns', baseROI: 250, baseCost: 6000, timeToImplement: 2, riskLevel: 'medium' },
    { key: 'activations', name: 'Brand Activations', baseROI: 300, baseCost: 25000, timeToImplement: 4, riskLevel: 'high' },
    { key: 'physicalVisits', name: 'Physical Visits', baseROI: 400, baseCost: 5000, timeToImplement: 1, riskLevel: 'low' },
    { key: 'personalBrand', name: 'Personal Brand', baseROI: 450, baseCost: 8000, timeToImplement: 12, riskLevel: 'low' },
  ];

  const opportunityCosts: OpportunityCost[] = [];

  allActivities.forEach(activity => {
    if (!currentActivities[activity.key]) {
      // Calculate industry and company size multipliers
      const industryMultiplier = getIndustryMultiplier(industry, activity.key);
      const sizeMultiplier = getCompanySizeMultiplier(companySize, activity.key);
      
      const adjustedROI = activity.baseROI * industryMultiplier * sizeMultiplier;
      const adjustedCost = activity.baseCost * sizeMultiplier;
      
      // Calculate opportunity cost based on LTV per period
      const monthlyValuePerCustomer = kpis.customerLifetimeValue / kpis.customerLifetimeSpan;
      const monthlyRevenueFromConvertedCustomers = kpis.convertedCustomers * monthlyValuePerCustomer;
      const monthlyRevenueLoss = monthlyRevenueFromConvertedCustomers * (adjustedROI / 100);
      const opportunityCost = monthlyRevenueLoss * activity.timeToImplement;
      
      // Calculate priority based on ROI, cost, and current needs
      const priority = calculateActivityPriority(activity, kpis, costs, adjustedROI, adjustedCost);
      
      // Validate tool requirements and calculate additional costs
      let toolValidation: ValidationResult | undefined;
      let totalImplementationCost = adjustedCost;
      
      if (availableTools) {
        toolValidation = validateToolRequirements(activity.key, availableTools);
        totalImplementationCost = adjustedCost + toolValidation.totalSetupCost;
      }
      
      opportunityCosts.push({
        activity: activity.name,
        activityKey: activity.key,
        estimatedROI: adjustedROI,
        implementationCost: totalImplementationCost,
        timeToImplement: activity.timeToImplement,
        riskLevel: activity.riskLevel,
        opportunityCost,
        priority,
        reasoning: generateOpportunityReasoning(activity, kpis, costs, industry, companySize),
        toolValidation
      });
    }
  });

  return opportunityCosts.sort((a, b) => b.priority - a.priority);
}

// Enhanced Fuzzy Logic Recommendation System
export function generateFuzzyLogicRecommendations(
  currentActivities: SalesActivities,
  kpis: CurrentKPIs,
  costs: CurrentCosts,
  industry: string,
  companySize: string
): FuzzyLogicRecommendation[] {
  const companyMaturity = assessCompanyMaturity(kpis, costs, companySize, industry);
  const opportunityCosts = calculateOpportunityCosts(currentActivities, kpis, costs, industry, companySize);
  
  const recommendations: FuzzyLogicRecommendation[] = [];
  
  // Get all available activities that are not currently active
  const availableActivities = Object.keys(currentActivities).filter(
    key => !currentActivities[key as keyof SalesActivities]
  ) as Array<keyof SalesActivities>;
  
  // Generate fuzzy recommendations for each available activity
  availableActivities.forEach((activityKey, index) => {
    const activityName = activityKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    
    // Use enhanced fuzzy logic system
    const fuzzyResult = generateFuzzyRecommendation(
      activityName,
      kpis,
      costs,
      industry,
      companySize
    );
    
    // Find corresponding opportunity cost data
    const opportunity = opportunityCosts.find(opp => opp.activityKey === activityKey);
    
    if (fuzzyResult.score > 10) { // Include most recommendations, only filter very low scores
      recommendations.push({
        activity: activityName,
        activityKey,
        score: fuzzyResult.score,
        confidence: fuzzyResult.confidence,
        reasoning: fuzzyResult.reasoning.length > 0 ? fuzzyResult.reasoning : [
          generateFuzzyReasoning({ activityKey, activity: activityName }, companyMaturity, kpis, costs)[0] || 'Strategic alignment with business goals'
        ],
        implementationPlan: generateImplementationPlan(
          opportunity || { 
            activityKey, 
            activity: activityName, 
            timeToImplement: 2, 
            estimatedROI: fuzzyResult.score * 2 
          }, 
          companyMaturity, 
          index + 1
        ),
        prerequisites: getPrerequisites(activityKey, currentActivities, companyMaturity),
        risks: getRisks(activityKey, companyMaturity, industry)
      });
    }
  });
  
  return recommendations
    .sort((a, b) => {
      // Sort by priority first, then by score
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1, not_recommended: 0 };
      const aPriority = a.score >= 90 ? 4 : a.score >= 70 ? 3 : a.score >= 45 ? 2 : a.score >= 25 ? 1 : 0;
      const bPriority = b.score >= 90 ? 4 : b.score >= 70 ? 3 : b.score >= 45 ? 2 : b.score >= 25 ? 1 : 0;
      
      if (aPriority !== bPriority) return bPriority - aPriority;
      return b.score - a.score;
    })
    .slice(0, 8); // Return top 8 recommendations
}

// Helper Functions
function getIndustryMultiplier(industry: string, activity: keyof SalesActivities): number {
  const industryMultipliers: Record<string, Partial<Record<keyof SalesActivities, number>>> = {
    'technology': {
      contentMarketing: 1.5,
      seoContent: 1.4,
      personalBrand: 1.3,
      paidAds: 1.2,
      socialSelling: 1.3
    },
    'healthcare': {
      personalBrand: 1.6,
      physicalVisits: 1.4,
      referralProgram: 1.3,
      contentMarketing: 1.2
    },
    'finance': {
      personalBrand: 1.5,
      physicalVisits: 1.3,
      partnerships: 1.4,
      coldCalls: 1.2
    },
    'retail': {
      paidAds: 1.4,
      activations: 1.5,
      influencerMarketing: 1.3,
      retargeting: 1.3
    },
    'manufacturing': {
      tradeShows: 1.5,
      physicalVisits: 1.4,
      partnerships: 1.3,
      directMail: 1.2
    }
  };
  
  return industryMultipliers[industry.toLowerCase()]?.[activity] || 1.0;
}

function getCompanySizeMultiplier(companySize: string, activity: keyof SalesActivities): number {
  const sizeMultipliers: Record<string, Partial<Record<keyof SalesActivities, number>>> = {
    'startup': {
      personalBrand: 1.4,
      socialSelling: 1.3,
      contentMarketing: 1.2,
      coldCalls: 1.3
    },
    'small': {
      seoContent: 1.3,
      referralProgram: 1.4,
      personalizedFollowUp: 1.2,
      physicalVisits: 1.3
    },
    'medium': {
      paidAds: 1.3,
      partnerships: 1.2,
      webinarsEvents: 1.3,
      tradeShows: 1.2
    },
    'large': {
      activations: 1.4,
      tradeShows: 1.3,
      partnerships: 1.3,
      influencerMarketing: 1.2
    }
  };
  
  return sizeMultipliers[companySize.toLowerCase()]?.[activity] || 1.0;
}

function calculateActivityPriority(
  activity: any,
  kpis: CurrentKPIs,
  costs: CurrentCosts,
  adjustedROI: number,
  adjustedCost: number
): number {
  let priority = 0;
  
  // ROI factor (40% weight)
  priority += (adjustedROI / 100) * 4;
  
  // Cost efficiency factor (30% weight)
  const costEfficiency = adjustedROI / (adjustedCost / 1000);
  priority += Math.min(costEfficiency, 10) * 3;
  
  // Implementation speed factor (20% weight)
  const speedFactor = Math.max(0, 13 - activity.timeToImplement);
  priority += speedFactor * 2;
  
  // Risk factor (10% weight) - lower risk = higher priority
  const riskFactor = activity.riskLevel === 'low' ? 3 : activity.riskLevel === 'medium' ? 2 : 1;
  priority += riskFactor;
  
  return Math.min(10, Math.max(1, priority));
}

function generateOpportunityReasoning(
  activity: any,
  kpis: CurrentKPIs,
  costs: CurrentCosts,
  industry: string,
  companySize: string
): string {
  const reasons = [];
  
  if (activity.baseROI > 300) {
    reasons.push("High ROI potential");
  }
  
  if (activity.timeToImplement <= 2) {
    reasons.push("Quick implementation");
  }
  
  if (activity.riskLevel === 'low') {
    reasons.push("Low risk investment");
  }
  
  // Industry-specific reasoning
  if (industry.toLowerCase() === 'technology' && ['contentMarketing', 'seoContent', 'personalBrand'].includes(activity.key)) {
    reasons.push("Highly effective for tech companies");
  }
  
  if (companySize.toLowerCase() === 'startup' && ['personalBrand', 'socialSelling'].includes(activity.key)) {
    reasons.push("Essential for startup growth");
  }
  
  return reasons.join(", ") || "Good strategic fit for your business";
}

function assessCompanyMaturity(
  kpis: CurrentKPIs,
  costs: CurrentCosts,
  companySize: string,
  industry: string
): CompanyMaturity {
  let stage: 'startup' | 'growth' | 'mature' | 'enterprise' = 'startup';
  
  if (kpis.monthlyRevenue > 100000) stage = 'mature';
  if (kpis.monthlyRevenue > 50000) stage = 'growth';
  if (kpis.monthlyRevenue > 500000) stage = 'enterprise';
  
  const digitalMaturity = Math.min(10, Math.max(1, 
    (costs.technologyCosts / costs.marketingBudget) * 10 || 3
  ));
  
  return {
    stage,
    digitalMaturity,
    salesTeamSize: Math.max(1, Math.floor(costs.salesTeamCost / 5000)),
    marketingBudget: costs.marketingBudget,
    techStack: digitalMaturity > 7 ? 'advanced' : digitalMaturity > 4 ? 'intermediate' : 'basic',
    industryType: industry,
    targetMarket: industry.toLowerCase().includes('b2b') ? 'b2b' : 'b2c'
  };
}

function calculateFuzzyScore(
  opportunity: OpportunityCost,
  maturity: CompanyMaturity,
  kpis: CurrentKPIs,
  costs: CurrentCosts
): number {
  let score = 0;
  
  // Base ROI score (40%)
  score += Math.min(40, opportunity.estimatedROI / 10);
  
  // Maturity alignment (30%)
  const maturityAlignment = getMaturityAlignment(opportunity.activityKey, maturity);
  score += maturityAlignment * 30;
  
  // Resource availability (20%)
  const resourceScore = Math.min(1, costs.marketingBudget / opportunity.implementationCost) * 20;
  score += resourceScore;
  
  // Strategic fit (10%)
  const strategicFit = getStrategicFit(opportunity.activityKey, kpis, maturity);
  score += strategicFit * 10;
  
  return Math.min(100, Math.max(0, score));
}

function calculateConfidence(
  opportunity: OpportunityCost,
  maturity: CompanyMaturity,
  industry: string
): number {
  let confidence = 70; // Base confidence
  
  // Industry alignment
  if (getIndustryMultiplier(industry, opportunity.activityKey) > 1.2) {
    confidence += 15;
  }
  
  // Risk level
  if (opportunity.riskLevel === 'low') confidence += 10;
  if (opportunity.riskLevel === 'high') confidence -= 10;
  
  // Company maturity alignment
  if (getMaturityAlignment(opportunity.activityKey, maturity) > 0.8) {
    confidence += 10;
  }
  
  return Math.min(100, Math.max(30, confidence));
}

function generateFuzzyReasoning(
  opportunity: OpportunityCost | { activityKey: keyof SalesActivities; activity: string },
  maturity: CompanyMaturity,
  kpis: CurrentKPIs,
  costs: CurrentCosts
): string[] {
  const reasoning = [];
  const activityKey = opportunity.activityKey;
  
  // ROI-based reasoning
  if ('estimatedROI' in opportunity && opportunity.estimatedROI > 300) {
    reasoning.push(`Exceptional ROI potential of ${opportunity.estimatedROI}%`);
  }
  
  // Industry and maturity-based reasoning
  const ltvCacRatio = kpis.customerLifetimeValue > 0 && kpis.customerAcquisitionCost > 0 
    ? kpis.customerLifetimeValue / kpis.customerAcquisitionCost 
    : 0;
    
  // Startup-specific recommendations
  if (maturity.stage === 'startup') {
    if (['personalBrand', 'socialSelling', 'contentMarketing'].includes(activityKey)) {
      reasoning.push("Critical for startup visibility and credibility");
    }
    if (kpis.customerAcquisitionCost > 200 && ['seoContent', 'contentMarketing', 'referralProgram'].includes(activityKey)) {
      reasoning.push("Essential for reducing high customer acquisition costs");
    }
  }
  
  // Growth stage recommendations
  if (maturity.stage === 'growth') {
    if (['paidAds', 'partnerships', 'webinarsEvents'].includes(activityKey)) {
      reasoning.push("Ideal for scaling growth-stage companies");
    }
  }
  
  // Digital maturity considerations
  if (maturity.digitalMaturity < 5) {
    if (['seoContent', 'transactionalEmails', 'retargeting'].includes(activityKey)) {
      reasoning.push("Will significantly improve digital presence and automation");
    }
  }
  
  // Budget and resource considerations
  if ('implementationCost' in opportunity && costs.marketingBudget > opportunity.implementationCost * 2) {
    reasoning.push("Well within current budget capacity");
  }
  
  // Performance gap analysis
  if (kpis.conversionRate < 3 && ['personalizedFollowUp', 'videoCalls', 'transactionalEmails'].includes(activityKey)) {
    reasoning.push("Addresses low conversion rate through better lead nurturing");
  }
  
  if (ltvCacRatio < 3 && ['referralProgram', 'contentMarketing', 'personalBrand'].includes(activityKey)) {
    reasoning.push("Improves unit economics by reducing acquisition costs");
  }
  
  // Quick implementation benefits
  if ('timeToImplement' in opportunity && opportunity.timeToImplement <= 2) {
    reasoning.push("Quick wins with fast implementation");
  }
  
  // Industry-specific reasoning
  if (['technology', 'software'].some(ind => maturity.industryType.toLowerCase().includes(ind))) {
    if (['contentMarketing', 'seoContent', 'personalBrand'].includes(activityKey)) {
      reasoning.push("Highly effective for technology companies");
    }
  }
  
  return reasoning.length > 0 ? reasoning : ["Strategic alignment with business goals"];
}

function generateImplementationPlan(
  opportunity: OpportunityCost | { activityKey: keyof SalesActivities; activity: string; timeToImplement?: number; estimatedROI?: number },
  maturity: CompanyMaturity,
  phase: number
): FuzzyLogicRecommendation['implementationPlan'] {
  const timeframes = {
    1: "Immediate (1-2 months)",
    2: "Short-term (2-4 months)", 
    3: "Medium-term (4-8 months)",
    4: "Long-term (8-12 months)"
  };
  
  const timeToImplement = 'timeToImplement' in opportunity ? opportunity.timeToImplement || 2 : 2;
  const estimatedROI = 'estimatedROI' in opportunity ? opportunity.estimatedROI || 150 : 150;
  const resources = getRequiredResources(opportunity.activityKey, maturity);
  
  return {
    phase,
    timeframe: timeframes[Math.min(4, timeToImplement) as keyof typeof timeframes],
    resources,
    expectedROI: estimatedROI
  };
}

function getPrerequisites(
  activity: keyof SalesActivities,
  currentActivities: SalesActivities,
  maturity: CompanyMaturity
): string[] {
  const prerequisites: Record<keyof SalesActivities, string[]> = {
    coldCalls: ["Sales team training", "CRM system"],
    personalizedFollowUp: ["Customer data collection", "CRM integration"],
    videoCalls: ["Video conferencing tools", "Sales presentation materials"],
    transactionalEmails: ["Email marketing platform", "Customer segmentation"],
    socialSelling: ["LinkedIn Sales Navigator", "Social media training"],
    contentMarketing: ["Content strategy", "Content creation resources"],
    referralProgram: ["Customer satisfaction baseline", "Referral tracking system"],
    webinarsEvents: ["Webinar platform", "Event planning resources"],
    paidAds: ["Ad account setup", "Landing page optimization"],
    seoContent: ["SEO audit", "Content management system"],
    partnerships: ["Partnership strategy", "Legal framework"],
    directMail: ["Mailing list", "Design and printing resources"],
    tradeShows: ["Event selection", "Booth design and materials"],
    influencerMarketing: ["Influencer research", "Campaign management tools"],
    retargeting: ["Website pixel installation", "Ad creative development"],
    activations: ["Event planning team", "Brand experience design"],
    physicalVisits: ["Sales territory planning", "Travel budget"],
    personalBrand: ["Personal branding strategy", "Content calendar"]
  };
  
  return prerequisites[activity] || [];
}

function getRisks(
  activity: keyof SalesActivities,
  maturity: CompanyMaturity,
  industry: string
): string[] {
  const commonRisks: Record<keyof SalesActivities, string[]> = {
    coldCalls: ["Low response rates", "Regulatory compliance"],
    personalizedFollowUp: ["Resource intensive", "Data privacy concerns"],
    videoCalls: ["Technology barriers", "Scheduling challenges"],
    transactionalEmails: ["Spam filters", "Email deliverability"],
    socialSelling: ["Platform algorithm changes", "Time investment"],
    contentMarketing: ["Long ROI timeline", "Content quality consistency"],
    referralProgram: ["Customer participation rates", "Program management complexity"],
    webinarsEvents: ["Technical difficulties", "Audience engagement"],
    paidAds: ["Budget burn rate", "Ad platform changes"],
    seoContent: ["Algorithm updates", "Competitive landscape"],
    partnerships: ["Partner reliability", "Revenue sharing complexity"],
    directMail: ["Response rate decline", "Environmental concerns"],
    tradeShows: ["High upfront costs", "Event cancellation risks"],
    influencerMarketing: ["Influencer reputation risks", "ROI measurement challenges"],
    retargeting: ["Privacy regulations", "Ad fatigue"],
    activations: ["High execution complexity", "Weather/location dependencies"],
    physicalVisits: ["Travel restrictions", "Scalability limitations"],
    personalBrand: ["Time to build credibility", "Personal reputation risks"]
  };
  
  return commonRisks[activity] || [];
}

function getMaturityAlignment(activity: keyof SalesActivities, maturity: CompanyMaturity): number {
  const alignmentMatrix: Record<CompanyMaturity['stage'], Partial<Record<keyof SalesActivities, number>>> = {
    startup: {
      personalBrand: 0.9,
      socialSelling: 0.8,
      contentMarketing: 0.7,
      coldCalls: 0.8,
      videoCalls: 0.9
    },
    growth: {
      paidAds: 0.9,
      seoContent: 0.8,
      referralProgram: 0.8,
      webinarsEvents: 0.7,
      partnerships: 0.6
    },
    mature: {
      tradeShows: 0.8,
      activations: 0.7,
      partnerships: 0.9,
      influencerMarketing: 0.7,
      retargeting: 0.8
    },
    enterprise: {
      activations: 0.9,
      tradeShows: 0.9,
      partnerships: 0.9,
      physicalVisits: 0.8,
      directMail: 0.7
    }
  };
  
  return alignmentMatrix[maturity.stage]?.[activity] || 0.5;
}

function getStrategicFit(activity: keyof SalesActivities, kpis: CurrentKPIs, maturity: CompanyMaturity): number {
  let fit = 0.5; // Base fit
  
  // Adjust based on current performance gaps
  if (kpis.conversionRate < 2 && ['personalizedFollowUp', 'videoCalls', 'retargeting'].includes(activity)) {
    fit += 0.3;
  }
  
  if (kpis.monthlyLeads < 50 && ['paidAds', 'seoContent', 'contentMarketing'].includes(activity)) {
    fit += 0.3;
  }
  
  if (kpis.customerLifetimeValue < 1000 && ['referralProgram', 'personalBrand', 'partnerships'].includes(activity)) {
    fit += 0.2;
  }
  
  return Math.min(1, fit);
}

function getRequiredResources(activity: keyof SalesActivities, maturity: CompanyMaturity): string[] {
  const resourceMap: Record<keyof SalesActivities, string[]> = {
    coldCalls: ["Sales team", "CRM system", "Phone system"],
    personalizedFollowUp: ["Marketing automation", "Data analyst", "CRM"],
    videoCalls: ["Video platform", "Sales team", "Presentation materials"],
    transactionalEmails: ["Email platform", "Designer", "Copywriter"],
    socialSelling: ["LinkedIn licenses", "Sales training", "Social media manager"],
    contentMarketing: ["Content team", "SEO tools", "Design resources"],
    referralProgram: ["Program manager", "Tracking system", "Incentive budget"],
    webinarsEvents: ["Event platform", "Marketing team", "Technical support"],
    paidAds: ["Ad budget", "PPC specialist", "Landing pages"],
    seoContent: ["SEO specialist", "Content writers", "Technical developer"],
    partnerships: ["Business development", "Legal support", "Partnership manager"],
    directMail: ["Design team", "Printing budget", "Mailing lists"],
    tradeShows: ["Event budget", "Booth materials", "Sales team"],
    influencerMarketing: ["Influencer budget", "Campaign manager", "Content approval"],
    retargeting: ["Ad budget", "Creative team", "Analytics setup"],
    activations: ["Event team", "Experience design", "Logistics coordinator"],
    physicalVisits: ["Sales team", "Travel budget", "Territory planning"],
    personalBrand: ["Personal time", "Content creator", "Social media management"]
  };
  
  return resourceMap[activity] || [];
}

// Tool Requirements and Cost Validation
export interface ToolRequirement {
  toolKey: keyof LeadAnalysisFormData['sales_process']['availableTools'];
  name: string;
  setupCost: number;
  monthlyCost: number;
  isRequired: boolean;
}

export interface ValidationResult {
  missingTools: ToolRequirement[];
  totalSetupCost: number;
  totalMonthlyCost: number;
  hasAllRequiredTools: boolean;
}

function getRequiredToolsForActivity(activity: keyof SalesActivities): ToolRequirement[] {
  const toolRequirements: Record<keyof SalesActivities, ToolRequirement[]> = {
    coldCalls: [
      { toolKey: 'crmSystem', name: 'CRM System', setupCost: 2000, monthlyCost: 150, isRequired: true },
      { toolKey: 'phoneSystem', name: 'Phone System', setupCost: 500, monthlyCost: 80, isRequired: true },
      { toolKey: 'salesAutomation', name: 'Sales Automation', setupCost: 1000, monthlyCost: 100, isRequired: false }
    ],
    personalizedFollowUp: [
      { toolKey: 'crmSystem', name: 'CRM System', setupCost: 2000, monthlyCost: 150, isRequired: true },
      { toolKey: 'marketingAutomation', name: 'Marketing Automation', setupCost: 3000, monthlyCost: 200, isRequired: true },
      { toolKey: 'emailMarketing', name: 'Email Marketing Platform', setupCost: 500, monthlyCost: 50, isRequired: true }
    ],
    videoCalls: [
      { toolKey: 'videoConferencing', name: 'Video Conferencing', setupCost: 200, monthlyCost: 30, isRequired: true },
      { toolKey: 'crmSystem', name: 'CRM System', setupCost: 2000, monthlyCost: 150, isRequired: true }
    ],
    transactionalEmails: [
      { toolKey: 'emailMarketing', name: 'Email Marketing Platform', setupCost: 500, monthlyCost: 50, isRequired: true },
      { toolKey: 'designSoftware', name: 'Design Software', setupCost: 600, monthlyCost: 50, isRequired: false }
    ],
    socialSelling: [
      { toolKey: 'socialMediaTools', name: 'Social Media Management', setupCost: 800, monthlyCost: 80, isRequired: true },
      { toolKey: 'crmSystem', name: 'CRM System', setupCost: 2000, monthlyCost: 150, isRequired: true },
      { toolKey: 'linkedinAds', name: 'LinkedIn Sales Navigator', setupCost: 0, monthlyCost: 80, isRequired: false }
    ],
    contentMarketing: [
      { toolKey: 'contentManagement', name: 'Content Management System', setupCost: 1500, monthlyCost: 100, isRequired: true },
      { toolKey: 'seoTools', name: 'SEO Tools', setupCost: 300, monthlyCost: 100, isRequired: true },
      { toolKey: 'designSoftware', name: 'Design Software', setupCost: 600, monthlyCost: 50, isRequired: false }
    ],
    referralProgram: [
      { toolKey: 'crmSystem', name: 'CRM System', setupCost: 2000, monthlyCost: 150, isRequired: true },
      { toolKey: 'marketingAutomation', name: 'Marketing Automation', setupCost: 3000, monthlyCost: 200, isRequired: true },
      { toolKey: 'conversionTracking', name: 'Conversion Tracking', setupCost: 200, monthlyCost: 20, isRequired: true }
    ],
    webinarsEvents: [
      { toolKey: 'videoConferencing', name: 'Webinar Platform', setupCost: 1000, monthlyCost: 150, isRequired: true },
      { toolKey: 'emailMarketing', name: 'Email Marketing Platform', setupCost: 500, monthlyCost: 50, isRequired: true },
      { toolKey: 'crmSystem', name: 'CRM System', setupCost: 2000, monthlyCost: 150, isRequired: true }
    ],
    paidAds: [
      { toolKey: 'googleAds', name: 'Google Ads Account', setupCost: 0, monthlyCost: 0, isRequired: true },
      { toolKey: 'facebookAds', name: 'Facebook Ads Manager', setupCost: 0, monthlyCost: 0, isRequired: false },
      { toolKey: 'conversionTracking', name: 'Conversion Tracking', setupCost: 200, monthlyCost: 20, isRequired: true },
      { toolKey: 'webAnalytics', name: 'Web Analytics', setupCost: 0, monthlyCost: 0, isRequired: true }
    ],
    seoContent: [
      { toolKey: 'seoTools', name: 'SEO Tools', setupCost: 300, monthlyCost: 100, isRequired: true },
      { toolKey: 'contentManagement', name: 'Content Management System', setupCost: 1500, monthlyCost: 100, isRequired: true },
      { toolKey: 'webAnalytics', name: 'Web Analytics', setupCost: 0, monthlyCost: 0, isRequired: true }
    ],
    partnerships: [
      { toolKey: 'crmSystem', name: 'CRM System', setupCost: 2000, monthlyCost: 150, isRequired: true },
      { toolKey: 'documentManagement', name: 'Document Management', setupCost: 500, monthlyCost: 30, isRequired: true },
      { toolKey: 'projectManagement', name: 'Project Management', setupCost: 300, monthlyCost: 50, isRequired: false }
    ],
    directMail: [
      { toolKey: 'designSoftware', name: 'Design Software', setupCost: 600, monthlyCost: 50, isRequired: true },
      { toolKey: 'crmSystem', name: 'CRM System', setupCost: 2000, monthlyCost: 150, isRequired: true },
      { toolKey: 'conversionTracking', name: 'Conversion Tracking', setupCost: 200, monthlyCost: 20, isRequired: true }
    ],
    tradeShows: [
      { toolKey: 'crmSystem', name: 'CRM System', setupCost: 2000, monthlyCost: 150, isRequired: true },
      { toolKey: 'leadScoringTool', name: 'Lead Scoring Tool', setupCost: 1000, monthlyCost: 100, isRequired: false },
      { toolKey: 'projectManagement', name: 'Project Management', setupCost: 300, monthlyCost: 50, isRequired: false }
    ],
    influencerMarketing: [
      { toolKey: 'socialMediaTools', name: 'Social Media Management', setupCost: 800, monthlyCost: 80, isRequired: true },
      { toolKey: 'conversionTracking', name: 'Conversion Tracking', setupCost: 200, monthlyCost: 20, isRequired: true },
      { toolKey: 'crmSystem', name: 'CRM System', setupCost: 2000, monthlyCost: 150, isRequired: false }
    ],
    retargeting: [
      { toolKey: 'retargetingPixels', name: 'Retargeting Pixels', setupCost: 100, monthlyCost: 10, isRequired: true },
      { toolKey: 'googleAds', name: 'Google Ads', setupCost: 0, monthlyCost: 0, isRequired: true },
      { toolKey: 'facebookAds', name: 'Facebook Ads', setupCost: 0, monthlyCost: 0, isRequired: true },
      { toolKey: 'designSoftware', name: 'Design Software', setupCost: 600, monthlyCost: 50, isRequired: false }
    ],
    activations: [
      { toolKey: 'projectManagement', name: 'Project Management', setupCost: 300, monthlyCost: 50, isRequired: true },
      { toolKey: 'crmSystem', name: 'CRM System', setupCost: 2000, monthlyCost: 150, isRequired: true },
      { toolKey: 'conversionTracking', name: 'Conversion Tracking', setupCost: 200, monthlyCost: 20, isRequired: true }
    ],
    physicalVisits: [
      { toolKey: 'crmSystem', name: 'CRM System', setupCost: 2000, monthlyCost: 150, isRequired: true },
      { toolKey: 'timeTracking', name: 'Time Tracking', setupCost: 200, monthlyCost: 20, isRequired: false },
      { toolKey: 'projectManagement', name: 'Project Management', setupCost: 300, monthlyCost: 50, isRequired: false }
    ],
    personalBrand: [
      { toolKey: 'socialMediaTools', name: 'Social Media Management', setupCost: 800, monthlyCost: 80, isRequired: true },
      { toolKey: 'contentManagement', name: 'Content Management System', setupCost: 1500, monthlyCost: 100, isRequired: false },
      { toolKey: 'designSoftware', name: 'Design Software', setupCost: 600, monthlyCost: 50, isRequired: false }
    ]
  };
  
  return toolRequirements[activity] || [];
}

export function validateToolRequirements(
  activity: keyof SalesActivities, 
  availableTools: LeadAnalysisFormData['sales_process']['availableTools']
): ValidationResult {
  const requiredTools = getRequiredToolsForActivity(activity);
  const missingTools: ToolRequirement[] = [];
  
  let totalSetupCost = 0;
  let totalMonthlyCost = 0;
  let hasAllRequiredTools = true;
  
  requiredTools.forEach(tool => {
    const hasThisTool = availableTools[tool.toolKey];
    
    if (!hasThisTool) {
      missingTools.push(tool);
      totalSetupCost += tool.setupCost;
      totalMonthlyCost += tool.monthlyCost;
      
      if (tool.isRequired) {
        hasAllRequiredTools = false;
      }
    }
  });
  
  return {
    missingTools,
    totalSetupCost,
    totalMonthlyCost,
    hasAllRequiredTools
  };
}

// Next Steps Plan Generation
export interface NextStepsTask {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'foundation' | 'activation' | 'optimization' | 'scaling';
  estimatedTime: string;
  dependencies: string[];
  marketFitAlignment: number; // 1-10 scale
  roiImpact: number; // Expected ROI impact percentage
  actionUrl?: string;
  resources: string[];
  reasoning: string;
}

export interface NextStepsPlan {
  companyProfile: {
    stage: CompanyMaturity['stage'];
    digitalMaturity: number;
    marketFitScore: number;
    readinessLevel: 'beginner' | 'intermediate' | 'advanced';
  };
  immediateActions: NextStepsTask[];
  shortTermGoals: NextStepsTask[];
  longTermStrategy: NextStepsTask[];
  totalEstimatedTime: string;
  expectedROIIncrease: number;
  criticalPath: string[];
}

export function generateNextStepsPlan(
  currentActivities: SalesActivities,
  kpis: CurrentKPIs,
  costs: CurrentCosts,
  industry: string,
  companySize: string,
  fuzzyRecommendations: FuzzyLogicRecommendation[],
  opportunityCosts: OpportunityCost[],
  availableTools?: any
): NextStepsPlan {
  const companyMaturity = assessCompanyMaturity(kpis, costs, companySize, industry);
  const marketFitScore = calculateMarketFitScore(kpis, costs, industry, companySize);
  
  // Determine readiness level
  const readinessLevel = getReadinessLevel(companyMaturity, marketFitScore, currentActivities);
  
  // Generate foundation tasks (onboarding-based)
  const foundationTasks = generateFoundationTasks(companyMaturity, readinessLevel, currentActivities, availableTools);
  
  // Generate activation tasks (ROI-based)
  const activationTasks = generateActivationTasks(fuzzyRecommendations, opportunityCosts, companyMaturity);
  
  // Generate optimization tasks
  const optimizationTasks = generateOptimizationTasks(kpis, costs, industry, companyMaturity);
  
  // Generate scaling tasks
  const scalingTasks = generateScalingTasks(companyMaturity, marketFitScore, industry);
  
  // Categorize by timeline
  const allTasks = [...foundationTasks, ...activationTasks, ...optimizationTasks, ...scalingTasks];
  
  // Ensure balanced distribution across timeframes
  const immediateActions = allTasks.filter(t => t.priority === 'critical' || t.category === 'foundation').slice(0, 3);
  
  // For short-term goals, include high priority tasks not in immediate actions, 
  // and if not enough, include some activation tasks with medium priority
  let shortTermGoals = allTasks.filter(t => t.priority === 'high' && !immediateActions.includes(t));
  if (shortTermGoals.length < 2) {
    const additionalTasks = allTasks.filter(t => 
      t.category === 'activation' && 
      t.priority === 'medium' && 
      !immediateActions.includes(t) && 
      !shortTermGoals.includes(t)
    );
    shortTermGoals = [...shortTermGoals, ...additionalTasks];
  }
  shortTermGoals = shortTermGoals.slice(0, 5);
  
  const longTermStrategy = allTasks.filter(t => 
    ['medium', 'low'].includes(t.priority) && 
    t.category !== 'foundation' && 
    !immediateActions.includes(t) && 
    !shortTermGoals.includes(t)
  ).slice(0, 4);
  
  // Calculate metrics
  const totalTime = calculateTotalTime(allTasks);
  const expectedROI = calculateExpectedROIIncrease(activationTasks, opportunityCosts);
  const criticalPath = generateCriticalPath(immediateActions, shortTermGoals);
  
  return {
    companyProfile: {
      stage: companyMaturity.stage,
      digitalMaturity: companyMaturity.digitalMaturity,
      marketFitScore,
      readinessLevel
    },
    immediateActions,
    shortTermGoals,
    longTermStrategy,
    totalEstimatedTime: totalTime,
    expectedROIIncrease: expectedROI,
    criticalPath
  };
}

function calculateMarketFitScore(
  kpis: CurrentKPIs,
  costs: CurrentCosts,
  industry: string,
  companySize: string
): number {
  let score = 5; // Base score
  
  // Revenue health (25% weight)
  if (kpis.monthlyRevenue > 0) {
    const revenueScore = Math.min(10, (kpis.monthlyRevenue / 50000) * 5 + 5);
    score += (revenueScore - 5) * 0.25;
  }
  
  // Customer metrics (25% weight)
  if (kpis.customerLifetimeValue > kpis.customerAcquisitionCost * 3) {
    score += 1.25; // Good LTV:CAC ratio
  }
  
  // Conversion efficiency (25% weight)
  if (kpis.conversionRate > 2) {
    score += (Math.min(kpis.conversionRate, 10) / 10) * 2.5;
  }
  
  // Growth indicators (25% weight)
  if (kpis.monthlyLeads > 50) {
    score += (Math.min(kpis.monthlyLeads, 500) / 500) * 2.5;
  }
  
  return Math.min(10, Math.max(1, score));
}

function getReadinessLevel(
  maturity: CompanyMaturity,
  marketFitScore: number,
  currentActivities: SalesActivities
): 'beginner' | 'intermediate' | 'advanced' {
  const activeActivitiesCount = Object.values(currentActivities).filter(Boolean).length;
  
  if (maturity.stage === 'startup' && marketFitScore < 5 && activeActivitiesCount < 3) {
    return 'beginner';
  }
  
  if (maturity.stage === 'enterprise' || marketFitScore > 7 || activeActivitiesCount > 8) {
    return 'advanced';
  }
  
  return 'intermediate';
}

function generateFoundationTasks(
  maturity: CompanyMaturity,
  readinessLevel: 'beginner' | 'intermediate' | 'advanced',
  currentActivities: SalesActivities,
  availableTools?: any
): NextStepsTask[] {
  const tasks: NextStepsTask[] = [];
  
  // Critical foundation tasks based on onboarding
  if (readinessLevel === 'beginner') {
    // Only suggest website tracking if they don't have web analytics
    if (!availableTools?.webAnalytics) {
      tasks.push({
        id: 'setup_tracking',
        title: 'Install Website Tracking',
        description: 'Set up analytics and visitor tracking to understand your audience behavior',
        priority: 'critical',
        category: 'foundation',
        estimatedTime: '15 min',
        dependencies: [],
        marketFitAlignment: 9,
        roiImpact: 25,
        actionUrl: '/settings?tab=channels',
        resources: ['Developer', 'Analytics tools'],
        reasoning: 'Essential for data-driven decisions and lead capture'
      });
    }
    
    // Only suggest communication channels if they don't have email marketing or WhatsApp
    if (!availableTools?.emailMarketing && !availableTools?.whatsappBusiness) {
      tasks.push({
        id: 'configure_channels',
        title: 'Connect Communication Channels',
        description: 'Set up email or WhatsApp to automatically engage with leads',
        priority: 'critical',
        category: 'foundation',
        estimatedTime: '20 min',
        dependencies: availableTools?.webAnalytics ? [] : ['setup_tracking'],
        marketFitAlignment: 8,
        roiImpact: 40,
        actionUrl: '/settings?tab=channels',
        resources: ['Marketing team', 'Email platform'],
        reasoning: 'Direct communication with leads is fundamental for conversion'
      });
    } else if (availableTools?.emailMarketing || availableTools?.whatsappBusiness) {
      // If they have tools but are beginners, suggest optimization
      tasks.push({
        id: 'optimize_communication',
        title: 'Optimize Communication Strategy',
        description: 'Improve your existing email/WhatsApp campaigns for better engagement',
        priority: 'high',
        category: 'optimization',
        estimatedTime: '1 week',
        dependencies: [],
        marketFitAlignment: 7,
        roiImpact: 30,
        resources: ['Marketing team', 'Content creation', 'A/B testing'],
        reasoning: 'Maximize ROI from your existing communication tools'
      });
    }
  }
  
  // Only suggest CRM implementation if they don't already have one
  if (maturity.digitalMaturity < 5 && !availableTools?.crmSystem) {
    tasks.push({
      id: 'setup_crm',
      title: 'Implement CRM System',
      description: 'Organize and track your leads and customer interactions',
      priority: 'high',
      category: 'foundation',
      estimatedTime: '2 hours',
      dependencies: ['configure_channels'],
      marketFitAlignment: 7,
      roiImpact: 30,
      resources: ['Sales team', 'CRM platform', 'Data entry'],
      reasoning: 'Essential for scaling sales operations and tracking performance'
    });
  } else if (availableTools?.crmSystem && maturity.digitalMaturity < 7) {
    // If they have CRM but low digital maturity, suggest optimization
    tasks.push({
      id: 'optimize_crm',
      title: 'Optimize CRM Usage',
      description: 'Improve your CRM setup and team adoption for better results',
      priority: 'medium',
      category: 'optimization',
      estimatedTime: '1 week',
      dependencies: ['configure_channels'],
      marketFitAlignment: 8,
      roiImpact: 25,
      resources: ['Sales team', 'CRM training', 'Process documentation'],
      reasoning: 'Maximize ROI from your existing CRM investment'
    });
  }
  
  return tasks;
}

function generateActivationTasks(
  fuzzyRecommendations: FuzzyLogicRecommendation[],
  opportunityCosts: OpportunityCost[],
  maturity: CompanyMaturity
): NextStepsTask[] {
  const tasks: NextStepsTask[] = [];
  
  // Convert top fuzzy recommendations to tasks
  fuzzyRecommendations.slice(0, 3).forEach((rec, index) => {
    const opportunity = opportunityCosts.find(opp => opp.activityKey === rec.activityKey);
    
    tasks.push({
      id: `implement_${rec.activityKey}`,
      title: `Implement ${rec.activity}`,
      description: rec.reasoning.join('. '),
      priority: rec.score > 80 ? 'critical' : rec.score > 60 ? 'high' : 'medium',
      category: 'activation',
      estimatedTime: rec.implementationPlan.timeframe,
      dependencies: rec.prerequisites,
      marketFitAlignment: Math.round(rec.confidence / 10),
      roiImpact: rec.implementationPlan.expectedROI,
      resources: rec.implementationPlan.resources,
      reasoning: `AI Score: ${rec.score}/100. ${rec.reasoning[0] || 'High-impact opportunity'}`
    });
  });
  
  return tasks;
}

function generateOptimizationTasks(
  kpis: CurrentKPIs,
  costs: CurrentCosts,
  industry: string,
  maturity: CompanyMaturity
): NextStepsTask[] {
  const tasks: NextStepsTask[] = [];
  
  // Conversion optimization
  if (kpis.conversionRate < 3) {
    tasks.push({
      id: 'optimize_conversion',
      title: 'Optimize Conversion Funnel',
      description: 'Analyze and improve your lead-to-customer conversion process',
      priority: 'high',
      category: 'optimization',
      estimatedTime: '1 week',
      dependencies: ['setup_tracking'],
      marketFitAlignment: 8,
      roiImpact: 50,
      resources: ['Marketing analyst', 'A/B testing tools', 'UX designer'],
      reasoning: `Current conversion rate (${kpis.conversionRate}%) is below industry average`
    });
  }
  
  // Cost optimization
  if (kpis.customerAcquisitionCost > kpis.customerLifetimeValue * 0.3) {
    tasks.push({
      id: 'reduce_cac',
      title: 'Reduce Customer Acquisition Cost',
      description: 'Optimize marketing spend and improve cost efficiency',
      priority: 'medium',
      category: 'optimization',
      estimatedTime: '2 weeks',
      dependencies: ['setup_crm'],
      marketFitAlignment: 7,
      roiImpact: 35,
      resources: ['Marketing manager', 'Analytics tools', 'Budget planning'],
      reasoning: 'CAC is too high relative to LTV, impacting profitability'
    });
  }
  
  return tasks;
}

function generateScalingTasks(
  maturity: CompanyMaturity,
  marketFitScore: number,
  industry: string
): NextStepsTask[] {
  const tasks: NextStepsTask[] = [];
  
  if (maturity.stage !== 'startup' && marketFitScore > 6) {
    tasks.push({
      id: 'scale_team',
      title: 'Scale Sales & Marketing Team',
      description: 'Hire additional team members to handle increased demand',
      priority: 'medium',
      category: 'scaling',
      estimatedTime: '1 month',
      dependencies: ['optimize_conversion'],
      marketFitAlignment: 6,
      roiImpact: 60,
      resources: ['HR team', 'Recruitment budget', 'Training materials'],
      reasoning: 'Strong market fit indicates readiness for team expansion'
    });
    
    tasks.push({
      id: 'automate_processes',
      title: 'Implement Marketing Automation',
      description: 'Set up automated workflows to scale without proportional cost increase',
      priority: 'low',
      category: 'scaling',
      estimatedTime: '3 weeks',
      dependencies: ['setup_crm'],
      marketFitAlignment: 7,
      roiImpact: 45,
      resources: ['Marketing automation platform', 'Technical setup', 'Content creation'],
      reasoning: 'Automation enables efficient scaling of marketing efforts'
    });
  }
  
  return tasks;
}

function calculateTotalTime(tasks: NextStepsTask[]): string {
  // Simple time calculation - in real implementation, would parse time strings properly
  const totalMinutes = tasks.length * 30; // Rough estimate
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours === 0) return `${minutes} minutes`;
  if (minutes === 0) return `${hours} hours`;
  return `${hours}h ${minutes}m`;
}

function calculateExpectedROIIncrease(
  activationTasks: NextStepsTask[],
  opportunityCosts: OpportunityCost[]
): number {
  return activationTasks.reduce((total, task) => total + task.roiImpact, 0) / activationTasks.length || 0;
}

function generateCriticalPath(
  immediateActions: NextStepsTask[],
  shortTermGoals: NextStepsTask[]
): string[] {
  const criticalTasks = [...immediateActions, ...shortTermGoals]
    .filter(task => task.priority === 'critical' || task.priority === 'high')
    .sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  
  return criticalTasks.slice(0, 5).map(task => task.id);
}
