export interface Company {
  id: string
  name: string
  legal_name?: string
  website?: string
  email?: string
  phone?: string
  linkedin_url?: string
  industry?: 'technology' | 'finance' | 'healthcare' | 'education' | 'retail' | 'manufacturing' | 'services' | 'hospitality' | 'media' | 'real_estate' | 'logistics' | 'nonprofit' | 'other'
  size?: '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1001-5000' | '5001-10000' | '10001+'
  employees_count?: number
  annual_revenue?: '<1M' | '1M-10M' | '10M-50M' | '50M-100M' | '100M-500M' | '500M-1B' | '>1B'
  founded?: string
  description?: string
  // Legal and tax information
  tax_id?: string
  tax_country?: string
  registration_number?: string
  vat_number?: string
  legal_structure?: 'sole_proprietorship' | 'partnership' | 'llc' | 'corporation' | 'nonprofit' | 'cooperative' | 's_corp' | 'c_corp' | 'lp' | 'llp' | 'sa' | 'srl' | 'gmbh' | 'ltd' | 'plc' | 'bv' | 'nv' | 'other'
  // Public company information
  is_public?: boolean
  stock_symbol?: string
  // Company hierarchy
  parent_company_id?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zipcode?: string
    country?: string
    [key: string]: string | undefined
  }
  created_at: string
  updated_at: string
}

export interface CreateCompanyInput {
  name: string
  legal_name?: string
  website?: string
  email?: string
  phone?: string
  linkedin_url?: string
  industry?: Company['industry']
  size?: Company['size']
  employees_count?: number
  annual_revenue?: Company['annual_revenue']
  founded?: string
  description?: string
  tax_id?: string
  tax_country?: string
  registration_number?: string
  vat_number?: string
  legal_structure?: Company['legal_structure']
  is_public?: boolean
  stock_symbol?: string
  parent_company_id?: string
  address?: Company['address']
}

export interface UpdateCompanyInput extends CreateCompanyInput {
  id: string
}

export const COMPANY_INDUSTRIES = [
  { id: 'technology', name: 'Technology' },
  { id: 'finance', name: 'Finance & Banking' },
  { id: 'healthcare', name: 'Healthcare' },
  { id: 'education', name: 'Education' },
  { id: 'retail', name: 'Retail' },
  { id: 'manufacturing', name: 'Manufacturing' },
  { id: 'services', name: 'Professional Services' },
  { id: 'hospitality', name: 'Hospitality' },
  { id: 'media', name: 'Media & Entertainment' },
  { id: 'real_estate', name: 'Real Estate' },
  { id: 'logistics', name: 'Logistics & Transportation' },
  { id: 'nonprofit', name: 'Nonprofit' },
  { id: 'other', name: 'Other' }
] as const

export const COMPANY_SIZES = [
  { id: '1-10', name: '1-10 employees' },
  { id: '11-50', name: '11-50 employees' },
  { id: '51-200', name: '51-200 employees' },
  { id: '201-500', name: '201-500 employees' },
  { id: '501-1000', name: '501-1000 employees' },
  { id: '1001-5000', name: '1001-5000 employees' },
  { id: '5001-10000', name: '5001-10000 employees' },
  { id: '10001+', name: '10001+ employees' }
] as const

export const COMPANY_ANNUAL_REVENUES = [
  { id: '<1M', name: 'Less than $1M' },
  { id: '1M-10M', name: '$1M - $10M' },
  { id: '10M-50M', name: '$10M - $50M' },
  { id: '50M-100M', name: '$50M - $100M' },
  { id: '100M-500M', name: '$100M - $500M' },
  { id: '500M-1B', name: '$500M - $1B' },
  { id: '>1B', name: 'More than $1B' }
] as const

export const LEGAL_STRUCTURES = [
  { id: 'sole_proprietorship', name: 'Sole Proprietorship' },
  { id: 'partnership', name: 'Partnership' },
  { id: 'llc', name: 'Limited Liability Company (LLC)' },
  { id: 'corporation', name: 'Corporation' },
  { id: 'nonprofit', name: 'Nonprofit Organization' },
  { id: 'cooperative', name: 'Cooperative' },
  { id: 's_corp', name: 'S Corporation' },
  { id: 'c_corp', name: 'C Corporation' },
  { id: 'lp', name: 'Limited Partnership (LP)' },
  { id: 'llp', name: 'Limited Liability Partnership (LLP)' },
  { id: 'sa', name: 'Sociedad Anónima (SA)' },
  { id: 'srl', name: 'Sociedad de Responsabilidad Limitada (SRL)' },
  { id: 'gmbh', name: 'Gesellschaft mit beschränkter Haftung (GmbH)' },
  { id: 'ltd', name: 'Private Limited Company (Ltd)' },
  { id: 'plc', name: 'Public Limited Company (PLC)' },
  { id: 'bv', name: 'Besloten Vennootschap (BV)' },
  { id: 'nv', name: 'Naamloze Vennootschap (NV)' },
  { id: 'other', name: 'Other' }
] as const

// Helper functions
export function getDisplayName(company: Company): string {
  return company.legal_name || company.name
}

export function isPublicCompany(company: Company): boolean {
  return company.is_public === true && !!company.stock_symbol
} 