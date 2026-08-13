"use client"

export interface ImportStep {
  id: 'upload' | 'validate' | 'map' | 'import'
  name: string
  description: string
}

export interface FieldMapping {
  csvField: string
  leadField: string | 'skip'
  required: boolean
}

export interface ImportError {
  row: number
  field: string
  value: any
  error: string
}

export const IMPORT_STEPS: ImportStep[] = [
  { id: 'upload', name: 'Upload File', description: 'Select your CSV, JSON, or Excel file' },
  { id: 'validate', name: 'Validate Data', description: 'Check for errors and missing data' },
  { id: 'map', name: 'Map Fields', description: 'Match your columns to lead fields' },
  { id: 'import', name: 'Import', description: 'Import your leads into the system' }
]

export const LEAD_FIELDS = [
  { key: 'name', label: 'Name', required: false, type: 'string' },
  { key: 'email', label: 'Email', required: false, type: 'email' },
  { key: 'personal_email', label: 'Personal Email', required: false, type: 'email' },
  { key: 'phone', label: 'Phone', required: false, type: 'string' },
  { key: 'company', label: 'Company (Name)', required: false, type: 'string' },
  { key: 'company_name', label: 'Company - Name', required: false, type: 'string' },
  { key: 'company_website', label: 'Company - Website', required: false, type: 'string' },
  { key: 'company_industry', label: 'Company - Industry', required: false, type: 'string' },
  { key: 'company_size', label: 'Company - Size', required: false, type: 'string' },
  { key: 'company_description', label: 'Company - Description', required: false, type: 'string' },
  // Company address (DB structure)
  { key: 'company_address_street', label: 'Company Address - Street', required: false, type: 'string' },
  { key: 'company_address_external_number', label: 'Company Address - External Number', required: false, type: 'string' },
  { key: 'company_address_internal_number', label: 'Company Address - Internal Number', required: false, type: 'string' },
  { key: 'company_address_city', label: 'Company Address - City', required: false, type: 'string' },
  { key: 'company_address_state', label: 'Company Address - State', required: false, type: 'string' },
  { key: 'company_address_zip', label: 'Company Address - ZIP', required: false, type: 'string' },
  { key: 'company_address_country', label: 'Company Address - Country', required: false, type: 'string' },
  { key: 'company_address_full_address', label: 'Company Address - Full Address', required: false, type: 'string' },
  { key: 'position', label: 'Position', required: false, type: 'string' },
  { key: 'status', label: 'Status', required: false, type: 'enum', options: ['new', 'contacted', 'qualified', 'converted', 'lost'] },
  { key: 'origin', label: 'Origin', required: false, type: 'string' },
  { key: 'notes', label: 'Notes', required: false, type: 'string' },
  { key: 'birthday', label: 'Birthday', required: false, type: 'string' },
  { key: 'language', label: 'Language', required: false, type: 'string' },
  // Address fields (DB structure)
  { key: 'address_street', label: 'Address - Street', required: false, type: 'string' },
  { key: 'address_external_number', label: 'Address - External Number', required: false, type: 'string' },
  { key: 'address_internal_number', label: 'Address - Internal Number', required: false, type: 'string' },
  { key: 'address_city', label: 'Address - City', required: false, type: 'string' },
  { key: 'address_state', label: 'Address - State', required: false, type: 'string' },
  { key: 'address_zip', label: 'Address - ZIP', required: false, type: 'string' },
  { key: 'address_country', label: 'Address - Country', required: false, type: 'string' },
  { key: 'address_full_address', label: 'Address - Full Address', required: false, type: 'string' },
  // Social networks (only those documented in sub_structures.md)
  { key: 'social_linkedin', label: 'LinkedIn', required: false, type: 'string' },
  { key: 'social_twitter', label: 'Twitter', required: false, type: 'string' },
  { key: 'social_facebook', label: 'Facebook', required: false, type: 'string' },
  { key: 'social_instagram', label: 'Instagram', required: false, type: 'string' },
  { key: 'social_youtube', label: 'YouTube', required: false, type: 'string' },
  { key: 'social_github', label: 'GitHub', required: false, type: 'string' },
  { key: 'social_website', label: 'Website', required: false, type: 'string' }
] as const

