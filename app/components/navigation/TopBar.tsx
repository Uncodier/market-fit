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

interface TopBarProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  helpText?: string
  isCollapsed: boolean
  onCollapse: () => void
}

export function TopBar({ 
  title, 
  helpText,
  isCollapsed,
  onCollapse,
  className,
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

  return (
    <div
      className={cn(
        "flex h-16 items-center justify-between border-b bg-[#f3f3f3ed] backdrop-blur-sm pr-16 sticky top-0 z-10",
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
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Segment
          </Button>
        )}
        {isExperimentsPage && (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Experiment
          </Button>
        )}
        {isRequirementsPage && (
          <>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Requirement
            </Button>
          </>
        )}
        {isLeadsPage && (
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
        )}
        {isAgentsPage && (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Agent
          </Button>
        )}
        {isAssetsPage && (
          <Button>
            <UploadCloud className="mr-2 h-4 w-4" />
            Upload Asset
          </Button>
        )}
      </div>
    </div>
  )
} 