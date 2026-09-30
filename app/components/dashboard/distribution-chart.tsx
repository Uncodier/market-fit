import { distributionTotal, formatDistributionValue, type DistributionItem } from "./report-query"
import { cn } from "@/lib/utils"

export function DistributionChart({
  data, title, showTotal = true, formatValues = false, currency, variant = "default",
}: {
  data: DistributionItem[]
  title: string
  showTotal?: boolean
  formatValues?: boolean
  currency?: string
  variant?: "default" | "compact"
}) {
  const total = distributionTotal(data)
  const compact = variant === "compact"
  let offset = 0
  return (
    <div className={compact ? "grid min-w-0 grid-cols-1 items-start gap-4 sm:grid-cols-[112px_minmax(0,1fr)]" : "space-y-3"}>
      <div className={cn("relative mx-auto", compact ? "h-28 w-28" : "h-44 w-44")} aria-hidden="true">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          {data.filter(item => item.value > 0).map((item, index) => {
            const percent = total > 0 ? item.value / total * 100 : 0
            const start = offset
            offset += percent
            return <circle key={index} cx="50" cy="50" r="36" fill="none" stroke={item.color} strokeWidth="16" pathLength="100" strokeDasharray={`${percent} ${100 - percent}`} strokeDashoffset={-start} />
          })}
        </svg>
        {showTotal && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-muted-foreground">Total</span>
            <span className={cn("break-words text-center font-semibold", compact ? "max-w-16 text-xs" : "max-w-28 text-sm")}>{formatDistributionValue(total, formatValues ? currency : undefined)}</span>
          </div>
        )}
      </div>
      {formatValues && !currency && !compact && <p className="text-center text-xs text-muted-foreground">Reported amounts; currency not provided.</p>}
      <div className={cn("max-h-64 overflow-auto", compact && "min-w-0")}>
        <table className={cn("w-full", compact ? "table-fixed text-xs" : "text-sm")}>
          <caption className="pb-2 text-left text-xs text-muted-foreground">{title}: share of displayed results</caption>
          <thead className="text-xs text-muted-foreground">
            <tr><th scope="col" className={cn("text-left", compact && "w-[44%]")}>Category</th><th scope="col" className="text-right">{formatValues ? "Reported amount" : "Count"}</th><th scope="col" className={cn("pl-3 text-right", compact && "w-[24%]")}>Share</th></tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="border-t">
                <th scope="row" className="py-2 pr-2 text-left font-normal">
                  <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="break-words [overflow-wrap:anywhere]">{item.name}</span>
                </th>
                <td className={cn("text-right tabular-nums", compact && "break-all")}>{formatDistributionValue(item.value, formatValues ? currency : undefined)}</td>
                <td className="pl-3 text-right tabular-nums">{(total > 0 ? item.value / total * 100 : 0).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t font-medium">
            <tr><th scope="row" className="py-2 text-left">Displayed total</th><td className={cn("text-right tabular-nums", compact && "break-all")}>{formatDistributionValue(total, formatValues ? currency : undefined)}</td><td className="pl-3 text-right">{total > 0 ? "100.0%" : "0.0%"}</td></tr>
          </tfoot>
        </table>
      </div>
      {formatValues && !currency && compact && <p className="text-xs text-muted-foreground sm:col-span-2">Reported amounts; currency not provided.</p>}
    </div>
  )
}