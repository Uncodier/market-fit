/**
 * Industry Benchmarks Engine
 * Provides intelligent defaults and benchmarking data
 */

export interface BenchmarkData {
  industryAverage: Record<string, number>;
  topPerformers: Record<string, number>;
  yourPosition: 'below' | 'average' | 'above' | 'top';
  improvementAreas: string[];
}

export interface DefaultValues {
  kpis: {
    monthlyRevenue: number;
    customerAcquisitionCost: number;
    customerLifetimeValue: number;
    conversionRate: number;
    averageOrderValue: number;
    monthlyLeads: number;
    salesCycleLength: number;
    convertedCustomers: number;
    customerLifetimeSpan: number;
    churnRate: number;
  };
  costs: {
    marketingBudget: number;
    salesTeamCost: number;
    salesCommission: number;
    technologyCosts: number;
    operationalCosts: number;
    cogs: number;
    otherCosts: number;
  };
}

export class IndustryBenchmarks {
  private benchmarkData: Record<string, Record<string, any>>;
  private companySizeMultipliers: Record<string, Record<string, number>>;

  constructor() {
    this.initializeBenchmarkData();
    this.initializeSizeMultipliers();
  }

  /**
   * Get benchmarks for specific industry and company size
   */
  getBenchmarks(industry: string, companySize: string, currentState: any): BenchmarkData {
    const industryKey = industry.toLowerCase();
    const sizeKey = this.normalizeSizeKey(companySize);
    
    const industryData = this.benchmarkData[industryKey] || this.benchmarkData.services;
    const sizeMultipliers = this.companySizeMultipliers[sizeKey] || this.companySizeMultipliers['11-50'];
    
    // Apply size multipliers to industry benchmarks
    const industryAverage = this.applyMultipliers(industryData.average, sizeMultipliers);
    const topPerformers = this.applyMultipliers(industryData.topPerformers, sizeMultipliers);
    
    // Determine position
    const yourPosition = this.determinePosition(currentState, industryAverage, topPerformers);
    
    // Identify improvement areas
    const improvementAreas = this.identifyImprovementAreas(currentState, industryAverage);
    
    return {
      industryAverage,
      topPerformers,
      yourPosition,
      improvementAreas
    };
  }

  /**
   * Get intelligent defaults for missing data
   */
  getDefaults(industry: string, companySize: string): DefaultValues {
    const industryKey = industry.toLowerCase();
    const sizeKey = this.normalizeSizeKey(companySize);
    
    const industryData = this.benchmarkData[industryKey] || this.benchmarkData.services;
    const sizeMultipliers = this.companySizeMultipliers[sizeKey] || this.companySizeMultipliers['11-50'];
    
    // Apply size multipliers to get realistic defaults
    const kpis = this.applyMultipliers(industryData.defaults.kpis, sizeMultipliers);
    const costs = this.applyMultipliers(industryData.defaults.costs, sizeMultipliers);
    
    return { kpis, costs };
  }

  /**
   * Get confidence score for benchmark data availability
   */
  getBenchmarkConfidence(industry: string, companySize: string): number {
    const industryKey = industry.toLowerCase();
    const hasIndustryData = this.benchmarkData[industryKey] !== undefined;
    const hasSizeData = this.companySizeMultipliers[this.normalizeSizeKey(companySize)] !== undefined;
    
    let confidence = 0.5; // Base confidence
    if (hasIndustryData) confidence += 0.3;
    if (hasSizeData) confidence += 0.2;
    
    return confidence;
  }

