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
  leadField: keyof Lead | 'skip'
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
  { key: 'name', label: 'Name', required: true, type: 'string' },
  { key: 'email', label: 'Email', required: true, type: 'email' },
  { key: 'phone', label: 'Phone', required: false, type: 'string' },
  { key: 'company', label: 'Company', required: false, type: 'string' },
  { key: 'position', label: 'Position', required: false, type: 'string' },
  { key: 'status', label: 'Status', required: false, type: 'enum', options: ['new', 'contacted', 'qualified', 'converted', 'lost'] },
  { key: 'origin', label: 'Origin', required: false, type: 'string' },
  { key: 'notes', label: 'Notes', required: false, type: 'string' },
  { key: 'birthday', label: 'Birthday', required: false, type: 'string' },
  { key: 'language', label: 'Language', required: false, type: 'string' },
  // Address fields
  { key: 'address_street', label: 'Address - Street', required: false, type: 'string' },
  { key: 'address_city', label: 'Address - City', required: false, type: 'string' },
  { key: 'address_state', label: 'Address - State', required: false, type: 'string' },
  { key: 'address_zipcode', label: 'Address - ZIP Code', required: false, type: 'string' },
  { key: 'address_country', label: 'Address - Country', required: false, type: 'string' },
  // Social networks
  { key: 'social_linkedin', label: 'LinkedIn', required: false, type: 'string' },
  { key: 'social_twitter', label: 'Twitter', required: false, type: 'string' },
  { key: 'social_facebook', label: 'Facebook', required: false, type: 'string' },
  { key: 'social_instagram', label: 'Instagram', required: false, type: 'string' },
  { key: 'social_tiktok', label: 'TikTok', required: false, type: 'string' },
  { key: 'social_youtube', label: 'YouTube', required: false, type: 'string' },
  { key: 'social_whatsapp', label: 'WhatsApp', required: false, type: 'string' },
  { key: 'social_pinterest', label: 'Pinterest', required: false, type: 'string' }
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
        Position: 'Marketing Manager',
        Status: 'new',
        Origin: 'website',
        Notes: 'Interested in our services',
        Birthday: '1985-06-15',
        Language: 'English',
        'Address - Street': '123 Main St',
        'Address - City': 'New York',
        'Address - State': 'NY',
        'Address - ZIP Code': '10001',
        'Address - Country': 'USA',
        LinkedIn: 'https://linkedin.com/in/johndoe',
        Twitter: '@johndoe',
        Facebook: 'https://facebook.com/johndoe',
        Instagram: '@johndoe_official',
        TikTok: '@johndoe_tiktok',
        YouTube: 'https://youtube.com/c/johndoe',
        WhatsApp: '+1234567890',
        Pinterest: 'https://pinterest.com/johndoe'
      },
      {
        Name: 'Jane Smith',
        Email: 'jane.smith@company.com',
        Phone: '+0987654321',
        Company: 'Tech Solutions',
        Position: 'CEO',
        Status: 'contacted',
        Origin: 'referral',
        Notes: 'Scheduled demo call',
        Birthday: '1990-12-03',
        Language: 'Spanish',
        'Address - Street': '456 Oak Ave',
        'Address - City': 'Los Angeles',
        'Address - State': 'CA',
        'Address - ZIP Code': '90210',
        'Address - Country': 'USA',
        LinkedIn: 'https://linkedin.com/in/janesmith',
        Twitter: '@janesmith_ceo',
        Facebook: '',
        Instagram: '@jane.smith.business',
        TikTok: '',
        YouTube: '',
        WhatsApp: '+0987654321',
        Pinterest: ''
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
        const lowercaseField = csvField.toLowerCase()
        let leadField: keyof Lead | 'skip' = 'skip'
        
        LEAD_FIELDS.forEach(field => {
          if (lowercaseField.includes(field.key) || field.key.includes(lowercaseField)) {
            leadField = field.key as keyof Lead
          }
        })
        
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

  const updateFieldMapping = (csvField: string, leadField: keyof Lead | 'skip') => {
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
        
        fieldMappings.forEach(mapping => {
          if (mapping.leadField !== 'skip') {
            const value = row[mapping.csvField]
            if (value !== undefined && value !== '') {
              // Handle company field
              if (mapping.leadField === 'company' && typeof value === 'string') {
                lead.company = { name: value }
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
        
        // Set address object if any address fields were mapped
        if (Object.keys(address).length > 0) {
          lead.address = address
        }
        
        // Set social networks object if any social fields were mapped
        if (Object.keys(socialNetworks).length > 0) {
          lead.social_networks = socialNetworks
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
                  Map your CSV columns to lead fields. Required fields are marked with an asterisk.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {fieldMappings.map((mapping, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="flex-1">
                        <Badge variant="outline">{mapping.csvField}</Badge>
                      </div>
                      <div className="flex-1">
                        <Select
                          value={mapping.leadField}
                          onValueChange={(value) => updateFieldMapping(mapping.csvField, value as keyof Lead | 'skip')}
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