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

  const canCreateContent = !!currentSite

  return (
    <div
      className={cn(
        "flex h-16 items-center justify-between border-b bg-[#f3f3f3ed] backdrop-blur-sm pr-16 sticky top-0 z-[200]",
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
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {helpText && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="inline-flex items-center justify-center rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500">
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
          canCreateContent ? (
            <CreateSegmentDialog onCreateSegment={handleCreateSegment} />
          ) : (
            <Button variant="outline" disabled>
              <PlusCircle className="mr-2 h-4 w-4" />
              Seleccione un sitio
            </Button>
          )
        )}
        {isExperimentsPage && (
          canCreateContent ? (
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
          canCreateContent ? (
            <>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
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
          canCreateContent ? (
            <>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
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
          canCreateContent ? (
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
          canCreateContent ? (
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