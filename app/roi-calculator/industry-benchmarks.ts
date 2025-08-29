// Industry benchmarks data and utilities

// Company size multipliers for adjusting benchmarks
export const COMPANY_SIZE_MULTIPLIERS: Record<string, any> = {
  '1-10': {
    efficiency: 0.8,
    scalability: 1.2,
    resourceConstraint: 1.3
  },
  '11-50': {
    efficiency: 0.9,
    scalability: 1.1,
    resourceConstraint: 1.1
  },
  '51-200': {
    efficiency: 1.0,
    scalability: 1.0,
    resourceConstraint: 1.0
  },
  '201-500': {
    efficiency: 1.1,
    scalability: 0.9,
    resourceConstraint: 0.9
  },
  '501-1000': {
    efficiency: 1.2,
    scalability: 0.8,
    resourceConstraint: 0.8
  },
  '1000+': {
    efficiency: 1.3,
    scalability: 0.7,
    resourceConstraint: 0.7
  }
};

// Legacy industry benchmarks structure for backward compatibility
export const INDUSTRY_BENCHMARKS: Record<string, any> = {
  technology: {
    conversionRate: { min: 2, avg: 5, max: 12 },
    churnRate: { monthly: 5, annual: 15 },
    cac: { min: 100, avg: 400, max: 1200 },
    ltv: { min: 1000, avg: 4000, max: 15000 }
  },
  finance: {
    conversionRate: { min: 1, avg: 3, max: 8 },
    churnRate: { monthly: 3, annual: 10 },
    cac: { min: 200, avg: 800, max: 2500 },
    ltv: { min: 2000, avg: 8000, max: 30000 }
  },
  healthcare: {
    conversionRate: { min: 1.5, avg: 4, max: 10 },
    churnRate: { monthly: 4, annual: 12 },
    cac: { min: 300, avg: 1000, max: 3000 },
    ltv: { min: 3000, avg: 10000, max: 40000 }
  },
  retail: {
    conversionRate: { min: 3, avg: 7, max: 15 },
    churnRate: { monthly: 8, annual: 25 },
    cac: { min: 50, avg: 200, max: 600 },
    ltv: { min: 500, avg: 1500, max: 5000 }
  },
  manufacturing: {
    conversionRate: { min: 0.5, avg: 2, max: 6 },
    churnRate: { monthly: 2, annual: 8 },
    cac: { min: 500, avg: 1500, max: 5000 },
    ltv: { min: 5000, avg: 20000, max: 80000 }
  },
  services: {
    conversionRate: { min: 2, avg: 5, max: 12 },
    churnRate: { monthly: 6, annual: 18 },
    cac: { min: 150, avg: 500, max: 1500 },
    ltv: { min: 1500, avg: 5000, max: 20000 }
  }
};

export interface IndustryBenchmark {
  industry: string;
  companySize: string;
  metrics: {
    conversionRate: { min: number; avg: number; max: number; top10: number };
    customerAcquisitionCost: { min: number; avg: number; max: number; top10: number };
    customerLifetimeValue: { min: number; avg: number; max: number; top10: number };
    monthlyChurnRate: { min: number; avg: number; max: number; top10: number };
    salesCycleLength: { min: number; avg: number; max: number; top10: number };
    averageOrderValue: { min: number; avg: number; max: number; top10: number };
  };
  marketMaturity: {
    digitalAdoption: number; // 0-1 scale
    competitionLevel: number; // 0-1 scale
    growthPotential: number; // 0-1 scale
  };
}

