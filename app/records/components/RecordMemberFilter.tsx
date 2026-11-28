import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Check } from "@/app/components/ui/icons"
import { RecordMemberAvatar } from "./RecordMemberAvatar"

export function RecordMemberFilter({ fieldLabel, options, selectedId, onSelect }: {
  fieldLabel: string
  options: { id: string; name?: string; avatar?: string | null; count: number }[]
  selectedId?: string
  onSelect: (id: string | null) => void
}) {
  const [search, setSearch] = useState("")
  const query = search.trim().toLocaleLowerCase()
  const visible = [...options].sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .filter(option => !query || (option.name || "Unavailable member").toLocaleLowerCase().includes(query))
  return (
    <div className="space-y-1 pb-1 pl-2" aria-label={`Filter by ${fieldLabel}`} role="group">
      {options.length > 5 && <Input aria-label={`Search ${fieldLabel}`} placeholder="Find a member…" value={search}
        onChange={event => setSearch(event.target.value)} className="h-7 w-full px-2 text-xs" />}
      {selectedId && <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground"
        onClick={() => onSelect(null)}>Clear member filter</Button>}
      {visible.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">No matching members</p>}
      {visible.map(({ id, name, avatar, count }) => {
        const active = id === selectedId
        const label = name || "Unavailable member"
        return <Button key={id} variant={active ? "secondary" : "ghost"} size="sm"
          className="h-8 w-full min-w-0 max-w-full justify-start gap-2 px-2 text-[11px]"
          title={label} aria-label={label} aria-pressed={active} aria-description={`${count} ${count === 1 ? "record" : "records"}`}
          onClick={() => onSelect(id)}>
          <RecordMemberAvatar name={name} src={avatar} compact decorative />
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          <span aria-hidden className="shrink-0 tabular-nums text-muted-foreground">{count}</span>
          {active && <Check aria-hidden className="size-3 shrink-0" />}
        </Button>
      })}
    </div>
  )
}