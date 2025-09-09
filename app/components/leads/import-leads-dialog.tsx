"use client"

import { useState, useRef } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { UploadCloud, Download, FileText, X, Check, AlertCircle } from "@/app/components/ui/icons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/app/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Separator } from "@/app/components/ui/separator"
import { Progress } from "@/app/components/ui/progress"
import { Alert, AlertDescription } from "@/app/components/ui/alert"
import { Lead } from "@/app/leads/types"
import { toast } from "sonner"
import Papa from 'papaparse'
import readXlsxFile from 'read-excel-file'
import { Switch } from "@/app/components/ui/switch"

interface ImportLeadsDialogProps {
  segments?: Array<{
    id: string
    name: string
  }>
  onImportLeads: (leads: Partial<Lead>[]) => Promise<{ success: boolean; count?: number; errors?: string[] }>
  trigger?: React.ReactNode
}

interface ImportStep {
  id: 'upload' | 'validate' | 'map' | 'import'
  name: string
  description: string
}

interface FieldMapping {
  csvField: string
  leadField: string | 'skip'
  required: boolean
}

interface ImportError {
  row: number
  field: string
  value: any
  error: string
}

const IMPORT_STEPS: ImportStep[] = [
  { id: 'upload', name: 'Upload File', description: 'Select your CSV, JSON, or Excel file' },
  { id: 'validate', name: 'Validate Data', description: 'Check for errors and missing data' },
  { id: 'map', name: 'Map Fields', description: 'Match your columns to lead fields' },
  { id: 'import', name: 'Import', description: 'Import your leads into the system' }
]

