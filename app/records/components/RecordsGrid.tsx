import { RecordItem } from "../actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { DynamicFieldBadges } from "./DynamicFieldBadges"

export function RecordsGrid({ 
  records,
  onRecordClick
}: { 
  records: RecordItem[]
  onRecordClick: (record: RecordItem) => void
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {records.map(record => (
        <Card 
          key={record.id} 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onRecordClick(record)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base line-clamp-1">{record.title}</CardTitle>
                <CardDescription className="line-clamp-2 mt-1 min-h-[40px]">
                  {record.description || "No description"}
                </CardDescription>
              </div>
              <Badge variant={record.status === 'published' ? 'default' : 'secondary'}>
                {record.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="mb-4">
              <DynamicFieldBadges record={record} limit={4} className="mt-0" />
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <span className="truncate">{record.category?.name || "Uncategorized"}</span>
              <span className="mx-2">•</span>
              <span>{new Date(record.created_at).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}