"use client"

import { useState, useRef } from "react"
import { Button } from "@/app/components/ui/button"
import { UploadCloud } from "@/app/components/ui/icons"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/app/components/ui/dialog"
import { Lead } from "@/app/leads/types"
import { toast } from "sonner"
import Papa from 'papaparse'
import readXlsxFile from 'read-excel-file'
import {
  IMPORT_STEPS,
  LEAD_FIELDS,
  type FieldMapping,
  type ImportError,
  type ImportStep,
} from "./import-leads-shared"
import { ImportLeadsWizard } from "./import-leads-wizard"

interface ImportLeadsDialogProps {
  segments?: Array<{
    id: string
    name: string
  }>
  onImportLeads: (leads: Partial<Lead>[]) => Promise<{ success: boolean; count?: number; errors?: string[] }>
  trigger?: React.ReactNode
}

export function ImportLeadsDialog({ onImportLeads, trigger }: ImportLeadsDialogProps) {
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
        if (result.errors && result.errors.length > 0) {
          // Warning toast is handled by parent, just close dialog
          setIsOpen(false)
          resetDialog()
        } else {
          toast.success(`Successfully imported ${result.count} leads`)
          setIsOpen(false)
          resetDialog()
        }
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
          <Button>
            <UploadCloud className="mr-2 h-4 w-4" />
            Import Leads
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="xl" busy={isProcessing}>
        <ImportLeadsWizard
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          getStepStatus={getStepStatus}
          isProcessing={isProcessing}
          progress={progress}
          file={file}
          rawData={rawData}
          csvFields={csvFields}
          validationErrors={validationErrors}
          fieldMappings={fieldMappings}
          hideSkipped={hideSkipped}
          setHideSkipped={setHideSkipped}
          fileInputRef={fileInputRef}
          handleFileSelect={handleFileSelect}
          updateFieldMapping={updateFieldMapping}
          validateData={validateData}
          handleImport={handleImport}
        />
      </DialogContent>
    </Dialog>
  )
}
