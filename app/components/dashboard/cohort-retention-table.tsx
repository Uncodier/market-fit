"use client"

import { useTheme } from "@/app/context/ThemeContext"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import type { CohortRow } from "./cohort-report-data"

const percentage = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 })

export function CohortRetentionTable({ title, rows, population }: {
  title: string
  rows: CohortRow[]
  population: "Customers" | "Leads"
}) {
  const { isDarkMode } = useTheme()
  const weeks = Math.max(1, ...rows.map(row => row.weeks.length))
  const ordered = rows.every(row => row.cohortStart)
    ? [...rows].sort((a, b) => b.cohortStart!.localeCompare(a.cohortStart!)) : rows
  return (
    <section className="min-w-0 space-y-3">
      <h3 className="text-base font-semibold">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No matching cohorts for this measure.</p> : (
        <div className="rounded-md border overflow-hidden">
          <Table aria-label={title} className="table-auto min-w-[640px]">
            <TableCaption className="px-4 pb-3 text-left text-xs">
              Week 0 is the starting cohort. Each later column is a week since entry, not a calendar week.
              A dash means not yet observed or unavailable; 0% means no recorded activity in an observed week.
            </TableCaption>
            <TableHeader><TableRow>
              <TableHead scope="col" className="sticky left-0 z-10 bg-background min-w-32">Cohort</TableHead>
              <TableHead scope="col" className="text-right">{population}</TableHead>
              {Array.from({ length: weeks }, (_, week) => <TableHead key={week} scope="col" className="text-center whitespace-nowrap">Week {week}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>{ordered.map(row => <TableRow key={row.cohort}>
              <TableHead scope="row" className="sticky left-0 z-10 bg-background text-foreground whitespace-nowrap">
                {row.cohort}
                {row.cohortStart && <span className="block text-xs font-normal text-muted-foreground">{row.cohortStart.slice(0, 10)}</span>}
              </TableHead>
              <TableCell className="text-right tabular-nums">{row.size?.toLocaleString("en-US") ?? "—"}</TableCell>
              {Array.from({ length: weeks }, (_, week) => {
                const value = row.weeks[week]
                const observed = value !== undefined && value !== null
                const label = observed ? `${percentage.format(value)}%` : "Not observed"
                return <TableCell key={week} className="text-center tabular-nums whitespace-nowrap text-foreground"
                  aria-label={`${row.cohort}, week ${week}: ${label}`}
                  style={observed && value > 0 ? { backgroundColor: `rgba(${isDarkMode ? "129,140,248" : "99,102,241"}, ${0.06 + value / 100 * 0.24})` } : undefined}>
                  {observed ? label : <><span aria-hidden="true">—</span><span className="sr-only">Not observed</span></>}
                </TableCell>
              })}
            </TableRow>)}</TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}