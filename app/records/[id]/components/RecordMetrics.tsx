import { useId, useState } from "react"
import Link from "next/link"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { BarChart as ChartIcon } from "@/app/components/ui/icons"
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import { Button } from "@/app/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useScopedPreviewState } from "../../hooks/useScopedPreviewState"
import type { RecordItem } from "../../actions"
import type { InsightsTabProps } from "./insights-types"
import { formatMetric, metricComparison, metricNumber, metricSeries } from "./record-metrics"

interface Props extends InsightsTabProps {
  records: RecordItem[]
  historyStatus: "idle" | "loading" | "ready" | "error"
  relationName: string | null
  relationLabel: string | null
  onRelationChange: (name: string) => void
  onRetry: () => void
}

function MetricSelect({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (value: string) => void
  options: { value: string; label: string }[]; placeholder?: string
}) {
  const id = useId()
  return <div className="min-w-0 space-y-1">
    <label htmlFor={id} className="text-xs text-muted-foreground">{label}</label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={label}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>
        {option.label}
      </SelectItem>)}</SelectContent>
    </Select>
  </div>
}

export function RecordMetrics({ fields, formData, record, relationsData, records, historyStatus,
  relationName, relationLabel, onRelationChange, onRetry }: Props) {
  const scope = JSON.stringify([record?.site_id, record?.category_id, record?.id])
  const detailId = useId()
  const [selectedMetric, setSelectedMetric] = useScopedPreviewState<string | null>(scope, null)
  const [selectedDate, setSelectedDate] = useScopedPreviewState<string>(scope, "created")
  const [showAll, setShowAll] = useState(false)
  const numbers = fields.filter(field => field.type === "number")
  const dates = fields.filter(field => field.type === "date")
  const relations = fields.filter(field => field.type === "relation"
    && typeof relationsData?.[field.name] === "string" && relationsData[field.name])
  const metric = numbers.find(field => field.id === selectedMetric) ?? numbers[0]
  const dateField = dates.find(field => `field:${field.id}` === selectedDate)
  const { points, omittedDates } = metricSeries(records, metric?.name ?? "", dateField?.name)
  const validPoints = points.filter(point => point.value !== null)
  const canCompare = historyStatus === "ready"
  const comparison = canCompare ? metricComparison(points, record?.id) : null
  const draftValue = metricNumber(formData[metric?.name])
  const savedValue = metricNumber(record?.data?.[metric?.name])
  const currentSaved = records.some(item => item.id === record?.id)
  const hasUnsaved = !record?.id || draftValue !== savedValue
    || (dateField && formData[dateField.name] !== record?.data?.[dateField.name])
    || (!!relationName && relationsData?.[relationName] !== record?.relations?.[relationName])
  const tablePoints = [...points].reverse()
  const displayedPoints = showAll ? tablePoints : tablePoints.slice(0, 6)

  if (!numbers.length) return null
  return <section className="min-w-0 space-y-3" aria-label="Record metrics">
    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
      <ChartIcon className="h-4 w-4" /><span>Metrics</span>
    </div>
    <ToggleGroup type="single" value={metric.id} onValueChange={value => value && setSelectedMetric(value)}
      aria-label="Select metric" className="h-auto w-full flex-col items-stretch gap-0 rounded-lg border border-border/60 bg-transparent p-1">
      {numbers.map(field => {
        const value = metricNumber(formData[field.name])
        const unsaved = !record?.id || value !== metricNumber(record?.data?.[field.name])
        return <ToggleGroupItem key={field.id} value={field.id} type="button"
          aria-controls={detailId}
          className="w-full justify-between gap-3 rounded-md px-3 py-2.5 text-left data-[state=on]:bg-muted data-[state=on]:shadow-none">
          <span className="min-w-0 truncate text-xs" title={field.label || field.name}>{field.label || field.name}</span>
          <span className="flex shrink-0 items-center gap-2 tabular-nums">
            {unsaved && <span className="text-[10px] text-muted-foreground">Unsaved</span>}
            <span className="text-sm font-medium">{formatMetric(value)}</span>
          </span>
        </ToggleGroupItem>
      })}
    </ToggleGroup>
    <div id={detailId} className="rounded-lg border border-border/60 p-3">
      <div aria-live="polite" aria-atomic="true" className="mb-3">
        <h4 className="truncate text-xs text-muted-foreground">{metric.label || metric.name}</h4>
        <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{formatMetric(draftValue)}</div>
        {comparison && <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          {comparison.delta > 0 ? "+" : ""}{formatMetric(comparison.delta)} vs. previous observation
        </p>}
      </div>
      {!canCompare && <p className="text-xs text-muted-foreground" role="status">
        {historyStatus === "loading" ? "Loading history…" : historyStatus === "error" ? "History unavailable." :
          relations.length > 1 ? "Choose a relation below to see this metric’s history." :
          "Current value only. Link records to the same subject to track changes."}
      </p>}
      {historyStatus === "error" && <Button type="button" data-permission="allow" variant="ghost" size="sm" onClick={onRetry}>Retry history</Button>}
      {hasUnsaved && <p className="mt-2 text-[11px] text-muted-foreground">Unsaved changes · history uses saved values.</p>}
    {canCompare && <div className="space-y-3">
      {!relationName && <p className="text-xs text-muted-foreground">Comparing saved records in this collection.</p>}
      {new Set(validPoints.map(point => point.timestamp)).size >= 2 ? <div className="h-[200px] w-full min-w-0" role="img" aria-label={`${metric.label || metric.name} over time; exact values in the table below`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]} scale="time"
              tickFormatter={value => new Date(value).toLocaleDateString()} minTickGap={36} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis width={64} fontSize={11} tickLine={false} axisLine={false}
              tickFormatter={value => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value)} />
            <Tooltip labelFormatter={value => new Date(Number(value)).toLocaleDateString()}
              formatter={value => [formatMetric(Number(value)), metric.label || metric.name]}
              contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }} />
            <Line type="linear" dataKey="value" stroke="hsl(var(--foreground))" strokeWidth={2}
              connectNulls={false} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div> : <p className="text-xs text-muted-foreground">Not enough history yet. Add another dated observation to see a trend.</p>}
      {points.length > 0 && <details className="border-t border-border/50 pt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">View {points.length} observations</summary>
        <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Saved observations for {metric.label || metric.name}</caption>
          <thead><tr className="border-b"><th className="py-2">Date / record</th><th className="py-2 text-right">Value</th></tr></thead>
          <tbody>{displayedPoints.map(point => <tr key={point.id} className="border-b border-border/30">
            <td className="py-2 pr-2"><span>{new Date(point.timestamp).toLocaleDateString()}</span>
              <Link href={`/records/${encodeURIComponent(point.id)}`} className="block max-w-[180px] truncate text-primary underline" title={point.title}>{point.title}</Link>
            </td><td className="py-2 text-right tabular-nums">{formatMetric(point.value)}</td>
          </tr>)}</tbody>
        </table>
        {points.length > 6 && <Button type="button" data-permission="allow" variant="ghost" size="sm" onClick={() => setShowAll(value => !value)}>
          {showAll ? "Show recent observations" : `Show all ${points.length} observations`}
        </Button>}
        </div>
      </details>}
      <div className="text-[11px] text-muted-foreground">
        {omittedDates > 0 && <p>{omittedDates} records excluded: no valid date.</p>}
        {points.some(point => point.value === null) && <p>Missing values are shown as gaps.</p>}
        {!currentSaved && <p>This record is not saved in this group.</p>}
      </div>
    </div>}
    </div>
    {(relations.length > 0 || dates.length > 0) && <details open={relations.length > 1 && !relationName ? true : undefined} className="text-xs">
      <summary className="cursor-pointer text-muted-foreground">History settings</summary>
      <div className="mt-3 space-y-3">
    {relations.length > 0 && <MetricSelect label="Compare records linked by" value={relationName ?? ""}
      onChange={onRelationChange} placeholder="Choose a relation"
      options={relations.map(field => ({ value: field.name, label: field.label || field.name }))} />}
    {dates.length > 0 && <MetricSelect label="Timeline date" value={dateField ? selectedDate : "created"}
      onChange={setSelectedDate} options={[
        { value: "created", label: "Record creation date" },
        ...dates.map(field => ({ value: `field:${field.id}`, label: field.label || field.name })),
      ]} />}

        <p className="text-[11px] text-muted-foreground">{dateField?.label || dateField?.name || "Record creation date"}
          {relationLabel ? ` · ${relationLabel}` : ""}. Saved records, not edit history.</p>
      </div>
    </details>}
  </section>
}