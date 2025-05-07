"use client"

import { Experiment } from "../types"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Badge } from "@/app/components/ui/badge"
import {
  CalendarIcon,
  Tag,
  Users,
  Link,
  ExternalLink,
  Type,
  FileText,
  HelpCircle,
  Beaker,
  CheckSquare
} from "@/app/components/ui/icons"

interface ExperimentDetailsProps {
  experiment: Experiment
  editForm: {
    name: string
    description: string
    hypothesis: string
    validations: string
  }
  onFormChange: (field: string, value: string) => void
}

export function ExperimentDetails({
  experiment,
  editForm,
  onFormChange
}: ExperimentDetailsProps) {
  return (
    <>
      {/* Dates Section (previously part of Status) */}
      {(experiment.start_date || experiment.end_date) && (
        <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Timeline
          </h3>
          
          <div className="space-y-4">
            {experiment.start_date && (
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                  <CalendarIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Start Date</p>
                  <p className="text-sm font-medium">
                    {new Date(experiment.start_date).toLocaleDateString()} at {new Date(experiment.start_date).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            )}

            {experiment.end_date && (
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                  <CalendarIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">End Date</p>
                  <p className="text-sm font-medium">
                    {new Date(experiment.end_date).toLocaleDateString()} at {new Date(experiment.end_date).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Basic Information Section */}
      <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Basic Information
        </h3>
        
        <div className="space-y-5">
          <div className="space-y-2.5">
            <Label className="flex items-center gap-2">
              <Type className="h-4 w-4 text-muted-foreground" />
              Name
            </Label>
            <Input
              value={editForm.name}
              onChange={(e) => onFormChange('name', e.target.value)}
              placeholder="Enter experiment name"
              className="h-11"
            />
          </div>
          <div className="space-y-2.5">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Description
            </Label>
            <Textarea
              value={editForm.description}
              onChange={(e) => onFormChange('description', e.target.value)}
              placeholder="Enter description"
              className="min-h-[100px] resize-none"
            />
          </div>
          <div className="space-y-2.5">
            <Label className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              Hypothesis
            </Label>
            <Textarea
              value={editForm.hypothesis}
              onChange={(e) => onFormChange('hypothesis', e.target.value)}
              placeholder="Enter hypothesis"
              className="min-h-[100px] resize-none"
            />
          </div>
          <div className="space-y-2.5">
            <Label className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              Validations
            </Label>
            <Textarea
              value={editForm.validations}
              onChange={(e) => onFormChange('validations', e.target.value)}
              placeholder="Enter validation criteria"
              className="min-h-[100px] resize-none"
            />
          </div>
        </div>
      </div>

      {/* Metrics section */}
      <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Metrics
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Conversion</p>
              <p className="text-sm font-medium">
                {experiment.conversion !== null ? `${experiment.conversion}%` : "N/A"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">ROI</p>
              <p className="text-sm font-medium">
                {experiment.roi !== null ? `${experiment.roi}%` : "N/A"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Segments */}
      <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Segments
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Total Participants</p>
              <p className="text-sm font-medium">
                {experiment.segments.reduce((acc, segment) => acc + segment.participants, 0).toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px', marginTop: '4px' }}>
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Active Segments</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {experiment.segments.map((segment) => (
                  <Badge 
                    key={segment.id}
                    variant="secondary" 
                    className="px-3 py-1 text-xs font-medium"
                  >
                    {segment.name} ({segment.participants.toLocaleString()})
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      {experiment.preview_url && (
        <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Preview
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                <Link className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Preview URL</p>
                <a 
                  href={experiment.preview_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm font-medium text-primary hover:underline flex items-center"
                >
                  {experiment.preview_url}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>
            </div>
            
            <div className="rounded-md border overflow-hidden mt-2 h-40">
              <iframe 
                src={experiment.preview_url} 
                className="w-full h-full"
                title={`Preview of ${experiment.name}`}
                sandbox="allow-same-origin allow-scripts"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
} 