const industryBenchmarks: IndustryBenchmark[] = [
  // Technology Industry
  {
    industry: "Technology",
    companySize: "startup",
    metrics: {
      conversionRate: { min: 1.5, avg: 3.2, max: 8.5, top10: 12.0 },
      customerAcquisitionCost: { min: 50, avg: 200, max: 800, top10: 1500 },
      customerLifetimeValue: { min: 500, avg: 2500, max: 15000, top10: 25000 },
      monthlyChurnRate: { min: 2.0, avg: 8.5, max: 25.0, top10: 35.0 },
      salesCycleLength: { min: 7, avg: 30, max: 90, top10: 180 },
      averageOrderValue: { min: 50, avg: 300, max: 2000, top10: 5000 }
    },
    marketMaturity: { digitalAdoption: 0.9, competitionLevel: 0.8, growthPotential: 0.85 }
  },
  {
    industry: "Technology",
    companySize: "small",
    metrics: {
      conversionRate: { min: 2.0, avg: 4.5, max: 12.0, top10: 18.0 },
      customerAcquisitionCost: { min: 80, avg: 350, max: 1200, top10: 2000 },
      customerLifetimeValue: { min: 1000, avg: 5000, max: 25000, top10: 50000 },
      monthlyChurnRate: { min: 1.5, avg: 6.0, max: 18.0, top10: 25.0 },
      salesCycleLength: { min: 14, avg: 45, max: 120, top10: 240 },
      averageOrderValue: { min: 100, avg: 800, max: 5000, top10: 12000 }
    },
    marketMaturity: { digitalAdoption: 0.85, competitionLevel: 0.75, growthPotential: 0.8 }
  },
  {
    industry: "Technology",
    companySize: "medium",
    metrics: {
      conversionRate: { min: 2.5, avg: 6.0, max: 15.0, top10: 22.0 },
      customerAcquisitionCost: { min: 120, avg: 500, max: 1800, top10: 3500 },
      customerLifetimeValue: { min: 2000, avg: 8000, max: 40000, top10: 80000 },
      monthlyChurnRate: { min: 1.0, avg: 4.5, max: 12.0, top10: 18.0 },
      salesCycleLength: { min: 21, avg: 60, max: 180, top10: 360 },
      averageOrderValue: { min: 200, avg: 1500, max: 10000, top10: 25000 }
    },
    marketMaturity: { digitalAdoption: 0.8, competitionLevel: 0.7, growthPotential: 0.75 }
  },
  {
    industry: "Technology",
    companySize: "large",
    metrics: {
      conversionRate: { min: 3.0, avg: 8.0, max: 18.0, top10: 25.0 },
      customerAcquisitionCost: { min: 200, avg: 800, max: 3000, top10: 6000 },
      customerLifetimeValue: { min: 5000, avg: 15000, max: 80000, top10: 150000 },
      monthlyChurnRate: { min: 0.5, avg: 3.0, max: 8.0, top10: 12.0 },
      salesCycleLength: { min: 30, avg: 90, max: 270, top10: 540 },
      averageOrderValue: { min: 500, avg: 3000, max: 20000, top10: 50000 }
    },
    marketMaturity: { digitalAdoption: 0.75, competitionLevel: 0.65, growthPotential: 0.7 }
  },

  // Finance Industry
  {
    industry: "Finance",
    companySize: "startup",
    metrics: {
      conversionRate: { min: 0.8, avg: 2.1, max: 5.5, top10: 8.5 },
      customerAcquisitionCost: { min: 100, avg: 400, max: 1200, top10: 2500 },
      customerLifetimeValue: { min: 800, avg: 3500, max: 18000, top10: 35000 },
      monthlyChurnRate: { min: 1.5, avg: 6.5, max: 20.0, top10: 30.0 },
      salesCycleLength: { min: 14, avg: 45, max: 120, top10: 240 },
      averageOrderValue: { min: 100, avg: 500, max: 3000, top10: 8000 }
    },
    marketMaturity: { digitalAdoption: 0.7, competitionLevel: 0.85, growthPotential: 0.75 }
  },
  {
    industry: "Finance",
    companySize: "small",
    metrics: {
      conversionRate: { min: 1.2, avg: 3.0, max: 8.0, top10: 12.0 },
      customerAcquisitionCost: { min: 150, avg: 600, max: 1800, top10: 3500 },
      customerLifetimeValue: { min: 1500, avg: 6000, max: 30000, top10: 60000 },
      monthlyChurnRate: { min: 1.0, avg: 4.5, max: 15.0, top10: 22.0 },
      salesCycleLength: { min: 21, avg: 60, max: 150, top10: 300 },
      averageOrderValue: { min: 200, avg: 1000, max: 6000, top10: 15000 }
    },
    marketMaturity: { digitalAdoption: 0.65, competitionLevel: 0.8, growthPotential: 0.7 }
  },
  {
    industry: "Finance",
    companySize: "medium",
    metrics: {
      conversionRate: { min: 1.5, avg: 4.0, max: 10.0, top10: 15.0 },
      customerAcquisitionCost: { min: 250, avg: 900, max: 2500, top10: 5000 },
      customerLifetimeValue: { min: 3000, avg: 10000, max: 50000, top10: 100000 },
      monthlyChurnRate: { min: 0.8, avg: 3.5, max: 10.0, top10: 15.0 },
      salesCycleLength: { min: 30, avg: 90, max: 210, top10: 420 },
      averageOrderValue: { min: 400, avg: 2000, max: 12000, top10: 30000 }
    },
    marketMaturity: { digitalAdoption: 0.6, competitionLevel: 0.75, growthPotential: 0.65 }
  },
  {
    industry: "Finance",
    companySize: "large",
    metrics: {
      conversionRate: { min: 2.0, avg: 5.5, max: 12.0, top10: 18.0 },
      customerAcquisitionCost: { min: 400, avg: 1500, max: 4000, top10: 8000 },
      customerLifetimeValue: { min: 6000, avg: 20000, max: 100000, top10: 200000 },
      monthlyChurnRate: { min: 0.5, avg: 2.5, max: 7.0, top10: 10.0 },
      salesCycleLength: { min: 45, avg: 120, max: 300, top10: 600 },
      averageOrderValue: { min: 800, avg: 4000, max: 25000, top10: 60000 }
    },
    marketMaturity: { digitalAdoption: 0.55, competitionLevel: 0.7, growthPotential: 0.6 }
  },

  // Healthcare Industry
  {
    industry: "Healthcare",
    companySize: "startup",
    metrics: {
      conversionRate: { min: 1.0, avg: 2.5, max: 6.0, top10: 9.0 },
      customerAcquisitionCost: { min: 150, avg: 500, max: 1500, top10: 3000 },
      customerLifetimeValue: { min: 1000, avg: 4000, max: 20000, top10: 40000 },
      monthlyChurnRate: { min: 2.0, avg: 7.0, max: 22.0, top10: 32.0 },
      salesCycleLength: { min: 21, avg: 60, max: 180, top10: 360 },
      averageOrderValue: { min: 150, avg: 600, max: 3500, top10: 8500 }
    },
    marketMaturity: { digitalAdoption: 0.5, competitionLevel: 0.6, growthPotential: 0.85 }
  },
  {
    industry: "Healthcare",
    companySize: "small",
    metrics: {
      conversionRate: { min: 1.5, avg: 3.5, max: 8.5, top10: 13.0 },
      customerAcquisitionCost: { min: 200, avg: 750, max: 2200, top10: 4000 },
      customerLifetimeValue: { min: 2000, avg: 7000, max: 35000, top10: 70000 },
      monthlyChurnRate: { min: 1.5, avg: 5.0, max: 16.0, top10: 24.0 },
      salesCycleLength: { min: 30, avg: 90, max: 240, top10: 480 },
      averageOrderValue: { min: 250, avg: 1200, max: 7000, top10: 17000 }
    },
    marketMaturity: { digitalAdoption: 0.45, competitionLevel: 0.55, growthPotential: 0.8 }
  },
  {
    industry: "Healthcare",
    companySize: "medium",
    metrics: {
      conversionRate: { min: 2.0, avg: 4.5, max: 11.0, top10: 16.0 },
      customerAcquisitionCost: { min: 300, avg: 1100, max: 3000, top10: 6000 },
      customerLifetimeValue: { min: 4000, avg: 12000, max: 60000, top10: 120000 },
      monthlyChurnRate: { min: 1.0, avg: 3.5, max: 12.0, top10: 18.0 },
      salesCycleLength: { min: 45, avg: 120, max: 300, top10: 600 },
      averageOrderValue: { min: 500, avg: 2500, max: 15000, top10: 35000 }
    },
    marketMaturity: { digitalAdoption: 0.4, competitionLevel: 0.5, growthPotential: 0.75 }
  },
  {
    industry: "Healthcare",
    companySize: "large",
    metrics: {
      conversionRate: { min: 2.5, avg: 6.0, max: 14.0, top10: 20.0 },
      customerAcquisitionCost: { min: 500, avg: 1800, max: 5000, top10: 10000 },
      customerLifetimeValue: { min: 8000, avg: 25000, max: 120000, top10: 250000 },
      monthlyChurnRate: { min: 0.5, avg: 2.5, max: 8.0, top10: 12.0 },
      salesCycleLength: { min: 60, avg: 180, max: 450, top10: 900 },
      averageOrderValue: { min: 1000, avg: 5000, max: 30000, top10: 70000 }
    },
    marketMaturity: { digitalAdoption: 0.35, competitionLevel: 0.45, growthPotential: 0.7 }
  },

  // Retail Industry
  {
    industry: "Retail",
    companySize: "startup",
    metrics: {
      conversionRate: { min: 2.0, avg: 4.5, max: 10.0, top10: 15.0 },
      customerAcquisitionCost: { min: 20, avg: 80, max: 300, top10: 600 },
      customerLifetimeValue: { min: 200, avg: 800, max: 4000, top10: 8000 },
      monthlyChurnRate: { min: 5.0, avg: 15.0, max: 40.0, top10: 60.0 },
      salesCycleLength: { min: 1, avg: 7, max: 30, top10: 60 },
      averageOrderValue: { min: 25, avg: 85, max: 300, top10: 600 }
    },
    marketMaturity: { digitalAdoption: 0.8, competitionLevel: 0.9, growthPotential: 0.7 }
  },
  {
    industry: "Retail",
    companySize: "small",
    metrics: {
      conversionRate: { min: 2.5, avg: 6.0, max: 13.0, top10: 20.0 },
      customerAcquisitionCost: { min: 30, avg: 120, max: 450, top10: 900 },
      customerLifetimeValue: { min: 400, avg: 1500, max: 7500, top10: 15000 },
      monthlyChurnRate: { min: 4.0, avg: 12.0, max: 30.0, top10: 45.0 },
      salesCycleLength: { min: 1, avg: 10, max: 45, top10: 90 },
      averageOrderValue: { min: 40, avg: 150, max: 600, top10: 1200 }
    },
    marketMaturity: { digitalAdoption: 0.75, competitionLevel: 0.85, growthPotential: 0.65 }
  },
  {
    industry: "Retail",
    companySize: "medium",
    metrics: {
      conversionRate: { min: 3.0, avg: 7.5, max: 16.0, top10: 24.0 },
      customerAcquisitionCost: { min: 50, avg: 180, max: 600, top10: 1200 },
      customerLifetimeValue: { min: 800, avg: 2500, max: 12000, top10: 25000 },
      monthlyChurnRate: { min: 3.0, avg: 9.0, max: 22.0, top10: 35.0 },
      salesCycleLength: { min: 2, avg: 14, max: 60, top10: 120 },
      averageOrderValue: { min: 60, avg: 250, max: 1000, top10: 2000 }
    },
    marketMaturity: { digitalAdoption: 0.7, competitionLevel: 0.8, growthPotential: 0.6 }
  },
  {
    industry: "Retail",
    companySize: "large",
    metrics: {
      conversionRate: { min: 3.5, avg: 9.0, max: 20.0, top10: 28.0 },
      customerAcquisitionCost: { min: 80, avg: 250, max: 800, top10: 1600 },
      customerLifetimeValue: { min: 1500, avg: 4000, max: 20000, top10: 40000 },
      monthlyChurnRate: { min: 2.0, avg: 6.5, max: 16.0, top10: 25.0 },
      salesCycleLength: { min: 3, avg: 21, max: 90, top10: 180 },
      averageOrderValue: { min: 100, avg: 400, max: 1500, top10: 3000 }
    },
    marketMaturity: { digitalAdoption: 0.65, competitionLevel: 0.75, growthPotential: 0.55 }
  },

  // Manufacturing Industry
  {
    industry: "Manufacturing",
    companySize: "startup",
    metrics: {
      conversionRate: { min: 0.5, avg: 1.5, max: 4.0, top10: 6.5 },
      customerAcquisitionCost: { min: 200, avg: 800, max: 2500, top10: 5000 },
      customerLifetimeValue: { min: 2000, avg: 8000, max: 40000, top10: 80000 },
      monthlyChurnRate: { min: 1.0, avg: 4.0, max: 12.0, top10: 18.0 },
      salesCycleLength: { min: 30, avg: 90, max: 270, top10: 540 },
      averageOrderValue: { min: 500, avg: 2000, max: 10000, top10: 25000 }
    },
    marketMaturity: { digitalAdoption: 0.4, competitionLevel: 0.6, growthPotential: 0.75 }
  },
  {
    industry: "Manufacturing",
    companySize: "small",
    metrics: {
      conversionRate: { min: 0.8, avg: 2.2, max: 5.5, top10: 8.5 },
      customerAcquisitionCost: { min: 300, avg: 1200, max: 3500, top10: 7000 },
      customerLifetimeValue: { min: 4000, avg: 15000, max: 75000, top10: 150000 },
      monthlyChurnRate: { min: 0.8, avg: 3.0, max: 9.0, top10: 14.0 },
      salesCycleLength: { min: 45, avg: 120, max: 360, top10: 720 },
      averageOrderValue: { min: 800, avg: 3500, max: 18000, top10: 40000 }
    },
    marketMaturity: { digitalAdoption: 0.35, competitionLevel: 0.55, growthPotential: 0.7 }
  },
  {
    industry: "Manufacturing",
    companySize: "medium",
    metrics: {
      conversionRate: { min: 1.0, avg: 3.0, max: 7.0, top10: 11.0 },
      customerAcquisitionCost: { min: 500, avg: 1800, max: 5000, top10: 10000 },
      customerLifetimeValue: { min: 8000, avg: 25000, max: 125000, top10: 250000 },
      monthlyChurnRate: { min: 0.5, avg: 2.2, max: 6.5, top10: 10.0 },
      salesCycleLength: { min: 60, avg: 180, max: 540, top10: 1080 },
      averageOrderValue: { min: 1500, avg: 6000, max: 30000, top10: 70000 }
    },
    marketMaturity: { digitalAdoption: 0.3, competitionLevel: 0.5, growthPotential: 0.65 }
  },
  {
    industry: "Manufacturing",
    companySize: "large",
    metrics: {
      conversionRate: { min: 1.2, avg: 4.0, max: 9.0, top10: 14.0 },
      customerAcquisitionCost: { min: 800, avg: 2500, max: 7500, top10: 15000 },
      customerLifetimeValue: { min: 15000, avg: 50000, max: 250000, top10: 500000 },
      monthlyChurnRate: { min: 0.3, avg: 1.5, max: 4.5, top10: 7.0 },
      salesCycleLength: { min: 90, avg: 270, max: 810, top10: 1620 },
      averageOrderValue: { min: 3000, avg: 12000, max: 60000, top10: 140000 }
    },
    marketMaturity: { digitalAdoption: 0.25, competitionLevel: 0.45, growthPotential: 0.6 }
  },

  // Services Industry
  {
    industry: "Services",
    companySize: "startup",
    metrics: {
      conversionRate: { min: 1.2, avg: 3.0, max: 7.5, top10: 11.5 },
      customerAcquisitionCost: { min: 80, avg: 300, max: 1000, top10: 2000 },
      customerLifetimeValue: { min: 600, avg: 2500, max: 12000, top10: 25000 },
      monthlyChurnRate: { min: 2.5, avg: 8.0, max: 25.0, top10: 35.0 },
      salesCycleLength: { min: 7, avg: 30, max: 90, top10: 180 },
      averageOrderValue: { min: 100, avg: 400, max: 2000, top10: 5000 }
    },
    marketMaturity: { digitalAdoption: 0.6, competitionLevel: 0.7, growthPotential: 0.8 }
  },
  {
    industry: "Services",
    companySize: "small",
    metrics: {
      conversionRate: { min: 1.8, avg: 4.2, max: 10.0, top10: 15.0 },
      customerAcquisitionCost: { min: 120, avg: 450, max: 1400, top10: 2800 },
      customerLifetimeValue: { min: 1200, avg: 4500, max: 22000, top10: 45000 },
      monthlyChurnRate: { min: 2.0, avg: 6.0, max: 18.0, top10: 28.0 },
      salesCycleLength: { min: 10, avg: 45, max: 120, top10: 240 },
      averageOrderValue: { min: 150, avg: 700, max: 3500, top10: 8000 }
    },
    marketMaturity: { digitalAdoption: 0.55, competitionLevel: 0.65, growthPotential: 0.75 }
  },
  {
    industry: "Services",
    companySize: "medium",
    metrics: {
      conversionRate: { min: 2.2, avg: 5.5, max: 13.0, top10: 19.0 },
      customerAcquisitionCost: { min: 180, avg: 650, max: 2000, top10: 4000 },
      customerLifetimeValue: { min: 2500, avg: 8000, max: 40000, top10: 80000 },
      monthlyChurnRate: { min: 1.5, avg: 4.5, max: 14.0, top10: 21.0 },
      salesCycleLength: { min: 14, avg: 60, max: 180, top10: 360 },
      averageOrderValue: { min: 250, avg: 1200, max: 6000, top10: 14000 }
    },
    marketMaturity: { digitalAdoption: 0.5, competitionLevel: 0.6, growthPotential: 0.7 }
  },
  {
    industry: "Services",
    companySize: "large",
    metrics: {
      conversionRate: { min: 2.8, avg: 7.0, max: 16.0, top10: 23.0 },
      customerAcquisitionCost: { min: 300, avg: 1000, max: 3000, top10: 6000 },
      customerLifetimeValue: { min: 5000, avg: 15000, max: 75000, top10: 150000 },
      monthlyChurnRate: { min: 1.0, avg: 3.2, max: 10.0, top10: 15.0 },
      salesCycleLength: { min: 21, avg: 90, max: 270, top10: 540 },
      averageOrderValue: { min: 500, avg: 2000, max: 10000, top10: 25000 }
    },
    marketMaturity: { digitalAdoption: 0.45, competitionLevel: 0.55, growthPotential: 0.65 }
  }
];