  /**
   * Initialize benchmark data for different industries
   */
  private initializeBenchmarkData(): void {
    this.benchmarkData = {
      technology: {
        average: {
          conversionRate: 3.2,
          cac: 280,
          ltv: 2400,
          roi: 180,
          salesCycleLength: 45,
          churnRate: 8
        },
        topPerformers: {
          conversionRate: 8.5,
          cac: 150,
          ltv: 4200,
          roi: 350,
          salesCycleLength: 25,
          churnRate: 3
        },
        defaults: {
          kpis: {
            monthlyRevenue: 25000,
            customerAcquisitionCost: 280,
            customerLifetimeValue: 2400,
            conversionRate: 3.2,
            averageOrderValue: 450,
            monthlyLeads: 180,
            salesCycleLength: 45,
            convertedCustomers: 6,
            customerLifetimeSpan: 18,
            churnRate: 8
          },
          costs: {
            marketingBudget: 8000,
            salesTeamCost: 12000,
            salesCommission: 2000,
            technologyCosts: 3500,
            operationalCosts: 4000,
            cogs: 8750,
            otherCosts: 1250
          }
        }
      },
      
      healthcare: {
        average: {
          conversionRate: 2.8,
          cac: 450,
          ltv: 3200,
          roi: 220,
          salesCycleLength: 90,
          churnRate: 5
        },
        topPerformers: {
          conversionRate: 6.2,
          cac: 280,
          ltv: 5800,
          roi: 420,
          salesCycleLength: 60,
          churnRate: 2
        },
        defaults: {
          kpis: {
            monthlyRevenue: 35000,
            customerAcquisitionCost: 450,
            customerLifetimeValue: 3200,
            conversionRate: 2.8,
            averageOrderValue: 650,
            monthlyLeads: 150,
            salesCycleLength: 90,
            convertedCustomers: 4,
            customerLifetimeSpan: 24,
            churnRate: 5
          },
          costs: {
            marketingBudget: 10000,
            salesTeamCost: 15000,
            salesCommission: 2800,
            technologyCosts: 2500,
            operationalCosts: 5000,
            cogs: 12250,
            otherCosts: 1750
          }
        }
      },
      
      finance: {
        average: {
          conversionRate: 2.1,
          cac: 650,
          ltv: 4500,
          roi: 280,
          salesCycleLength: 120,
          churnRate: 4
        },
        topPerformers: {
          conversionRate: 5.8,
          cac: 380,
          ltv: 8200,
          roi: 520,
          salesCycleLength: 75,
          churnRate: 1.5
        },
        defaults: {
          kpis: {
            monthlyRevenue: 50000,
            customerAcquisitionCost: 650,
            customerLifetimeValue: 4500,
            conversionRate: 2.1,
            averageOrderValue: 1200,
            monthlyLeads: 120,
            salesCycleLength: 120,
            convertedCustomers: 3,
            customerLifetimeSpan: 30,
            churnRate: 4
          },
          costs: {
            marketingBudget: 15000,
            salesTeamCost: 20000,
            salesCommission: 4000,
            technologyCosts: 4000,
            operationalCosts: 6000,
            cogs: 17500,
            otherCosts: 2500
          }
        }
      },
      
      retail: {
        average: {
          conversionRate: 4.2,
          cac: 120,
          ltv: 850,
          roi: 140,
          salesCycleLength: 15,
          churnRate: 12
        },
        topPerformers: {
          conversionRate: 9.8,
          cac: 65,
          ltv: 1600,
          roi: 280,
          salesCycleLength: 8,
          churnRate: 6
        },
        defaults: {
          kpis: {
            monthlyRevenue: 18000,
            customerAcquisitionCost: 120,
            customerLifetimeValue: 850,
            conversionRate: 4.2,
            averageOrderValue: 85,
            monthlyLeads: 500,
            salesCycleLength: 15,
            convertedCustomers: 21,
            customerLifetimeSpan: 10,
            churnRate: 12
          },
          costs: {
            marketingBudget: 6000,
            salesTeamCost: 8000,
            salesCommission: 1440,
            technologyCosts: 1500,
            operationalCosts: 3500,
            cogs: 6300,
            otherCosts: 900
          }
        }
      },
      
      manufacturing: {
        average: {
          conversionRate: 1.8,
          cac: 850,
          ltv: 6200,
          roi: 320,
          salesCycleLength: 180,
          churnRate: 3
        },
        topPerformers: {
          conversionRate: 4.5,
          cac: 520,
          ltv: 12000,
          roi: 580,
          salesCycleLength: 120,
          churnRate: 1
        },
        defaults: {
          kpis: {
            monthlyRevenue: 75000,
            customerAcquisitionCost: 850,
            customerLifetimeValue: 6200,
            conversionRate: 1.8,
            averageOrderValue: 2500,
            monthlyLeads: 80,
            salesCycleLength: 180,
            convertedCustomers: 1,
            customerLifetimeSpan: 36,
            churnRate: 3
          },
          costs: {
            marketingBudget: 20000,
            salesTeamCost: 25000,
            salesCommission: 6000,
            technologyCosts: 3000,
            operationalCosts: 8000,
            cogs: 26250,
            otherCosts: 3750
          }
        }
      },
      
      services: {
        average: {
          conversionRate: 2.5,
          cac: 350,
          ltv: 1800,
          roi: 160,
          salesCycleLength: 60,
          churnRate: 7
        },
        topPerformers: {
          conversionRate: 6.8,
          cac: 180,
          ltv: 3400,
          roi: 320,
          salesCycleLength: 35,
          churnRate: 3
        },
        defaults: {
          kpis: {
            monthlyRevenue: 20000,
            customerAcquisitionCost: 350,
            customerLifetimeValue: 1800,
            conversionRate: 2.5,
            averageOrderValue: 300,
            monthlyLeads: 200,
            salesCycleLength: 60,
            convertedCustomers: 5,
            customerLifetimeSpan: 20,
            churnRate: 7
          },
          costs: {
            marketingBudget: 6000,
            salesTeamCost: 10000,
            salesCommission: 1600,
            technologyCosts: 2000,
            operationalCosts: 3000,
            cogs: 7000,
            otherCosts: 1000
          }
        }
      }
    };
  }

