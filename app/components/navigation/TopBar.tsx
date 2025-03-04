"use client"

import { cn } from "@/lib/utils"
import { 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight, 
  PlusCircle, 
  Filter, 
  Download, 
  Search, 
  UploadCloud 
} from "@/app/components/ui/icons"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip"
import { Button } from "../ui/button"
import { usePathname } from "next/navigation"
import { CalendarDateRangePicker } from "../ui/date-range-picker"
import { CreateSegmentDialog } from "../create-segment-dialog"
import { createSegment } from "@/app/segments/actions"
import { useRouter } from "next/navigation"
import { CreateExperimentDialog } from "@/app/components/create-experiment-dialog"
import { createExperiment, type ExperimentFormValues } from "@/app/experiments/actions"
import { UploadAssetDialog } from "@/app/components/upload-asset-dialog"
import { createAsset } from "@/app/assets/actions"
import { CreateRequirementDialog } from "@/app/components/create-requirement-dialog"
import { createRequirement } from "@/app/requirements/actions"
import { type Segment } from "@/app/requirements/types"
import { useSite } from "@/app/context/SiteContext"

interface TopBarProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  helpText?: string
  isCollapsed: boolean
  onCollapse: () => void
  segments?: Array<{
    id: string
    name: string
    description: string
  }>
}

export function TopBar({ 
  title, 
  helpText,
  isCollapsed,
  onCollapse,
  className,
  segments,
  ...props 
}: TopBarProps) {
  const pathname = usePathname()
  const isDashboardPage = pathname === "/dashboard"
  const isSegmentsPage = pathname === "/segments"
  const isExperimentsPage = pathname === "/experiments"
  const isRequirementsPage = pathname === "/requirements"
  const isLeadsPage = pathname === "/leads"
  const isAgentsPage = pathname === "/agents"
  const isAssetsPage = pathname === "/assets"
  const { currentSite } = useSite()

  const handleCreateSegment = async ({ 
    name, 
    description, 
    audience, 
    language,
    site_id 
  }: { 
    name: string
    description: string
    audience: string
    language: string
    site_id: string
  }) => {
    try {
      const result = await createSegment({ 
        name, 
        description, 
        audience, 
        language,
        site_id
      })

      if (result.error) {
        throw new Error(result.error)
      }

      // Recargar la página para mostrar el nuevo segmento
      window.location.reload()
    } catch (error) {
      console.error("Error creating segment:", error)
      throw error
    }
  }

  const handleCreateExperiment = async (values: ExperimentFormValues): Promise<{ data?: any; error?: string }> => {
    try {
      const result = await createExperiment(values)

      if (result.error) {
        return { error: result.error }
      }

      // Recargar la página para mostrar el nuevo experimento
      window.location.reload()
      return { data: result.data }
    } catch (error) {
      console.error("Error creating experiment:", error)
      return { error: error instanceof Error ? error.message : "Error inesperado" }
    }
  }

  const handleCreateRequirement = async (values: any): Promise<{ data?: any; error?: string }> => {
    try {
      const result = await createRequirement(values)

      if (result.error) {
        return { error: result.error }
      }

      // Recargar la página para mostrar el nuevo requerimiento
      window.location.reload()
      return { data: result.data }
    } catch (error) {
      console.error("Error creating requirement:", error)
      return { error: error instanceof Error ? error.message : "Error inesperado" }
    }
  }

  const handleCreateAsset = async ({ 
    name, 
    description, 
    file_path, 
    file_type,
    file_size,
    tags,
    site_id 
  }: { 
    name: string
    description?: string
    file_path: string
    file_type: string
    file_size: number
    tags: string[]
    site_id: string
  }) => {
    try {
      const result = await createAsset({ 
        name, 
        description, 
        file_path, 
        file_type,
        file_size,
        tags,
        site_id
      })

      if (result.error) {
        throw new Error(result.error)
      }

      // Recargar la página para mostrar el nuevo asset
      window.location.reload()
    } catch (error) {
      console.error("Error creating asset:", error)
      throw error
    }
  }

  return (
    <div
      className={cn(
        "flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur-sm pr-16 sticky top-0 z-10",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          className="h-8 w-8 p-0 ml-3.5"
          onClick={onCollapse}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
          <span className="sr-only">
            {isCollapsed ? "Expandir menú" : "Colapsar menú"}
          </span>
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {helpText && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                  <HelpCircle className="h-4 w-4" />
                  <span className="sr-only">Help</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" align="center">
                <p className="max-w-xs text-sm">{helpText}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="flex items-center gap-4">
        {isDashboardPage && (
          <>
            <CalendarDateRangePicker />
            <Button>Download</Button>
          </>
        )}
        {isSegmentsPage && (
          currentSite ? (
            <CreateSegmentDialog onCreateSegment={handleCreateSegment} />
          ) : (
            <Button variant="outline" disabled>
              <PlusCircle className="mr-2 h-4 w-4" />
              Seleccione un sitio
            </Button>
          )
        )}
        {isExperimentsPage && (
          currentSite ? (
            <CreateExperimentDialog 
              segments={segments || []}
              onCreateExperiment={handleCreateExperiment}
            />
          ) : (
            <Button variant="outline" disabled>
              <PlusCircle className="mr-2 h-4 w-4" />
              Seleccione un sitio
            </Button>
          )
        )}
        {isRequirementsPage && (
          currentSite ? (
            <>
              <CreateRequirementDialog 
                segments={segments || []}
                onCreateRequirement={handleCreateRequirement}
                trigger={
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Requirement
                  </Button>
                }
              />
            </>
          ) : (
            <Button variant="outline" disabled>
              <PlusCircle className="mr-2 h-4 w-4" />
              Seleccione un sitio
            </Button>
          )
        )}
        {isLeadsPage && (
          currentSite ? (
            <>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Lead
              </Button>
            </>
          ) : (
            <Button variant="outline" disabled>
              <PlusCircle className="mr-2 h-4 w-4" />
              Seleccione un sitio
            </Button>
          )
        )}
        {isAgentsPage && (
          currentSite ? (
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <PlusCircle className="mr-2 h-4 w-4" />
              Seleccione un sitio
            </Button>
          )
        )}
        {isAssetsPage && (
          currentSite ? (
            <UploadAssetDialog onUploadAsset={handleCreateAsset} />
          ) : (
            <Button variant="outline" disabled>
              <PlusCircle className="mr-2 h-4 w-4" />
              Seleccione un sitio
            </Button>
          )
        )}
      </div>
    </div>
  )
} 