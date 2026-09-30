"use client"

import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Card,CardContent } from "@/app/components/ui/card"
import {
Pencil
} from "@/app/components/ui/icons"
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/app/components/ui/select"
import { Skeleton } from "@/app/components/ui/skeleton"
import { type CopywritingItem } from "./actions"



import { COPYWRITING_STATUS,COPYWRITING_TYPES,getCopywritingIcon,getCopywritingStatusColor,type CopywritingStatus } from "./copywriting-presentation"
export function CopywritingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="h-48">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center justify-between mt-4">
                  <Skeleton className="h-4 w-20" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Copywriting card component
interface CopywritingCardProps {
  item: CopywritingItem
  onEdit: (item: CopywritingItem) => void
  onStatusChange: (id: string, status: CopywritingStatus) => Promise<void>
}

export function CopywritingCard({ item, onEdit, onStatusChange }: CopywritingCardProps) {
  const Icon = getCopywritingIcon(item.type)
  
  return (
    <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
      <CardContent className="p-6 h-full flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <Badge variant="outline" className={getCopywritingStatusColor(item.status)}>
              {item.status.replace('_', ' ')}
            </Badge>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(item)
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2 line-clamp-2">{item.title}</h3>
          {item.description && (
            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
              {item.description}
            </p>
          )}
          {item.content && (
            <p className="text-sm line-clamp-3 mb-4">
              {item.content}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {COPYWRITING_TYPES.find(t => t.id === item.type)?.label}
          </span>
          <div className="flex gap-2">
            <Select 
              value={item.status} 
              onValueChange={(value: CopywritingStatus) => onStatusChange(item.id, value)}
            >
              <SelectTrigger className="h-8 w-auto text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COPYWRITING_STATUS.map(status => (
                  <SelectItem key={status} value={status}>
                    {status.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

