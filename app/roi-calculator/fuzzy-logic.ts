// Advanced Fuzzy Logic System for ROI Calculator
// Implements Mamdani-type fuzzy inference system for more precise recommendations

export interface FuzzySet {
  name: string;
  membership: (value: number) => number;
  range: [number, number];
}

export interface FuzzyVariable {
  name: string;
  range: [number, number];
  sets: FuzzySet[];
}

export interface FuzzyRule {
  id: string;
  conditions: Array<{
    variable: string;
    set: string;
    weight?: number;
  }>;
  conclusion: {
    variable: string;
    set: string;
  };
  confidence: number;
  reasoning: string;
}

export interface FuzzyInferenceResult {
  outputValue: number;
  confidence: number;
  activatedRules: Array<{
    rule: FuzzyRule;
    strength: number;
  }>;
  reasoning: string[];
}

// Membership functions
export class MembershipFunctions {
  // Triangular membership function
  static triangular(a: number, b: number, c: number): (x: number) => number {
    return (x: number) => {
      if (x <= a || x >= c) return 0;
      if (x === b) return 1;
      if (x < b) return (x - a) / (b - a);
      return (c - x) / (c - b);
    };
  }

  // Trapezoidal membership function
  static trapezoidal(a: number, b: number, c: number, d: number): (x: number) => number {
    return (x: number) => {
      if (x <= a || x >= d) return 0;
      if (x >= b && x <= c) return 1;
      if (x < b) return (x - a) / (b - a);
      return (d - x) / (d - c);
    };
  }

  // Gaussian membership function
  static gaussian(center: number, sigma: number): (x: number) => number {
    return (x: number) => {
      return Math.exp(-0.5 * Math.pow((x - center) / sigma, 2));
    };
  }

  // S-shaped membership function
  static sigmoid(a: number, c: number): (x: number) => number {
    return (x: number) => {
      return 1 / (1 + Math.exp(-a * (x - c)));
    };
  }
}