export function generateSampleFile(format: 'csv' | 'excel' | 'json') {
  const sampleData = [
    {
      Name: 'John Doe',
      Email: 'john.doe@example.com',
      Phone: '+1234567890',
      Company: 'Acme Corp',
      'Company - Website': 'https://acme.com',
      'Company - Industry': 'Technology',
      'Company - Size': '11-50',
      'Company Address - Street': 'Sur 113-B, Juventino Rosas, Iztacalco',
      'Company Address - External Number': '2183',
      'Company Address - Internal Number': 'B',
      'Company Address - City': 'Ciudad de México',
      'Company Address - State': 'CDMX',
      'Company Address - ZIP': '08700',
      'Company Address - Country': 'Mexico',
      Position: 'Marketing Manager',
      Status: 'new',
      Origin: 'website',
      Notes: 'Interested in our services',
      Birthday: '1985-06-15',
      Language: 'English',
      'Address - Street': '123 Main St',
      'Address - External Number': '123',
      'Address - Internal Number': 'A',
      'Address - City': 'New York',
      'Address - State': 'NY',
      'Address - ZIP': '10001',
      'Address - Country': 'USA',
      LinkedIn: 'https://linkedin.com/in/johndoe',
      Twitter: '@johndoe',
      Facebook: 'https://facebook.com/johndoe',
      Instagram: '@johndoe_official',
      YouTube: 'https://youtube.com/c/johndoe',
      GitHub: 'https://github.com/johndoe',
      Website: 'https://johndoe.com'
    },
    {
      Name: 'Jane Smith',
      Email: 'jane.smith@company.com',
      Phone: '+0987654321',
      Company: 'Tech Solutions',
      'Company - Website': 'https://techsolutions.com',
      'Company - Industry': 'Software',
      'Company - Size': '51-200',
      'Company Address - Street': 'Av. Reforma',
      'Company Address - External Number': '456',
      'Company Address - Internal Number': '12B',
      'Company Address - City': 'Los Angeles',
      'Company Address - State': 'CA',
      'Company Address - ZIP': '90210',
      'Company Address - Country': 'USA',
      Position: 'CEO',
      Status: 'contacted',
      Origin: 'referral',
      Notes: 'Scheduled demo call',
      Birthday: '1990-12-03',
      Language: 'Spanish',
      'Address - Street': '456 Oak Ave',
      'Address - External Number': '456',
      'Address - Internal Number': '12B',
      'Address - City': 'Los Angeles',
      'Address - State': 'CA',
      'Address - ZIP': '90210',
      'Address - Country': 'USA',
      LinkedIn: 'https://linkedin.com/in/janesmith',
      Twitter: '@janesmith_ceo',
      Facebook: '',
      Instagram: '@jane.smith.business',
      YouTube: '',
      GitHub: 'https://github.com/janesmith',
      Website: 'https://janesmith.dev'
    }
  ]

  if (format === 'csv') {
    const headers = Object.keys(sampleData[0])
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => headers.map(header => `"${row[header as keyof typeof row] || ''}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads-sample.csv'
    a.click()
    URL.revokeObjectURL(url)
  } else if (format === 'excel') {
    // Create a simple CSV for Excel format as well, since it's more secure
    const headers = Object.keys(sampleData[0])
    const csvContent = [
      headers.join('\t'), // Use tabs for better Excel compatibility
      ...sampleData.map(row => headers.map(header => row[header as keyof typeof row] || '').join('\t'))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads-sample.xls'
    a.click()
    URL.revokeObjectURL(url)
  } else if (format === 'json') {
    const jsonContent = JSON.stringify(sampleData, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads-sample.json'
    a.click()
    URL.revokeObjectURL(url)
  }
}
