"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getVisitsSettings, updateVisitsSettings } from "@/app/visits/actions"
import type { VisitsSettings } from "@/app/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Textarea } from "@/app/components/ui/textarea"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { toast } from "sonner"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { PenTool } from "@/app/components/ui/icons"

export function VisitsSection({ active }: { active: boolean }) {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const siteId = currentSite?.id

  const { data, isLoading, mutate } = useSWR(
    active && siteId ? ["visits-settings", siteId] : null,
    () => getVisitsSettings(siteId!)
  )

  const [form, setForm] = useState<VisitsSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data?.data) setForm(data.data)
  }, [data])

  if (!active) return null

  if (!siteId || isLoading || !form) {
    return (
      <Card id="visits-settings">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5" />
            {t("settings.visits.title")}
          </CardTitle>
          <CardDescription>{t("settings.visits.loading")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 bg-muted/50 rounded-md animate-pulse" />
          <div className="h-40 bg-muted/50 rounded-md animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  const set = <K extends keyof VisitsSettings>(key: K, value: VisitsSettings[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const save = async () => {
    setSaving(true)
    const res = await updateVisitsSettings(siteId, form)
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t("settings.visits.saved"))
    mutate()
  }

  return (
    <div className="space-y-8">
      <Card id="visits-channels">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5" />
            {t("settings.visits.channels.title")}
          </CardTitle>
          <CardDescription>{t("settings.visits.channels.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>{t("settings.visits.channels.physical")}</Label>
              <p className="text-xs text-muted-foreground">{t("settings.visits.channels.physicalHint")}</p>
            </div>
            <Switch checked={form.enabled_physical} onCheckedChange={(v) => set("enabled_physical", v)} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>{t("settings.visits.channels.online")}</Label>
              <p className="text-xs text-muted-foreground">{t("settings.visits.channels.onlineHint")}</p>
            </div>
            <Switch checked={form.enabled_online} onCheckedChange={(v) => set("enabled_online", v)} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>{t("settings.visits.requireSignature")}</Label>
              <p className="text-xs text-muted-foreground">{t("settings.visits.requireSignatureHint")}</p>
            </div>
            <Switch checked={form.require_signature} onCheckedChange={(v) => set("require_signature", v)} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>{t("settings.visits.requirePhoto")}</Label>
              <p className="text-xs text-muted-foreground">{t("settings.visits.requirePhotoHint")}</p>
            </div>
            <Switch checked={form.require_photo} onCheckedChange={(v) => set("require_photo", v)} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>{t("settings.visits.requireId")}</Label>
              <p className="text-xs text-muted-foreground">{t("settings.visits.requireIdHint")}</p>
            </div>
            <Switch checked={form.require_id} onCheckedChange={(v) => set("require_id", v)} />
          </div>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="visit-duration">{t("settings.visits.defaultDuration")}</Label>
            <Input
              id="visit-duration"
              type="number"
              min={1}
              value={form.default_duration_minutes}
              onChange={(e) => set("default_duration_minutes", Math.max(1, Number(e.target.value) || 60))}
            />
          </div>
        </CardContent>
        <ActionFooter>
          <Button type="button" variant="outline" onClick={save} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </ActionFooter>
      </Card>

      <Card id="visits-terms">
        <CardHeader>
          <CardTitle>{t("settings.visits.terms.title")}</CardTitle>
          <CardDescription>{t("settings.visits.terms.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="visit-terms"
            value={form.terms_text}
            onChange={(e) => set("terms_text", e.target.value)}
            rows={12}
            placeholder={t("visits.terms.defaultTemplate")}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {t("settings.visits.terms.defaultHint")}
          </p>
        </CardContent>
        <ActionFooter>
          <Button type="button" variant="outline" onClick={save} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </ActionFooter>
      </Card>
    </div>
  )
}