// Define fuzzy variables for ROI analysis
export const FUZZY_VARIABLES: Record<string, FuzzyVariable> = {
  conversionRate: {
    name: 'Conversion Rate',
    range: [0, 20],
    sets: [
      {
        name: 'very_low',
        membership: MembershipFunctions.trapezoidal(0, 0, 1, 2),
        range: [0, 2]
      },
      {
        name: 'low',
        membership: MembershipFunctions.triangular(1, 2.5, 4),
        range: [1, 4]
      },
      {
        name: 'medium',
        membership: MembershipFunctions.triangular(3, 5, 7),
        range: [3, 7]
      },
      {
        name: 'high',
        membership: MembershipFunctions.triangular(6, 8, 10),
        range: [6, 10]
      },
      {
        name: 'very_high',
        membership: MembershipFunctions.trapezoidal(9, 12, 20, 20),
        range: [9, 20]
      }
    ]
  },

  customerAcquisitionCost: {
    name: 'Customer Acquisition Cost',
    range: [0, 2000],
    sets: [
      {
        name: 'very_low',
        membership: MembershipFunctions.trapezoidal(0, 0, 50, 100),
        range: [0, 100]
      },
      {
        name: 'low',
        membership: MembershipFunctions.triangular(75, 150, 250),
        range: [75, 250]
      },
      {
        name: 'medium',
        membership: MembershipFunctions.triangular(200, 400, 600),
        range: [200, 600]
      },
      {
        name: 'high',
        membership: MembershipFunctions.triangular(500, 800, 1200),
        range: [500, 1200]
      },
      {
        name: 'very_high',
        membership: MembershipFunctions.trapezoidal(1000, 1500, 2000, 2000),
        range: [1000, 2000]
      }
    ]
  },

  ltvCacRatio: {
    name: 'LTV:CAC Ratio',
    range: [0, 20],
    sets: [
      {
        name: 'critical',
        membership: MembershipFunctions.trapezoidal(0, 0, 1, 2),
        range: [0, 2]
      },
      {
        name: 'poor',
        membership: MembershipFunctions.triangular(1.5, 2.5, 3.5),
        range: [1.5, 3.5]
      },
      {
        name: 'acceptable',
        membership: MembershipFunctions.triangular(3, 4, 5),
        range: [3, 5]
      },
      {
        name: 'good',
        membership: MembershipFunctions.triangular(4.5, 6, 8),
        range: [4.5, 8]
      },
      {
        name: 'excellent',
        membership: MembershipFunctions.trapezoidal(7, 10, 20, 20),
        range: [7, 20]
      }
    ]
  },

  companyMaturity: {
    name: 'Company Maturity',
    range: [0, 10],
    sets: [
      {
        name: 'startup',
        membership: MembershipFunctions.trapezoidal(0, 0, 2, 4),
        range: [0, 4]
      },
      {
        name: 'growth',
        membership: MembershipFunctions.triangular(3, 5, 7),
        range: [3, 7]
      },
      {
        name: 'mature',
        membership: MembershipFunctions.triangular(6, 8, 10),
        range: [6, 10]
      },
      {
        name: 'enterprise',
        membership: MembershipFunctions.trapezoidal(8, 9, 10, 10),
        range: [8, 10]
      }
    ]
  },

  marketingEfficiency: {
    name: 'Marketing Efficiency',
    range: [0, 100],
    sets: [
      {
        name: 'very_poor',
        membership: MembershipFunctions.trapezoidal(0, 0, 10, 20),
        range: [0, 20]
      },
      {
        name: 'poor',
        membership: MembershipFunctions.triangular(15, 25, 35),
        range: [15, 35]
      },
      {
        name: 'average',
        membership: MembershipFunctions.triangular(30, 45, 60),
        range: [30, 60]
      },
      {
        name: 'good',
        membership: MembershipFunctions.triangular(55, 70, 85),
        range: [55, 85]
      },
      {
        name: 'excellent',
        membership: MembershipFunctions.trapezoidal(80, 90, 100, 100),
        range: [80, 100]
      }
    ]
  },

  recommendationScore: {
    name: 'Recommendation Score',
    range: [0, 100],
    sets: [
      {
        name: 'not_recommended',
        membership: MembershipFunctions.trapezoidal(0, 0, 15, 25),
        range: [0, 25]
      },
      {
        name: 'low_priority',
        membership: MembershipFunctions.triangular(20, 35, 50),
        range: [20, 50]
      },
      {
        name: 'medium_priority',
        membership: MembershipFunctions.triangular(45, 60, 75),
        range: [45, 75]
      },
      {
        name: 'high_priority',
        membership: MembershipFunctions.triangular(70, 85, 95),
        range: [70, 95]
      },
      {
        name: 'critical_priority',
        membership: MembershipFunctions.trapezoidal(90, 95, 100, 100),
        range: [90, 100]
      }
    ]
  }
};

