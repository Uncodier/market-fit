import { DEFAULT_AGENT_TEMPLATES } from "@/app/agents/agent-defaults"
import { Button } from "@/app/components/ui/button"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { SectionCard, SectionCardContent, SectionCardHeader } from "@/app/components/ui/section-card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Switch } from "@/app/components/ui/switch"
import { TabsContent } from "@/app/components/ui/tabs"
import { Textarea } from "@/app/components/ui/textarea"
import { useLocalization } from "@/app/context/LocalizationContext"
import { findTemplate, type EditorProfile } from "./editor-profile"
import { EditorSupervisorField } from "./editor-supervisor-field"
import type { SaveSection } from "./use-editor-save"

type Props = {
  siteId: string
  profile: EditorProfile
  blank: boolean
  update: (patch: Partial<EditorProfile>) => void
  saving: boolean
  disabled: boolean
  save: (section: SaveSection) => void
}

export function EditorBasicTab({ siteId, profile, blank, update, saving, disabled, save }: Props) {
  const { t } = useLocalization()
  const saveButton = (section: SaveSection, label: string) => (
    <ActionFooter><Button variant="outline" type="button" size="sm" disabled={disabled} onClick={() => save(section)}>
      {saving ? "Saving..." : label}
    </Button></ActionFooter>
  )
  return <TabsContent value="basic" className="space-y-4">
    <SectionCard className="mb-8">
      <SectionCardHeader title="Basic Information" description="Configure the basic details of your agent" />
      <SectionCardContent className="space-y-4">
        <div className="flex items-center justify-between border-b pb-4 mb-4 gap-3">
          <div>
            <h3 className="font-medium text-base">Agent Status</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {blank ? t("settings.agentChannels.draftInactive") : profile.status === "active"
                ? "Your agent is active and responding to queries" : "Your agent is inactive and will not respond to queries"}
            </p>
          </div>
          <Switch checked={profile.status === "active"} disabled={blank}
            onCheckedChange={(active) => update({ status: active ? "active" : "inactive" })} aria-label="Toggle agent status" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={profile.name} onChange={(e) => update({ name: e.target.value })}
            required={blank} maxLength={blank ? 200 : undefined} placeholder="Enter agent name" />
        </div>
        {blank && <div className="space-y-2">
          <Label htmlFor="agent-role">{t("settings.agentChannels.role")}</Label>
          <Select required value={profile.role} onValueChange={(role) => {
            const template = findTemplate(role)
            if (template) update({ role: template.role, type: template.type })
          }}>
            <SelectTrigger id="agent-role"><SelectValue placeholder={t("settings.agentChannels.chooseRole")} /></SelectTrigger>
            <SelectContent>{DEFAULT_AGENT_TEMPLATES.map(({ role }) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
          </Select>
        </div>}
        <EditorSupervisorField siteId={siteId} agentId={profile.persistedId} value={profile.supervisor}
          disabled={saving} onChange={(supervisor) => update({ supervisor })} />
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={profile.description} onChange={(e) => update({ description: e.target.value })}
            maxLength={blank ? 8000 : undefined} placeholder="Enter agent description" rows={3} />
        </div>
      </SectionCardContent>
      {saveButton("basic", blank ? t("settings.agentChannels.createAgent") : "Save Basic Information")}
    </SectionCard>
    <SectionCard className="mb-8">
      <SectionCardHeader title="Agent Prompt" description="Define the system prompt that sets the behavior and capabilities of your agent" />
      <SectionCardContent>
        <Textarea aria-label="Agent Prompt" value={profile.prompt} onChange={(e) => update({ prompt: e.target.value })}
          maxLength={blank ? 32000 : undefined} placeholder="Enter system prompt for the agent" rows={10} className="font-mono text-sm" />
      </SectionCardContent>
      {!blank && saveButton("prompt", "Save Prompt")}
    </SectionCard>
    <SectionCard className="mb-8">
      <SectionCardHeader title="Agent Backstory" description="Create a compelling backstory to give your agent more personality and context" />
      <SectionCardContent>
        <Textarea aria-label="Agent Backstory" value={profile.backstory} onChange={(e) => update({ backstory: e.target.value })}
          maxLength={blank ? 32000 : undefined} placeholder="Enter a backstory for this agent (e.g., professional background, experience, expertise)" rows={6} />
      </SectionCardContent>
      {!blank && saveButton("backstory", "Save Backstory")}
    </SectionCard>
  </TabsContent>
}