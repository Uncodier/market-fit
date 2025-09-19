"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Button } from "@/app/components/ui/button"
import { Play } from "@/app/components/ui/icons"

type TestOperation = 'INSERT' | 'UPDATE' | 'DELETE'

interface TestEndpointDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  operation: TestOperation
  onChangeOperation: (op: TestOperation) => void
  table: string
  onChangeTable: (table: string) => void
  recordId: string
  onChangeRecordId: (id: string) => void
  records: any[]
  isLoadingRecords: boolean
  isSubmitting: boolean
  onSend: () => void
}

export function TestEndpointDialog(props: TestEndpointDialogProps) {
  const {
    open,
    onOpenChange,
    operation,
    onChangeOperation,
    table,
    onChangeTable,
    recordId,
    onChangeRecordId,
    records,
    isLoadingRecords,
    isSubmitting,
    onSend,
  } = props

  return (
    <Dialog open={open} onOpenChange={onOpenChange}> 
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Test endpoint</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Operation type</Label>
            <Select value={operation} onValueChange={(val) => onChangeOperation(val as TestOperation)}>
              <SelectTrigger>
                <SelectValue className="text-left" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INSERT">INSERT</SelectItem>
                <SelectItem value="UPDATE">UPDATE</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Choose the database operation to simulate.</p>
          </div>
          <div className="space-y-1">
            <Label>Table</Label>
            <Select value={table} onValueChange={(val) => { onChangeTable(val); onChangeRecordId("") }}>
              <SelectTrigger>
                <SelectValue className="text-left" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tasks">tasks</SelectItem>
                <SelectItem value="messages">messages</SelectItem>
                <SelectItem value="leads">leads</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Select the table to simulate events for. Messages are scoped via related leads.</p>
          </div>
          <div className="space-y-1">
            <Label>Record</Label>
            <Select value={recordId} onValueChange={(val) => onChangeRecordId(val)} disabled={isLoadingRecords}>
              <SelectTrigger>
                <SelectValue className="text-left" placeholder={isLoadingRecords ? 'Loading...' : 'Select a record'} />
              </SelectTrigger>
              <SelectContent>
                {records.map((r) => {
                  const labelCandidate = r.title || r.name || r.content || r.email || r.id
                  const label = (typeof labelCandidate === 'string' ? labelCandidate : String(labelCandidate))
                  return (
                    <SelectItem key={r.id} value={String(r.id)}>{label}</SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Records are loaded from the selected table and filtered by the current site. For UPDATE/DELETE select a record; for INSERT a sample record will be generated.</p>
          </div>
        </div>
        <DialogFooter>
          <div className="flex items-center gap-2 w-full justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={onSend} disabled={isSubmitting || ((operation === 'UPDATE' || operation === 'DELETE') && !recordId)}>
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Send test
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}