// Fuzzy rules for different marketing activities
export const FUZZY_RULES: FuzzyRule[] = [
  // Content Marketing Rules
  {
    id: 'content_marketing_high_ltv',
    conditions: [
      { variable: 'ltvCacRatio', set: 'good', weight: 0.8 },
      { variable: 'companyMaturity', set: 'growth', weight: 0.6 },
      { variable: 'conversionRate', set: 'medium', weight: 0.4 }
    ],
    conclusion: { variable: 'recommendationScore', set: 'high_priority' },
    confidence: 0.85,
    reasoning: 'Content marketing works well for companies with good LTV:CAC ratios and growing maturity'
  },

  {
    id: 'content_marketing_startup',
    conditions: [
      { variable: 'companyMaturity', set: 'startup', weight: 0.9 },
      { variable: 'customerAcquisitionCost', set: 'high', weight: 0.7 }
    ],
    conclusion: { variable: 'recommendationScore', set: 'critical_priority' },
    confidence: 0.9,
    reasoning: 'Startups with high CAC need content marketing for organic lead generation'
  },

  // Paid Advertising Rules
  {
    id: 'paid_ads_high_conversion',
    conditions: [
      { variable: 'conversionRate', set: 'high', weight: 0.8 },
      { variable: 'ltvCacRatio', set: 'good', weight: 0.7 },
      { variable: 'marketingEfficiency', set: 'good', weight: 0.5 }
    ],
    conclusion: { variable: 'recommendationScore', set: 'high_priority' },
    confidence: 0.8,
    reasoning: 'High conversion rates and good LTV:CAC ratios make paid ads profitable'
  },

  {
    id: 'paid_ads_poor_conversion',
    conditions: [
      { variable: 'conversionRate', set: 'low', weight: 0.8 },
      { variable: 'customerAcquisitionCost', set: 'high', weight: 0.6 }
    ],
    conclusion: { variable: 'recommendationScore', set: 'not_recommended' },
    confidence: 0.85,
    reasoning: 'Low conversion rates and high CAC make paid ads ineffective'
  },

  // Personal Brand Rules
  {
    id: 'personal_brand_startup',
    conditions: [
      { variable: 'companyMaturity', set: 'startup', weight: 0.9 },
      { variable: 'customerAcquisitionCost', set: 'high', weight: 0.6 }
    ],
    conclusion: { variable: 'recommendationScore', set: 'critical_priority' },
    confidence: 0.9,
    reasoning: 'Personal branding is crucial for startups to build trust and reduce CAC'
  },

  {
    id: 'personal_brand_mature',
    conditions: [
      { variable: 'companyMaturity', set: 'mature', weight: 0.7 },
      { variable: 'marketingEfficiency', set: 'average', weight: 0.5 }
    ],
    conclusion: { variable: 'recommendationScore', set: 'medium_priority' },
    confidence: 0.6,
    reasoning: 'Mature companies can benefit from personal branding but it\'s not critical'
  },

  // SEO Content Rules
  {
    id: 'seo_long_term',
    conditions: [
      { variable: 'ltvCacRatio', set: 'good', weight: 0.8 },
      { variable: 'companyMaturity', set: 'growth', weight: 0.6 }
    ],
    conclusion: { variable: 'recommendationScore', set: 'high_priority' },
    confidence: 0.8,
    reasoning: 'SEO provides long-term value for companies with good unit economics'
  },

  // Referral Program Rules
  {
    id: 'referral_high_satisfaction',
    conditions: [
      { variable: 'ltvCacRatio', set: 'excellent', weight: 0.9 },
      { variable: 'conversionRate', set: 'high', weight: 0.6 }
    ],
    conclusion: { variable: 'recommendationScore', set: 'high_priority' },
    confidence: 0.85,
    reasoning: 'High LTV and conversion rates indicate satisfied customers who will refer others'
  },

  // Social Selling Rules
  {
    id: 'social_selling_b2b',
    conditions: [
      { variable: 'customerAcquisitionCost', set: 'medium', weight: 0.7 },
      { variable: 'companyMaturity', set: 'growth', weight: 0.6 }
    ],
    conclusion: { variable: 'recommendationScore', set: 'medium_priority' },
    confidence: 0.7,
    reasoning: 'Social selling works well for B2B companies with moderate CAC'
  },

  // Email Marketing Rules
  {
    id: 'email_marketing_nurturing',
    conditions: [
      { variable: 'conversionRate', set: 'low', weight: 0.8 },
      { variable: 'ltvCacRatio', set: 'acceptable', weight: 0.6 }
    ],
    conclusion: { variable: 'recommendationScore', set: 'high_priority' },
    confidence: 0.8,
    reasoning: 'Email marketing helps nurture leads and improve conversion rates'
  }
];

// Fuzzy Inference Engine
export class FuzzyInferenceEngine {
  private variables: Record<string, FuzzyVariable>;
  private rules: FuzzyRule[];

  constructor(variables: Record<string, FuzzyVariable>, rules: FuzzyRule[]) {
    this.variables = variables;
    this.rules = rules;
  }

  // Calculate membership degree for a value in a fuzzy set
  private getMembership(variableName: string, setValue: string, inputValue: number): number {
    const variable = this.variables[variableName];
    if (!variable) return 0;

    const set = variable.sets.find(s => s.name === setValue);
    if (!set) return 0;

    return set.membership(inputValue);
  }