/**
 * Get industry benchmark data for a specific industry and company size
 */
export function getIndustryBenchmarkData(industry: string, companySize: string): IndustryBenchmark | null {
  const benchmark = industryBenchmarks.find(
    b => b.industry.toLowerCase() === industry.toLowerCase() && 
         b.companySize.toLowerCase() === companySize.toLowerCase()
  );
  
  return benchmark || null;
}

/**
 * Get all available industries
 */
export function getAvailableIndustries(): string[] {
  return Array.from(new Set(industryBenchmarks.map((b: IndustryBenchmark) => b.industry)));
}

/**
 * Get all available company sizes
 */
export function getAvailableCompanySizes(): string[] {
  return Array.from(new Set(industryBenchmarks.map((b: IndustryBenchmark) => b.companySize)));
}

/**
 * Get industry average for a specific metric across all company sizes
 */
export function getIndustryAverage(industry: string, metric: keyof IndustryBenchmark['metrics']): number {
  const filteredBenchmarks: IndustryBenchmark[] = industryBenchmarks.filter(
    (b: IndustryBenchmark) => b.industry.toLowerCase() === industry.toLowerCase()
  );
  
  if (filteredBenchmarks.length === 0) return 0;
  
  const averages = filteredBenchmarks.map((b: IndustryBenchmark) => b.metrics[metric].avg);
  return averages.reduce((sum: number, avg: number) => sum + avg, 0) / averages.length;
}

