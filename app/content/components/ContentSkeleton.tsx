"use client"

import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Badge } from "@/app/components/ui/badge"
import {
  FileText, Filter, PlayCircle, Mail, BarChart, LayoutGrid, MessageSquare, FileVideo, Globe,
  PenSquare, Users, RotateCcw, CalendarIcon, Eye, ChevronLeft, ChevronRight, X, CheckCircle2,
  Pencil, ChevronUp, ChevronDown, Target, Microscope, Megaphone, ListOrdered, Check
} from "@/app/components/ui/icons"
import { Switch } from "@/app/components/ui/switch"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Pagination } from "@/app/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/app/components/ui/sheet"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from "@/app/components/ui/table"
import { updateContent, updateContentStatus, type ContentItem } from "../actions"
import { type ContentAssetWithDetails } from "@/app/assets/actions"
import { getContentTypeName, getSegmentName, getContentTypeIconClass, getCampaignName } from "../utils"
import { StarRating } from "@/app/components/ui/rating"
import { toast } from "sonner"
import React from "react"
import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { CONTENT_STATUSES, STATUS_COLORS, CONTENT_TYPE_ICONS, getNetworkIcon, type ContentFilters } from "../content-shared"

export function ContentSkeleton() {
  return (
    <div className="w-full h-full flex flex-col justify-start flex-1 min-h-0 self-stretch flex-grow min-w-0">
      <div className="flex gap-4 min-w-fit items-start pt-0 mt-0 flex-1 flex-row w-full h-full min-h-0 items-stretch self-stretch">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-80 h-full flex flex-col justify-start self-stretch min-h-0 self-stretch flex-grow min-w-0">
            <div className="bg-background rounded-t-md p-3 border-b border-x border-t flex-none">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-8" />
              </div>
            </div>
            <div className="bg-muted/30 rounded-b-md border-b border-x p-2 flex-1 h-full overflow-y-auto min-h-0 min-h-0">
              {Array.from({ length: 3 }).map((_, j) => (
                <Card key={j} className="mb-2">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-5 w-full mt-2" />
                    <Skeleton className="h-4 w-3/4 mt-1" />
                    <div className="flex items-center justify-between mt-3">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
