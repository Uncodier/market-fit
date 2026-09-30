import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { distributionTotal, formatDistributionValue, type DistributionItem } from "../report-query"

export function TrafficRanking({ data, title }: { data: DistributionItem[]; title: string }) {
  const total = distributionTotal(data)
  const ranked = [...data].sort((a, b) => b.value - a.value)
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
        <span className="text-xs text-muted-foreground">Displayed total</span>
        <span className="text-xl font-semibold tabular-nums tracking-tight">{formatDistributionValue(total)}</span>
      </div>
      <div className="max-h-[520px] min-w-0 overflow-auto">
        <Table aria-label={title} className="w-full table-fixed">
          <TableCaption className="mt-3 text-left text-xs">Share of displayed results. All returned categories are listed.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="h-8 w-[54%] px-0 text-xs">Category</TableHead>
              <TableHead scope="col" className="h-8 w-[26%] px-1 text-right text-xs">Count</TableHead>
              <TableHead scope="col" className="h-8 w-[20%] px-0 text-right text-xs">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranked.map((item, index) => {
              const share = total > 0 ? item.value / total * 100 : 0
              return <TableRow key={`${item.name}-${index}`}>
                <TableHead scope="row" className="h-auto min-w-0 px-0 py-3 pr-3 font-normal text-foreground">
                  <span className="block break-words [overflow-wrap:anywhere] text-sm leading-snug">{item.name}</span>
                  <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: item.color }} />
                  </div>
                </TableHead>
                <TableCell className="break-all px-1 py-3 text-right tabular-nums">{formatDistributionValue(item.value)}</TableCell>
                <TableCell className="px-0 py-3 text-right text-xs tabular-nums text-muted-foreground">{share.toFixed(1)}%</TableCell>
              </TableRow>
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}