/**
 * Get performance percentile for a value within industry benchmarks
 */
export function getPerformancePercentile(
  industry: string, 
  companySize: string, 
  metric: keyof IndustryBenchmark['metrics'], 
  value: number
): number {
  const benchmark = getIndustryBenchmarkData(industry, companySize);
  if (!benchmark) return 50; // Default to median if no benchmark found
  
  const metricData = benchmark.metrics[metric];
  
  if (value <= metricData.min) return 10;
  if (value >= metricData.top10) return 95;
  if (value >= metricData.max) return 85;
  if (value >= metricData.avg) {
    // Between average and max
    const ratio = (value - metricData.avg) / (metricData.max - metricData.avg);
    return 50 + (ratio * 35); // 50-85th percentile
  } else {
    // Between min and average
    const ratio = (value - metricData.min) / (metricData.avg - metricData.min);
    return 10 + (ratio * 40); // 10-50th percentile
  }
}

/**
 * Get specific metric value from industry benchmarks (compatible with utils.ts)
 * This function matches the signature expected by utils.ts
 */
export function getIndustryBenchmarkValue(
  industry: string,
  metric: keyof IndustryBenchmark['metrics'],
  companySize: string,
  valueType: 'min' | 'avg' | 'max' | 'top10' = 'avg'
): number {
  const benchmark = getIndustryBenchmarkData(industry, companySize);
  if (!benchmark) {
    // Return fallback values if no benchmark found
    const fallbacks = {
      conversionRate: { min: 1, avg: 3, max: 8, top10: 12 },
      customerAcquisitionCost: { min: 50, avg: 300, max: 1000, top10: 2000 },
      customerLifetimeValue: { min: 500, avg: 2500, max: 10000, top10: 20000 },
      monthlyChurnRate: { min: 1, avg: 5, max: 15, top10: 25 },
      salesCycleLength: { min: 7, avg: 30, max: 90, top10: 180 },
      averageOrderValue: { min: 50, avg: 300, max: 1500, top10: 3000 }
    };
    
    return fallbacks[metric]?.[valueType] || 0;
  }
  
  return benchmark.metrics[metric][valueType];
}

/**
 * Calculate benchmark confidence based on data availability and industry maturity
 */
export function calculateBenchmarkConfidence(
  industry: string,
  companySize: string,
  dataCompleteness: number = 1.0
): number {
  const benchmark = getIndustryBenchmarkData(industry, companySize);
  if (!benchmark) return 0.5; // Default confidence if no benchmark found
  
  // Base confidence from market maturity factors
  const maturityFactors = benchmark.marketMaturity;
  const baseConfidence = (
    maturityFactors.digitalAdoption * 0.4 +
    (1 - maturityFactors.competitionLevel) * 0.3 +
    maturityFactors.growthPotential * 0.3
  );
  
  // Adjust for data completeness
  const adjustedConfidence = baseConfidence * dataCompleteness;
  
  // Ensure confidence is between 0.1 and 0.95
  return Math.max(0.1, Math.min(0.95, adjustedConfidence));
}

// Export alias for backward compatibility with utils.ts
export { getIndustryBenchmarkValue as getIndustryBenchmark };