  /**
   * Initialize company size multipliers
   */
  private initializeSizeMultipliers(): void {
    this.companySizeMultipliers = {
      '1-10': {
        monthlyRevenue: 0.3,
        customerAcquisitionCost: 0.7,
        customerLifetimeValue: 0.6,
        conversionRate: 0.8,
        averageOrderValue: 0.7,
        monthlyLeads: 0.4,
        salesCycleLength: 1.2,
        convertedCustomers: 0.3,
        customerLifetimeSpan: 0.8,
        churnRate: 1.3,
        marketingBudget: 0.3,
        salesTeamCost: 0.4,
        salesCommission: 0.3,
        technologyCosts: 0.5,
        operationalCosts: 0.4,
        cogs: 0.3,
        otherCosts: 0.4
      },
      
      '11-50': {
        monthlyRevenue: 1.0,
        customerAcquisitionCost: 1.0,
        customerLifetimeValue: 1.0,
        conversionRate: 1.0,
        averageOrderValue: 1.0,
        monthlyLeads: 1.0,
        salesCycleLength: 1.0,
        convertedCustomers: 1.0,
        customerLifetimeSpan: 1.0,
        churnRate: 1.0,
        marketingBudget: 1.0,
        salesTeamCost: 1.0,
        salesCommission: 1.0,
        technologyCosts: 1.0,
        operationalCosts: 1.0,
        cogs: 1.0,
        otherCosts: 1.0
      },
      
      '51-200': {
        monthlyRevenue: 2.5,
        customerAcquisitionCost: 1.3,
        customerLifetimeValue: 1.8,
        conversionRate: 1.2,
        averageOrderValue: 1.4,
        monthlyLeads: 2.2,
        salesCycleLength: 0.9,
        convertedCustomers: 2.6,
        customerLifetimeSpan: 1.1,
        churnRate: 0.8,
        marketingBudget: 2.5,
        salesTeamCost: 2.8,
        salesCommission: 2.5,
        technologyCosts: 2.0,
        operationalCosts: 2.2,
        cogs: 2.5,
        otherCosts: 2.0
      },
      
      '201-500': {
        monthlyRevenue: 5.0,
        customerAcquisitionCost: 1.6,
        customerLifetimeValue: 2.8,
        conversionRate: 1.4,
        averageOrderValue: 2.2,
        monthlyLeads: 4.5,
        salesCycleLength: 0.8,
        convertedCustomers: 6.3,
        customerLifetimeSpan: 1.3,
        churnRate: 0.6,
        marketingBudget: 5.0,
        salesTeamCost: 6.0,
        salesCommission: 5.0,
        technologyCosts: 4.0,
        operationalCosts: 4.5,
        cogs: 5.0,
        otherCosts: 4.0
      },
      
      '501+': {
        monthlyRevenue: 10.0,
        customerAcquisitionCost: 2.0,
        customerLifetimeValue: 4.5,
        conversionRate: 1.6,
        averageOrderValue: 3.5,
        monthlyLeads: 8.0,
        salesCycleLength: 0.7,
        convertedCustomers: 12.8,
        customerLifetimeSpan: 1.5,
        churnRate: 0.4,
        marketingBudget: 10.0,
        salesTeamCost: 12.0,
        salesCommission: 10.0,
        technologyCosts: 8.0,
        operationalCosts: 9.0,
        cogs: 10.0,
        otherCosts: 8.0
      }
    };
  }

  /**
   * Apply multipliers to benchmark data
   */
  private applyMultipliers(data: Record<string, number>, multipliers: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = {};
    
    for (const [key, value] of Object.entries(data)) {
      const multiplier = multipliers[key] || 1.0;
      result[key] = Math.round(value * multiplier * 100) / 100; // Round to 2 decimal places
    }
    
    return result;
  }

  /**
   * Determine company position relative to benchmarks
   */
  private determinePosition(
    currentState: any, 
    industryAverage: Record<string, number>, 
    topPerformers: Record<string, number>
  ): 'below' | 'average' | 'above' | 'top' {
    const currentROI = currentState.roi || 0;
    const avgROI = industryAverage.roi || 0;
    const topROI = topPerformers.roi || 0;
    
    if (currentROI >= topROI * 0.9) return 'top';
    if (currentROI >= avgROI * 1.2) return 'above';
    if (currentROI >= avgROI * 0.8) return 'average';
    return 'below';
  }

  /**
   * Identify areas needing improvement
   */
  private identifyImprovementAreas(
    currentState: any, 
    industryAverage: Record<string, number>
  ): string[] {
    const areas: string[] = [];
    
    if ((currentState.conversionRate || 0) < industryAverage.conversionRate * 0.8) {
      areas.push('Conversion Rate Optimization');
    }
    
    if ((currentState.cac || 0) > industryAverage.cac * 1.2) {
      areas.push('Customer Acquisition Cost Reduction');
    }
    
    if ((currentState.ltv || 0) < industryAverage.ltv * 0.8) {
      areas.push('Customer Lifetime Value Enhancement');
    }
    
    if ((currentState.ltvCacRatio || 0) < 3) {
      areas.push('Unit Economics Optimization');
    }
    
    return areas;
  }

  /**
   * Normalize company size key
   */
  private normalizeSizeKey(companySize: string): string {
    const sizeMap: Record<string, string> = {
      '1-10': '1-10',
      '11-50': '11-50',
      '51-200': '51-200',
      '201-500': '201-500',
      '500+': '501+',
      '501+': '501+',
      '1000+': '501+'
    };
    
    return sizeMap[companySize] || '11-50';
  }
}
