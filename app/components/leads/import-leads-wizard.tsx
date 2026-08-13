"use client"

import { Button } from "@/app/components/ui/button"
import { UploadCloud, Download, FileText, Check, AlertCircle } from "@/app/components/ui/icons"
import {
  DialogBody,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Progress } from "@/app/components/ui/progress"
import { Alert, AlertDescription } from "@/app/components/ui/alert"
import { Switch } from "@/app/components/ui/switch"
import {
  IMPORT_STEPS,
  LEAD_FIELDS,
  generateSampleFile,
  type FieldMapping,
  type ImportError,
  type ImportStep,
} from "./import-leads-shared"

interface ImportLeadsWizardProps {
  currentStep: ImportStep["id"]
  setCurrentStep: (step: ImportStep["id"]) => void
  getStepStatus: (stepId: ImportStep["id"]) => "completed" | "current" | "upcoming"
  isProcessing: boolean
  progress: number
  file: File | null
  rawData: any[]
  csvFields: string[]
  validationErrors: ImportError[]
  fieldMappings: FieldMapping[]
  hideSkipped: boolean
  setHideSkipped: (v: boolean) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleFileSelect: (file: File) => void
  updateFieldMapping: (csvField: string, leadField: string | "skip") => void
  validateData: () => void
  handleImport: () => void
}

export function ImportLeadsWizard({
  currentStep,
  setCurrentStep,
  getStepStatus,
  isProcessing,
  progress,
  file,
  rawData,
  csvFields,
  validationErrors,
  fieldMappings,
  hideSkipped,
  setHideSkipped,
  fileInputRef,
  handleFileSelect,
  updateFieldMapping,
  validateData,
  handleImport,
}: ImportLeadsWizardProps) {
  return (
    <div
      data-slot="dialog-form"
      className="flex min-h-0 max-h-[inherit] flex-1 flex-col overflow-hidden"
    >
        <DialogHeader>
          <DialogTitle>Import Leads</DialogTitle>
          <DialogDescription>
            Import leads from CSV, JSON, or Excel files. Download a sample file to get started.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {IMPORT_STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex items-center">
                <div className={`w-8 h-8 min-w-[2rem] min-h-[2rem] rounded-full font-inter flex items-center justify-center border-2 flex-shrink-0 ${
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

        </DialogBody>
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
    </div>
  )
}
