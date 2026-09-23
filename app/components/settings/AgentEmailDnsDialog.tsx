"use client"

import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Cloud, Copy } from "@/app/components/ui/icons"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table"
import { copyTextToClipboard } from "./copy-to-clipboard"

export interface AgentMailDnsRecord {
  name: string
  type: string
  value: string
  priority?: number
}

interface DnsRecordTableProps {
  records: AgentMailDnsRecord[]
  title: string
  showPriority?: boolean
}

async function copyDnsValue(value: string, label: string) {
  try {
    await copyTextToClipboard(value)
    toast.success(`${label} copied to clipboard`)
  } catch (error) {
    console.error("Failed to copy DNS value:", error)
    toast.error("Failed to copy")
  }
}

function DnsRecordTable({
  records,
  title,
  showPriority = true,
}: DnsRecordTableProps) {
  if (records.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Name</TableHead>
            <TableHead className="w-[100px]">Type</TableHead>
            {showPriority && <TableHead className="w-[100px]">Priority</TableHead>}
            <TableHead>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record, index) => (
            <TableRow key={`${record.name}-${record.type}-${index}`}>
              <TableCell
                className="cursor-pointer font-medium transition-colors hover:bg-muted/50"
                onClick={() => copyDnsValue(record.name || "@", "Name")}
              >
                {record.name || "@"}
              </TableCell>
              <TableCell
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => copyDnsValue(record.type, "Type")}
              >
                <span className="rounded bg-muted px-2 py-1 text-xs">{record.type}</span>
              </TableCell>
              {showPriority && (
                <TableCell
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => copyDnsValue(
                    record.priority === undefined ? "-" : String(record.priority),
                    "Priority",
                  )}
                >
                  {record.priority ?? "-"}
                </TableCell>
              )}
              <TableCell
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => copyDnsValue(record.value, "Value")}
              >
                <code className="break-all font-mono text-sm">{record.value}</code>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

interface AgentEmailDnsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  records: AgentMailDnsRecord[]
  isCloudflareConnected: boolean
  isSyncingCloudflare: boolean
  onSyncCloudflare: () => void
}

export function AgentEmailDnsDialog({
  open,
  onOpenChange,
  records,
  isCloudflareConnected,
  isSyncingCloudflare,
  onSyncCloudflare,
}: AgentEmailDnsDialogProps) {
  const mxRecords = records.filter((record) => record.type.toUpperCase() === "MX")
  const txtRecords = records.filter((record) => record.type.toUpperCase() === "TXT")
  const otherRecords = records.filter(
    (record) => !["MX", "TXT"].includes(record.type.toUpperCase()),
  )

  const copyAllRecords = async () => {
    const text = records
      .map((record) => (
        `${record.name || "@"} ${record.type} ${
          record.priority === undefined ? "" : `${record.priority} `
        }${record.value}`
      ))
      .join("\n")

    try {
      await copyTextToClipboard(text)
      toast.success("All DNS records copied to clipboard")
    } catch (error) {
      console.error("Failed to copy DNS records:", error)
      toast.error("Failed to copy DNS records")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <div
          data-slot="dialog-form"
          className="flex min-h-0 max-h-[inherit] flex-1 flex-col overflow-hidden"
        >
          <DialogHeader>
            <DialogTitle>DNS Records Configuration</DialogTitle>
            <DialogDescription>
              Configure these DNS records in your domain provider. Click any cell to copy its value.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-6">
            <DnsRecordTable records={mxRecords} title="MX Records" />
            <DnsRecordTable records={txtRecords} title="TXT Records" showPriority={false} />
            <DnsRecordTable records={otherRecords} title="Other Records" />
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onSyncCloudflare}
              disabled={isSyncingCloudflare || records.length === 0}
            >
              <Cloud className="mr-2 h-4 w-4" />
              {isSyncingCloudflare
                ? "Syncing..."
                : isCloudflareConnected
                  ? "Sync with Cloudflare"
                  : "Connect Cloudflare"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={copyAllRecords}
              disabled={records.length === 0}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy All Records
            </Button>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