const LEAD_FIELDS = [
  { key: 'name', label: 'Name', required: false, type: 'string' },
  { key: 'email', label: 'Email', required: false, type: 'email' },
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

export function ImportLeadsDialog({ segments = [], onImportLeads, trigger }: ImportLeadsDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState<ImportStep['id']>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [rawData, setRawData] = useState<any[]>([])
  const [csvFields, setCsvFields] = useState<string[]>([])
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([])
  const [validationErrors, setValidationErrors] = useState<ImportError[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [hideSkipped, setHideSkipped] = useState(true)

  const resetDialog = () => {
    setCurrentStep('upload')
    setFile(null)
    setRawData([])
    setCsvFields([])
    setFieldMappings([])
    setValidationErrors([])
    setIsProcessing(false)
    setProgress(0)
  }

  const generateSampleFile = (format: 'csv' | 'excel' | 'json') => {
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

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setIsProcessing(true)
    setProgress(20)

    try {
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase()
      let data: any[] = []
      
      if (fileExtension === 'csv') {
        const text = await selectedFile.text()
        const result = Papa.parse(text, { header: true, skipEmptyLines: true })
        data = result.data
      } else if (fileExtension === 'json') {
        const text = await selectedFile.text()
        data = JSON.parse(text)
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const rows = await readXlsxFile(selectedFile)
        if (rows.length > 0) {
          const headers = rows[0] as string[]
          data = rows.slice(1).map(row => {
            const obj: any = {}
            headers.forEach((header, index) => {
              obj[header] = row[index] || ''
            })
            return obj
          })
        }
      } else {
        throw new Error('Unsupported file format. Please use CSV, JSON, or Excel files.')
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No data found in file')
      }

      setRawData(data)
      const fields = Object.keys(data[0] || {})
      setCsvFields(fields)
      
      // Auto-map fields with similar names
      const autoMappings: FieldMapping[] = fields.map(csvField => {
        const lowercaseField = csvField.toLowerCase().trim()
        let leadField: string | 'skip' = 'skip'

        // Email synonyms mapping
        const emailSynonyms = ['email', 'e-mail', 'correo', 'correo electrónico', 'correo electronico', 'mail']
        // Name synonyms (skip first/display, map only canonical name/"contact name")
        const firstNameSynonyms = ['first name', 'firstname', 'first_name', 'nombre']
        const displayNameSynonyms = ['display name', 'displayname']
        const contactNameSynonyms = ['contact name', 'contactname']
        // Last name synonyms
        const lastNameSynonyms = ['last name', 'lastname', 'last_name', 'apellido', 'apellidos']
        // Address synonyms
        const zipSynonyms = ['zip', 'zipcode', 'zip code', 'postal', 'postal code', 'código postal', 'codigo postal', 'cp']
        const street2Synonyms = ['street 2','street2','address 2','address2','address line 2','line 2','line2','billing street2','shipping street2','street line 2','st2']
        const externalNumSynonyms = ['external number', 'ext number', 'num ext', 'no exterior', 'número exterior', 'numero exterior', 'exterior']
        const internalNumSynonyms = ['internal number', 'int number', 'num int', 'no interior', 'número interior', 'numero interior', 'interior', 'apt', 'apartment', 'suite']
        const fullAddressSynonyms = ['full address', 'dirección completa', 'direccion completa']
        const billingOrShippingAddressSynonyms = ['billing address', 'shipping address']
        const streetSynonyms = ['street', 'address', 'address line 1', 'address1', 'calle']
        // Company synonyms
        const companyNameSynonyms = ['company name', 'empresa', 'compañía', 'compania']
        const companyWebsiteSynonyms = ['company website', 'website empresa', 'empresa website', 'website']
        const companyIndustrySynonyms = ['company industry', 'industria empresa', 'industry']
        const companySizeSynonyms = ['company size', 'tamaño empresa', 'tamano empresa', 'size empresa']
        const companyDescriptionSynonyms = ['company description', 'descripción empresa', 'descripcion empresa']
        // Company address synonyms
        const companyFullAddressSynonyms = ['company address', 'company full address', 'dirección empresa', 'direccion empresa']
        const companyStreetSynonyms = ['company street', 'company address line 1', 'company address1']
        const companyZipSynonyms = ['company zip', 'company zipcode', 'company postal', 'company postal code']
        const companyExternalNumSynonyms = ['company external number', 'company ext number', 'empresa no exterior']
        const companyInternalNumSynonyms = ['company internal number', 'company int number', 'empresa no interior']
        const companyCitySynonyms = ['company city']
        const companyStateSynonyms = ['company state', 'company province', 'company region']
        const companyCountrySynonyms = ['company country']
        // Social synonyms
        const githubSynonyms = ['github']
        const websiteSynonyms = ['website', 'site', 'url']

        if (emailSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'email'
        } else if (contactNameSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'name'
        } else if (firstNameSynonyms.some(s => lowercaseField.includes(s))) {
          // Skip explicit first-name columns
          leadField = 'skip'
        } else if (displayNameSynonyms.some(s => lowercaseField.includes(s))) {
          // Skip display-name columns
          leadField = 'skip'
        } else if (lastNameSynonyms.some(s => lowercaseField.includes(s))) {
          // We will handle last name concatenation during import
          leadField = 'skip'
        } else if (zipSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'address_zip'
        } else if (street2Synonyms.some(s => lowercaseField.includes(s))) {
          // We do not store street 2; skip
          leadField = 'skip'
        } else if (externalNumSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'address_external_number'
        } else if (internalNumSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'address_internal_number'
        } else if (billingOrShippingAddressSynonyms.some(s => lowercaseField.includes(s))) {
          // We don't store separate billing/shipping addresses; skip
          leadField = 'skip'
        } else if (fullAddressSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'address_full_address'
        } else if (streetSynonyms.some(s => lowercaseField === s || lowercaseField.includes(s))) {
          leadField = 'address_street'
        } else if (companyNameSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'company_name'
        } else if (companyWebsiteSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'company_website'
        } else if (companyIndustrySynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'company_industry'
        } else if (companySizeSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'company_size'
        } else if (companyDescriptionSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'company_description'
        } else if (companyFullAddressSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'company_address_full_address'
        } else if (companyStreetSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'company_address_street'
        } else if (companyZipSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'company_address_zip'
        } else if (companyExternalNumSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'company_address_external_number'
        } else if (companyInternalNumSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'company_address_internal_number'
        } else if (companyCitySynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'company_address_city'
        } else if (companyStateSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'company_address_state'
        } else if (companyCountrySynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'company_address_country'
        } else if (githubSynonyms.some(s => lowercaseField.includes(s))) {
          leadField = 'social_github'
        } else if (websiteSynonyms.some(s => lowercaseField === s || lowercaseField.includes(s))) {
          leadField = 'social_website'
        } else {
        LEAD_FIELDS.forEach(field => {
            if (lowercaseField.includes(String(field.key)) || String(field.key).includes(lowercaseField)) {
              leadField = field.key as string
          }
        })
        }
        
        return {
          csvField,
          leadField,
          required: LEAD_FIELDS.find(f => f.key === leadField)?.required || false
        }
      })
      
      setFieldMappings(autoMappings)
      setProgress(100)
      setCurrentStep('validate')
      
    } catch (error) {
      console.error('Error processing file:', error)
      toast.error(error instanceof Error ? error.message : 'Error processing file')
    } finally {
      setIsProcessing(false)
    }
  }



  const validateData = () => {
    const errors: ImportError[] = []
    const mappedFields = fieldMappings.filter(m => m.leadField !== 'skip')
    
    rawData.forEach((row, index) => {
      mappedFields.forEach(mapping => {
        const value = row[mapping.csvField]
        const fieldConfig = LEAD_FIELDS.find(f => f.key === mapping.leadField)
        
        if (fieldConfig?.required && (!value || value.toString().trim() === '')) {
          errors.push({
            row: index + 1,
            field: mapping.csvField,
            value,
            error: `${fieldConfig.label} is required`
          })
        }
        
        if (fieldConfig?.type === 'email' && value && !isValidEmail(value)) {
          errors.push({
            row: index + 1,
            field: mapping.csvField,
            value,
            error: 'Invalid email format'
          })
        }
        
        if (fieldConfig?.type === 'enum' && value && !fieldConfig.options?.includes(value)) {
          errors.push({
            row: index + 1,
            field: mapping.csvField,
            value,
            error: `Invalid value. Must be one of: ${fieldConfig.options?.join(', ')}`
          })
        }
      })

      // Row-level minimum requirement: Email or Phone must be present
      const emailMapping = fieldMappings.find(m => m.leadField === 'email')
      const phoneMapping = fieldMappings.find(m => m.leadField === 'phone')
      const emailValue = emailMapping ? row[emailMapping.csvField] : undefined
      const phoneValue = phoneMapping ? row[phoneMapping.csvField] : undefined
      const hasEmail = emailValue && String(emailValue).trim() !== ''
      const hasPhone = phoneValue && String(phoneValue).trim() !== ''
      
      if (!hasEmail && !hasPhone) {
        errors.push({
          row: index + 1,
          field: emailMapping?.csvField || phoneMapping?.csvField || 'email/phone',
          value: '',
          error: 'Email or Phone is required'
        })
      }

      if (hasEmail && !isValidEmail(String(emailValue))) {
        errors.push({
          row: index + 1,
          field: emailMapping?.csvField || 'email',
          value: emailValue,
          error: 'Invalid email format'
        })
      }
    })
    
    setValidationErrors(errors)
    if (errors.length === 0) {
      setCurrentStep('map')
    }
  }

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const updateFieldMapping = (csvField: string, leadField: string | 'skip') => {
    setFieldMappings(prev => 
      prev.map(mapping => 
        mapping.csvField === csvField 
          ? { ...mapping, leadField, required: LEAD_FIELDS.find(f => f.key === leadField)?.required || false }
          : mapping
      )
    )
  }

  const handleImport = async () => {
    setIsProcessing(true)
    setProgress(0)
    
    try {
      const mappedLeads = rawData.map(row => {
        const lead: Partial<Lead> = {}
        const address: any = {}
        const socialNetworks: any = {}
        const companyObj: any = {}
        const companyAddress: any = {}
        
        fieldMappings.forEach(mapping => {
          if (mapping.leadField !== 'skip') {
            const value = row[mapping.csvField]
            if (value !== undefined && value !== '') {
              // Handle company fields
              if (mapping.leadField === 'company' && typeof value === 'string') {
                companyObj.name = value
              }
              else if (String(mapping.leadField).startsWith('company_address_')) {
                const key = String(mapping.leadField).replace('company_address_', '')
                companyAddress[key] = value
              }
              else if (String(mapping.leadField).startsWith('company_')) {
                const companyField = String(mapping.leadField).replace('company_', '')
                companyObj[companyField] = value
              }
              // Handle address fields
              else if (mapping.leadField.startsWith('address_')) {
                const addressField = mapping.leadField.replace('address_', '')
                address[addressField] = value
              }
              // Handle social network fields
              else if (mapping.leadField.startsWith('social_')) {
                const socialField = mapping.leadField.replace('social_', '')
                socialNetworks[socialField] = value
              }
              // Handle regular fields
              else {
                ;(lead as any)[mapping.leadField] = value
              }
            }
          }
        })

        // Attach company address if present
        if (Object.keys(companyAddress).length > 0) {
          companyObj.address = companyAddress
        }
        
        // Combine first/last name into name if needed (even if those columns were skipped)
        const lowerKeys = Object.keys(row).reduce((acc: Record<string,string>, k) => {
          acc[k.toLowerCase()] = k
          return acc
        }, {})
        const firstNameKey = Object.keys(lowerKeys).find(k => ['first name','firstname','first_name','nombre'].some(s => k.includes(s)))
        const lastNameKey = Object.keys(lowerKeys).find(k => ['last name','lastname','last_name','apellido','apellidos'].some(s => k.includes(s)))
        const first = firstNameKey ? row[lowerKeys[firstNameKey]] : undefined
        const last = lastNameKey ? row[lowerKeys[lastNameKey]] : undefined
        if (!lead.name && (first || last)) {
          const parts = [first, last].filter(Boolean)
          if (parts.length > 0) {
            lead.name = parts.join(' ')
          }
        } else if (lead.name && last && typeof lead.name === 'string' && !lead.name.toLowerCase().includes(String(last).toLowerCase())) {
          lead.name = `${lead.name} ${last}`
        }
        
        // Set address object if any address fields were mapped
        if (Object.keys(address).length > 0) {
          lead.address = address
        }
        
        // Set social networks object if any social fields were mapped
        if (Object.keys(socialNetworks).length > 0) {
          lead.social_networks = socialNetworks
        }

        // Attach company object if any company fields were mapped
        if (Object.keys(companyObj).length > 0) {
          lead.company = companyObj
        }
        
        // Set default status if not provided
        if (!lead.status) {
          lead.status = 'new'
        }
        
        return lead
      })
      
      setProgress(50)
      
      const result = await onImportLeads(mappedLeads)
      
      setProgress(100)
      
      if (result.success) {
        toast.success(`Successfully imported ${result.count} leads`)
        setIsOpen(false)
        resetDialog()
      } else {
        toast.error('Import failed: ' + (result.errors?.join(', ') || 'Unknown error'))
      }
      
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Failed to import leads')
    } finally {
      setIsProcessing(false)
    }
  }

  const getStepStatus = (stepId: ImportStep['id']) => {
    const stepIndex = IMPORT_STEPS.findIndex(s => s.id === stepId)
    const currentIndex = IMPORT_STEPS.findIndex(s => s.id === currentStep)
    
    if (stepIndex < currentIndex) return 'completed'
    if (stepIndex === currentIndex) return 'current'
    return 'upcoming'
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) resetDialog()
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <UploadCloud className="mr-2 h-4 w-4" />
            Import Leads
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Leads</DialogTitle>
          <DialogDescription>
            Import leads from CSV, JSON, or Excel files. Download a sample file to get started.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {IMPORT_STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex items-center">
                <div className={`w-8 h-8 min-w-[2rem] min-h-[2rem] rounded-full flex items-center justify-center border-2 flex-shrink-0 ${
                  getStepStatus(step.id) === 'completed' 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : getStepStatus(step.id) === 'current'
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-gray-100 border-gray-300 text-gray-500'
                }`}>
                  {getStepStatus(step.id) === 'completed' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <div className="ml-3 min-w-0">
                  <p className={`text-sm font-medium ${
                    getStepStatus(step.id) === 'current' ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {step.name}
                  </p>
                  <p className="text-xs text-gray-500">{step.description}</p>
                </div>
              </div>
              {index < IMPORT_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  getStepStatus(IMPORT_STEPS[index + 1].id) === 'completed' 
                    ? 'bg-green-500' 
                    : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {isProcessing && (
          <div className="mb-4">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-gray-600 mt-1">Processing...</p>
          </div>
        )}

        {/* Step Content */}
        {currentStep === 'upload' && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => generateSampleFile('csv')}
              >
                <Download className="mr-2 h-4 w-4" />
                CSV Sample
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => generateSampleFile('excel')}
              >
                <Download className="mr-2 h-4 w-4" />
                Excel Sample
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => generateSampleFile('json')}
              >
                <Download className="mr-2 h-4 w-4" />
                JSON Sample
              </Button>
            </div>
            
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 cursor-pointer transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={(e) => {
                e.preventDefault()
                const files = Array.from(e.dataTransfer.files)
                if (files[0]) handleFileSelect(files[0])
              }}
              onDragOver={(e) => e.preventDefault()}
            >
              <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-medium">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">CSV, JSON, or Excel files up to 10MB</p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,.xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file)
              }}
              className="hidden"
            />
            
            {file && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div className="ml-3">
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • {rawData.length} rows
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {currentStep === 'validate' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Data Validation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <span>Total rows: {rawData.length}</span>
                  <span>Fields detected: {csvFields.length}</span>
                </div>
                
                {validationErrors.length > 0 ? (
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Found {validationErrors.length} validation errors. Please fix them before proceeding.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="mb-4">
                    <Check className="h-4 w-4" />
                    <AlertDescription>
                      All data validated successfully!
                    </AlertDescription>
                  </Alert>
                )}
                
                {validationErrors.length > 0 && (
                  <div className="max-h-40 overflow-y-auto">
                    {validationErrors.slice(0, 10).map((error, index) => (
                      <div key={index} className="text-sm text-red-600 mb-1">
                        Row {error.row}: {error.error} (Field: {error.field}, Value: "{error.value}")
                      </div>
                    ))}
                    {validationErrors.length > 10 && (
                      <p className="text-sm text-gray-500">
                        ... and {validationErrors.length - 10} more errors
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 'map' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Field Mapping</CardTitle>
                <p className="text-sm text-gray-600">
                  Map your CSV columns to lead fields. Required fields are marked with an asterisk. Left side shows your file columns; right side select the target Lead/Company field.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-gray-600">
                    {fieldMappings.filter(m => m.leadField !== 'skip').length} mappable columns
                    {fieldMappings.filter(m => m.leadField === 'skip').length > 0 && (
                      <span className="ml-2 text-gray-500">
                        ({fieldMappings.filter(m => m.leadField === 'skip').length} auto-skipped)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Hide skipped columns</span>
                    <Switch checked={hideSkipped} onCheckedChange={setHideSkipped} />
                  </div>
                </div>
                <div className="space-y-3">
                  {(hideSkipped ? fieldMappings.filter(m => m.leadField !== 'skip') : fieldMappings).map((mapping, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="flex-1">
                        <Badge variant="outline">{mapping.csvField}</Badge>
                      </div>
                      <div className="flex-1">
                        <Select
                          value={mapping.leadField}
                          onValueChange={(value) => updateFieldMapping(mapping.csvField, value as string | 'skip')}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">Skip this field</SelectItem>
                            {LEAD_FIELDS.map(field => (
                              <SelectItem key={field.key} value={field.key}>
                                {field.label}{field.required ? ' *' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 'import' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ready to Import</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p>File: {file?.name}</p>
                  <p>Total leads: {rawData.length}</p>
                  <p>Mapped fields: {fieldMappings.filter(m => m.leadField !== 'skip').length}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter className="gap-2">
          {currentStep !== 'upload' && (
            <Button 
              variant="outline" 
              onClick={() => {
                const stepIndex = IMPORT_STEPS.findIndex(s => s.id === currentStep)
                if (stepIndex > 0) {
                  setCurrentStep(IMPORT_STEPS[stepIndex - 1].id)
                }
              }}
              disabled={isProcessing}
            >
              Previous
            </Button>
          )}
          
          {currentStep === 'upload' && file && (
            <Button onClick={validateData} disabled={isProcessing}>
              Next: Validate
            </Button>
          )}
          
          {currentStep === 'validate' && validationErrors.length === 0 && (
            <Button onClick={() => setCurrentStep('map')} disabled={isProcessing}>
              Next: Map Fields
            </Button>
          )}
          
          {currentStep === 'validate' && validationErrors.length > 0 && (
            <Button onClick={validateData} disabled={isProcessing}>
              Re-validate
            </Button>
          )}
          
          {currentStep === 'map' && (
            <Button onClick={() => setCurrentStep('import')} disabled={isProcessing}>
              Next: Import
            </Button>
          )}
          
          {currentStep === 'import' && (
            <Button onClick={handleImport} disabled={isProcessing}>
              Import Leads
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 