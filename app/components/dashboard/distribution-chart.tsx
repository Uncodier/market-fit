import { distributionTotal, formatDistributionValue, type DistributionItem } from "./report-query"
import { cn } from "@/lib/utils"
import { StackedDistributionLayout } from "./stacked-distribution-layout"

export function DistributionChart({
  data, title, showTotal = true, formatValues = false, currency, variant = "default",
  populationLabel = "displayed results", totalLabel = "Displayed total", countLabel = "Count",
}: {
  data: DistributionItem[]
  title: string
  showTotal?: boolean
  formatValues?: boolean
  currency?: string
  variant?: "default" | "compact" | "stacked"
  populationLabel?: string
  totalLabel?: string
  countLabel?: string
}) {
  const total = distributionTotal(data)
  const compact = variant === "compact"
  const stacked = variant === "stacked"
  const slices: { color: string; percent: number; start: number }[] = []
  let offset = 0
  for (const item of data) {
    if (item.value <= 0) continue
    const percent = total > 0 ? item.value / total * 100 : 0
    slices.push({ color: item.color, percent, start: offset })
    offset += percent
  }
  const plot = (
      <div className={cn("relative mx-auto", stacked ? "aspect-square w-40 max-w-full sm:w-48" : compact ? "h-28 w-28" : "h-44 w-44")} aria-hidden="true">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          {slices.map(({ color, percent, start }, index) => (
            <circle key={index} cx="50" cy="50" r="36" fill="none" stroke={color} strokeWidth="16" pathLength="100" strokeDasharray={`${percent} ${100 - percent}`} strokeDashoffset={-start} />
          ))}
        </svg>
        {showTotal && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-muted-foreground">Total</span>
            <span className={cn("break-words text-center font-semibold", compact ? "max-w-16 text-xs" : stacked ? "max-w-24 text-sm" : "max-w-28 text-sm")}>{formatDistributionValue(total, formatValues ? currency : undefined)}</span>
          </div>
        )}
      </div>
  )
  const table = (
        <table aria-label={stacked ? `${title}: share of ${populationLabel}` : undefined} className={cn("w-full", compact ? "table-fixed text-xs" : "text-sm", stacked && "h-full table-fixed")}>
          {!stacked && <caption className="pb-2 text-left text-xs text-muted-foreground">{title}: share of {populationLabel}</caption>}
          <thead className={cn("text-xs text-muted-foreground", stacked && "[&_th]:py-2")}>
            <tr><th scope="col" className={cn("text-left", compact && "w-[44%]", stacked && "w-1/2")}>Category</th><th scope="col" className="text-right">{formatValues ? "Reported amount" : countLabel}</th><th scope="col" className={cn("pl-3 text-right", compact && "w-[24%]", stacked && "w-[22%]")}>Share</th></tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="border-t">
                <th scope="row" className={cn("pr-2 text-left font-normal", stacked ? "py-3" : "py-2")}>
                  <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="break-words [overflow-wrap:anywhere]">{item.name}</span>
                </th>
                <td className={cn("text-right tabular-nums", (compact || stacked) && "break-all")}>{formatDistributionValue(item.value, formatValues ? currency : undefined)}</td>
                <td className="pl-3 text-right tabular-nums">{(total > 0 ? item.value / total * 100 : 0).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t font-medium">
            <tr><th scope="row" className="py-2 text-left">{totalLabel}</th><td className={cn("text-right tabular-nums", (compact || stacked) && "break-all")}>{formatDistributionValue(total, formatValues ? currency : undefined)}</td><td className="pl-3 text-right">{total > 0 ? "100.0%" : "0.0%"}</td></tr>
          </tfoot>
        </table>
  )
  if (stacked) return <StackedDistributionLayout plot={plot} rows={<>
    <p aria-hidden="true" className="shrink-0 pb-2 text-xs text-muted-foreground">{title}: share of {populationLabel}</p>
    <div className="min-h-0 flex-1">{table}</div>
    {formatValues && !currency && <p className="mt-3 text-xs text-muted-foreground">Reported amounts; currency not provided.</p>}
  </>} />
  return (
    <div className={compact ? "grid min-w-0 grid-cols-1 items-start gap-4 sm:grid-cols-[112px_minmax(0,1fr)]" : "space-y-3"}>
      {plot}
      {formatValues && !currency && !compact && <p className="text-center text-xs text-muted-foreground">Reported amounts; currency not provided.</p>}
      <div className={cn("max-h-64 overflow-auto", compact && "min-w-0")}>{table}</div>
      {formatValues && !currency && compact && <p className="text-xs text-muted-foreground sm:col-span-2">Reported amounts; currency not provided.</p>}
    </div>
  )
}