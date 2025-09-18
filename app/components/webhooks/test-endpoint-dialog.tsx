"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog"
import { Label } from "@/app/components/ui/label"
import { CustomSelect, Option } from "@/app/components/ui/custom-select"
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
        <DialogHeader>
          <DialogTitle>Test endpoint</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Operation type</Label>
            <CustomSelect value={operation} onChange={(e) => onChangeOperation(e.target.value as TestOperation)}>
              <Option value="INSERT">INSERT</Option>
              <Option value="UPDATE">UPDATE</Option>
              <Option value="DELETE">DELETE</Option>
            </CustomSelect>
          </div>
          <div className="space-y-1">
            <Label>Table</Label>
            <CustomSelect value={table} onChange={(e) => { onChangeTable(e.target.value); onChangeRecordId("") }}>
              <Option value="tasks">tasks</Option>
              <Option value="messages">messages</Option>
              <Option value="leads">leads</Option>
            </CustomSelect>
          </div>
          <div className="space-y-1">
            <Label>Record</Label>
            <CustomSelect value={recordId} onChange={(e) => onChangeRecordId(e.target.value)} disabled={isLoadingRecords}>
              <Option value="">{isLoadingRecords ? 'Loading...' : 'Select a record'}</Option>
              {records.map((r) => {
                const labelCandidate = r.title || r.name || r.content || r.email || r.id
                const label = (typeof labelCandidate === 'string' ? labelCandidate : String(labelCandidate))
                return (
                  <Option key={r.id} value={r.id}>{label}</Option>
                )
              })}
            </CustomSelect>
            <p className="text-xs text-muted-foreground">Records are loaded from the selected table filtered by the current site.</p>
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