  // Evaluate rule conditions
  private evaluateConditions(rule: FuzzyRule, inputs: Record<string, number>): number {
    let totalStrength = 0;
    let totalWeight = 0;

    for (const condition of rule.conditions) {
      const inputValue = inputs[condition.variable];
      if (inputValue === undefined) continue;

      const membership = this.getMembership(condition.variable, condition.set, inputValue);
      const weight = condition.weight || 1;

      totalStrength += membership * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalStrength / totalWeight : 0;
  }

  // Defuzzification using centroid method
  private defuzzify(outputVariable: string, activatedRules: Array<{ rule: FuzzyRule; strength: number }>): number {
    const variable = this.variables[outputVariable];
    if (!variable) return 0;

    let numerator = 0;
    let denominator = 0;

    // For each output set, calculate its activation level
    for (const set of variable.sets) {
      let maxActivation = 0;

      // Find maximum activation level for this set
      for (const { rule, strength } of activatedRules) {
        if (rule.conclusion.set === set.name) {
          maxActivation = Math.max(maxActivation, strength * rule.confidence);
        }
      }

      if (maxActivation > 0) {
        // Calculate centroid of the set
        const [min, max] = set.range;
        const centroid = (min + max) / 2;

        numerator += centroid * maxActivation;
        denominator += maxActivation;
      }
    }

    return denominator > 0 ? numerator / denominator : 0;
  }

  // Main inference method
  infer(inputs: Record<string, number>, activityType: string): FuzzyInferenceResult {
    const activatedRules: Array<{ rule: FuzzyRule; strength: number }> = [];
    const reasoning: string[] = [];

    // Evaluate all rules
    for (const rule of this.rules) {
      // Filter rules relevant to the activity type
      if (!rule.id.includes(activityType.toLowerCase().replace(/\s+/g, '_'))) {
        continue;
      }

      const strength = this.evaluateConditions(rule, inputs);
      
      if (strength > 0.1) { // Only consider rules with significant activation
        activatedRules.push({ rule, strength });
        reasoning.push(`${rule.reasoning} (activation: ${(strength * 100).toFixed(1)}%)`);
      }
    }

    // Calculate output value
    const outputValue = this.defuzzify('recommendationScore', activatedRules);

    // Calculate overall confidence
    const totalActivation = activatedRules.reduce((sum, { strength, rule }) => sum + strength * rule.confidence, 0);
    const confidence = activatedRules.length > 0 ? 
      (totalActivation / activatedRules.length) * 100 : 0;

    return {
      outputValue,
      confidence,
      activatedRules,
      reasoning
    };
  }
}

// Create fuzzy inference engine instance
export const fuzzyEngine = new FuzzyInferenceEngine(FUZZY_VARIABLES, FUZZY_RULES);

// Helper function to calculate fuzzy inputs from KPIs
export function calculateFuzzyInputs(
  kpis: any,
  costs: any,
  industry: string,
  companySize: string
): Record<string, number> {
  // Calculate LTV:CAC ratio
  const ltvCacRatio = kpis.customerLifetimeValue > 0 && kpis.customerAcquisitionCost > 0 
    ? kpis.customerLifetimeValue / kpis.customerAcquisitionCost 
    : 0;

  // Calculate company maturity score (0-10)
  let maturityScore = 0;
  if (kpis.monthlyRevenue > 100000) maturityScore += 3;
  else if (kpis.monthlyRevenue > 50000) maturityScore += 2;
  else if (kpis.monthlyRevenue > 10000) maturityScore += 1;

  if (companySize === '1000+') maturityScore += 3;
  else if (companySize === '501-1000') maturityScore += 2.5;
  else if (companySize === '201-500') maturityScore += 2;
  else if (companySize === '51-200') maturityScore += 1.5;
  else if (companySize === '11-50') maturityScore += 1;

  // Calculate marketing efficiency (0-100)
  const marketingEfficiency = costs.marketingBudget > 0 
    ? Math.min(100, (kpis.monthlyRevenue / costs.marketingBudget) * 10)
    : 50;

  return {
    conversionRate: kpis.conversionRate || 0,
    customerAcquisitionCost: kpis.customerAcquisitionCost || 0,
    ltvCacRatio,
    companyMaturity: Math.min(10, maturityScore),
    marketingEfficiency
  };
}

// Enhanced fuzzy logic recommendation function
export function generateFuzzyRecommendation(
  activityType: string,
  kpis: any,
  costs: any,
  industry: string,
  companySize: string
): {
  score: number;
  confidence: number;
  reasoning: string[];
  priority: 'critical' | 'high' | 'medium' | 'low' | 'not_recommended';
} {
  const inputs = calculateFuzzyInputs(kpis, costs, industry, companySize);
  const result = fuzzyEngine.infer(inputs, activityType);

  // Determine priority based on score
  let priority: 'critical' | 'high' | 'medium' | 'low' | 'not_recommended';
  if (result.outputValue >= 90) priority = 'critical';
  else if (result.outputValue >= 70) priority = 'high';
  else if (result.outputValue >= 45) priority = 'medium';
  else if (result.outputValue >= 25) priority = 'low';
  else priority = 'not_recommended';

  return {
    score: Math.round(result.outputValue),
    confidence: Math.round(result.confidence),
    reasoning: result.reasoning,
    priority
  };
}
