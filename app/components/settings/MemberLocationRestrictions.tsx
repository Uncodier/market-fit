"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Search } from "@/app/components/ui/icons"
import type { MemberLocationEditor } from "./use-member-location-editor"
import { MemberAccessChip, MemberAccessPanel } from "./MemberAccessPanel"

export function MemberLocationRestrictions({ editor }: { editor: MemberLocationEditor }) {
  const [query, setQuery] = useState("")
  const { saved, selected, exempt, disabledReason, readOnly, locations, feedback, toggle } = editor
  const matching = locations.filter(location => location.name.toLowerCase().includes(query.trim().toLowerCase()))
  const restricted = new Set(selected.map(id => id.toLowerCase()))
  const preview = locations.filter(location => restricted.has(location.id.toLowerCase())).map(location => location.name).slice(0, 2)
  const allRestricted = locations.length > 0 && locations.every(location => restricted.has(location.id.toLowerCase()))

  return <MemberAccessPanel key={saved?.id ?? "unavailable"} title="Location access"
    count={saved && !exempt ? selected.length : 0} countLabel="restricted" preview={preview}
    summary={exempt || !saved ? disabledReason ?? "Not available" : "No additional location restrictions"}
    initialOpen={!!saved && selected.length > 0 && !exempt}>
    <p className="text-xs text-muted-foreground">
      Selected branches are denied in addition to existing role, app, and assigned-data permissions.
      An empty list adds no location restrictions. New branches are not restricted automatically.
    </p>
    {disabledReason && saved && !exempt && <p role="status" className="text-xs text-muted-foreground">{disabledReason}</p>}
    {saved && !exempt && <>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input aria-label="Search branches" placeholder="Search branches…" value={query}
          onChange={event => setQuery(event.target.value)} className="pl-9" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Branches</p>
          <button type="button" disabled={readOnly || !locations.length}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            onClick={() => editor.replace(allRestricted ? [] : locations.map(location => location.id))}
            >{allRestricted ? "Allow all" : "Restrict all"}</button>
        </div>
        <div className="flex max-h-52 flex-wrap gap-1.5 overflow-y-auto">
          {matching.map(location => {
            const isRestricted = restricted.has(location.id.toLowerCase())
            return <MemberAccessChip key={location.id} restricted={isRestricted} disabled={readOnly}
              title={isRestricted ? "Allow this location" : "Restrict this location"}
              onClick={() => toggle(location.id, !isRestricted)}>
              {location.name}{location.is_active === false ? " · inactive" : location.is_active === null ? " · status unknown" : ""}
            </MemberAccessChip>
          })}
          {!matching.length && <p className="text-xs text-muted-foreground py-2">{locations.length ? "No branches match your search." : "No branches configured."}</p>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Inactive branches keep their restrictions unless you allow them. Use Save in the member card footer to save your changes. Refresh reloads the saved selection.</p>
    </>}
    {feedback && <p role={feedback.error ? "alert" : "status"} className={`text-xs ${feedback.error ? "text-destructive" : "text-muted-foreground"}`}>{feedback.message}</p>}
    <Button type="button" size="sm" variant="ghost" disabled={!editor.canRefresh}
      onClick={editor.refresh}>Refresh location access</Button>
  </MemberAccessPanel>
}