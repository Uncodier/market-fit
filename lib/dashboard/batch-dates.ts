import { NextRequest } from "next/server"

// Pickers send calendar dates. Expand on the server so browser offsets cannot
// move the selected end day, while preserving legacy explicit timestamp ranges.
export function normalizeBatchDates(request: NextRequest): NextRequest {
  const url = new URL(request.url)
  for (const key of ["startDate", "endDate"]) {
    const value = url.searchParams.get(key)
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) continue
    const day = new Date(`${value}T00:00:00.000Z`)
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value) {
      url.searchParams.set(key, "invalid")
    } else {
      url.searchParams.set(key, `${value}T${key === "startDate" ? "00:00:00.000" : "23:59:59.999"}Z`)
    }
  }
  return new NextRequest(url, { headers: request.headers })
}