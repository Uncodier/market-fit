"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Input } from "@/app/components/ui/input"
import { Plus } from "@/app/components/ui/icons"
import { Deal } from "@/app/deals/types"
import { getSiteQualificationCriteriaKeys, updateDeal } from "@/app/deals/actions"
import { cn } from "@/lib/utils"

const DEFAULT_KEYS = [
  "budget_confirmed",
  "authority_identified",
  "need_established",
  "timeline_agreed",
]

function scoreColor(score: number) {
  if (score >= 80) return "bg-green-500"
  if (score >= 50) return "bg-yellow-500"
  return "bg-red-500"
}

export function DealQualifyTab({
  deal,
  onUpdate,
}: {
  deal: Deal
  onUpdate: (deal: Deal) => void
}) {
  const [keys, setKeys] = useState<string[]>(DEFAULT_KEYS)
  const [criteria, setCriteria] = useState<Record<string, boolean>>(deal.qualification_criteria || {})
  const [newCriterion, setNewCriterion] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setCriteria(deal.qualification_criteria || {})
  }, [deal.qualification_criteria])

  useEffect(() => {
    async function loadKeys() {
      if (!deal.site_id) return
      const result = await getSiteQualificationCriteriaKeys(deal.site_id)
      if (result.keys && result.keys.length > 0) {
        setKeys((prev) => Array.from(new Set([...prev, ...result.keys])))
      }
    }
    void loadKeys()
  }, [deal.site_id])

  const persist = async (nextCriteria: Record<string, boolean>, nextKeys: string[]) => {
    setSaving(true)
    try {
      const full: Record<string, boolean> = {}
      nextKeys.forEach((key) => {
        full[key] = nextCriteria[key] || false
      })
      const trueCount = nextKeys.filter((key) => full[key]).length
      const score = nextKeys.length > 0 ? Math.round((trueCount / nextKeys.length) * 100) : 0
      const result = await updateDeal({
        id: deal.id,
        qualification_criteria: full,
        qualification_score: score,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.deal) onUpdate(result.deal)
    } catch {
      toast.error("Failed to update qualification checklist")
    } finally {
      setSaving(false)
    }
  }

  const toggle = (key: string, checked: boolean) => {
    const next = { ...criteria, [key]: checked }
    setCriteria(next)
    void persist(next, keys)
  }

  const addCriterion = () => {
    if (!newCriterion.trim()) {
      setIsAdding(false)
      return
    }
    const key = newCriterion.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")
    const nextKeys = keys.includes(key) ? keys : [...keys, key]
    const nextCriteria = { ...criteria, [key]: false }
    setKeys(nextKeys)
    setCriteria(nextCriteria)
    setNewCriterion("")
    setIsAdding(false)
    void persist(nextCriteria, nextKeys)
  }

  const score = deal.qualification_score ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-medium">Qualification score</p>
            <p className="text-sm tabular-nums text-muted-foreground">{score}%</p>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full transition-all", scoreColor(score))}
              style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
            />
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-8 shrink-0" onClick={() => setIsAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add
        </Button>
      </div>

      <div>
        {keys.map((key) => {
          const checked = criteria[key] || false
          return (
            <label
              key={key}
              htmlFor={`criterion-${key}`}
              className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0 cursor-pointer"
            >
              <Checkbox
                id={`criterion-${key}`}
                checked={checked}
                disabled={saving}
                onCheckedChange={(value) => toggle(key, value === true)}
              />
              <span className={cn("text-sm capitalize", !checked && "text-muted-foreground")}>
                {key.replace(/_/g, " ")}
              </span>
            </label>
          )
        })}
      </div>

      {isAdding && (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            placeholder="Add criterion..."
            value={newCriterion}
            onChange={(event) => setNewCriterion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                addCriterion()
              } else if (event.key === "Escape") {
                setIsAdding(false)
              }
            }}
            className="h-8 text-sm"
          />
          <Button variant="outline" size="sm" className="h-8" onClick={addCriterion}>
            Add
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setIsAdding(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
