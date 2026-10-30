import type { ReactNode } from "react"
import { act, render, screen, within } from "@testing-library/react"
import { FormProvider, useForm } from "react-hook-form"
import { SystemSkillsCatalog } from "@/app/components/settings/SystemSkillsCatalog"
import { IcpMiningListSelector } from "@/app/components/settings/IcpMiningListSelector"
import { OutreachActivityFields } from "@/app/components/settings/OutreachActivityFields"
import { TeamSection } from "@/app/components/settings/TeamSection"
import { CopywritingSection } from "@/app/components/settings/CopywritingSection"
import { SecretsSection } from "@/app/components/settings/SecretsSection"
import { VisitsSection } from "@/app/components/settings/VisitsSection"
import { SmsChannelSetup } from "@/app/components/settings/SmsChannelSetup"
import { VoiceChannelSetup } from "@/app/components/settings/VoiceChannelSetup"
import { VoiceAgentSettingsFields } from "@/app/components/settings/VoiceAgentSettingsFields"
import { useIcpMiningLists } from "@/app/components/settings/use-icp-mining-lists"
import { useTeamMembers } from "@/app/components/settings/use-team-members"
import { useCopywritingSection } from "@/app/components/settings/use-copywriting-section"
import { skillRequest } from "@/app/components/settings/SkillManager"
import { apiClient } from "@/app/services/api-client-service"
import { createClient } from "@/lib/supabase/client"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-1" } }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/app/components/settings/use-icp-mining-lists", () => ({ useIcpMiningLists: jest.fn() }))
jest.mock("@/app/components/settings/use-team-members", () => ({ useTeamMembers: jest.fn() }))
jest.mock("@/app/components/settings/use-copywriting-section", () => ({ useCopywritingSection: jest.fn() }))
jest.mock("@/app/components/settings/TeamLocationAccess", () => ({ TeamLocationAccess: ({ children }: { children: ReactNode }) => <>{children}</> }))
jest.mock("@/app/components/settings/SkillManager", () => ({
  skillRequest: jest.fn(), skillsFromResponse: (value: unknown) => value,
}))
jest.mock("@/app/services/api-client-service", () => ({ apiClient: { get: jest.fn() } }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/visits/actions", () => ({ getVisitsSettings: jest.fn(), updateVisitsSettings: jest.fn() }))
jest.mock("swr", () => ({ __esModule: true, default: () => ({ isLoading: true }) }))
jest.mock("@/app/components/settings/use-can-manage-voice-channel", () => ({ useCanManageVoiceChannel: () => true }))
jest.mock("@/app/components/settings/use-zavu-voice-options", () => ({
  useZavuVoiceOptions: () => ({ items: [], languages: [], isLoading: true, error: null }),
}))

function Form({ children }: { children: ReactNode }) {
  const form = useForm({ defaultValues: { activities: {} } })
  return <FormProvider {...form}>{children}</FormProvider>
}

function expectSkeleton(label: string) {
  const status = screen.getByRole("status", { name: label })
  const shapes = status.querySelectorAll(".animate-pulse")
  expect(shapes.length).toBeGreaterThan(2)
  shapes.forEach(shape => expect(shape.closest('[aria-hidden="true"]')).not.toBeNull())
  expect(status.querySelector("button, input, select, textarea")).toBeNull()
  return status
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(skillRequest).mockImplementation(() => new Promise(() => {}))
  jest.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}))
  jest.mocked(useIcpMiningLists).mockReturnValue({ lists: [], loading: true, error: "", retry: jest.fn() })
  jest.mocked(useTeamMembers).mockReturnValue({ teamList: [], isLoading: true } as unknown as ReturnType<typeof useTeamMembers>)
  jest.mocked(useCopywritingSection).mockReturnValue({ active: true, isLoading: true } as ReturnType<typeof useCopywritingSection>)
})

it("shows skill cards until the catalog resolves, then preserves the empty state", async () => {
  let resolve!: (value: never[]) => void
  jest.mocked(skillRequest).mockReturnValue(new Promise(done => { resolve = done }))
  render(<SystemSkillsCatalog />)
  const status = expectSkeleton("Loading Makinari skills")
  expect(status.querySelectorAll(".rounded-xl")).toHaveLength(2)
  expect(screen.queryByText("No built-in skills are available.")).not.toBeInTheDocument()
  await act(async () => resolve([]))
  expect(screen.queryByRole("status", { name: "Loading Makinari skills" })).not.toBeInTheDocument()
  expect(screen.getByText("No built-in skills are available.")).toBeInTheDocument()
})

it("uses progress-list shapes for pending mining lists and removes them on completion", () => {
  const view = render(<Form><IcpMiningListSelector siteId="site-1" /></Form>)
  const status = expectSkeleton("Loading pending mining lists")
  expect(status.querySelectorAll('.h-1\\.5')).toHaveLength(3)
  jest.mocked(useIcpMiningLists).mockReturnValue({ lists: [], loading: false, error: "", retry: jest.fn() })
  view.rerender(<Form><IcpMiningListSelector siteId="site-1" /></Form>)
  expect(screen.queryByRole("status", { name: "Loading pending mining lists" })).not.toBeInTheDocument()
  expect(screen.getByText("This site has no pending or running mining lists.")).toBeInTheDocument()
})

it("shows segment checkbox shapes without hiding unrelated outreach fields", () => {
  render(<Form><OutreachActivityFields activityKey="leads_follow_up" accounts={[]} segments={[]} loading error="" retry={jest.fn()} /></Form>)
  expectSkeleton("Loading this site's segments")
  expect(screen.getByText("Sending accounts")).toBeInTheDocument()
  expect(screen.queryByText("This site has no segments yet.")).not.toBeInTheDocument()
})

it("uses member card fields and keeps inactive team sections hidden", () => {
  const view = render(<TeamSection active siteId="site-1" />)
  const status = expectSkeleton("Loading team members")
  expect(status.querySelectorAll('[data-team-detail-fields] .h-10.w-full')).toHaveLength(4)
  const roleGrids = status.querySelectorAll('[data-team-role-tabs]')
  expect(roleGrids).toHaveLength(2)
  roleGrids.forEach(grid => {
    expect(grid).toHaveClass('grid-cols-2', 'md:grid-cols-4')
    expect(grid.querySelectorAll('.animate-pulse')).toHaveLength(4)
  })
  view.rerender(<TeamSection active={false} siteId="site-1" />)
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
})

it("uses collapsed copywriting cards rather than empty-state shapes", () => {
  render(<CopywritingSection active />)
  const status = expectSkeleton("Loading copywriting")
  expect(status.querySelectorAll(".rounded-xl")).toHaveLength(2)
})

it("keeps secrets table columns while loading and restores its empty state", async () => {
  let resolve!: (value: { data: never[]; error: null }) => void
  const pending = new Promise(done => { resolve = done })
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: () => pending }
  jest.mocked(createClient).mockReturnValue({ from: () => query } as unknown as ReturnType<typeof createClient>)
  render(<SecretsSection />)
  expect(screen.getByRole("status", { name: "Loading secrets" })).toBeInTheDocument()
  const table = screen.getByRole("table")
  expect(within(table).getAllByRole("columnheader")).toHaveLength(4)
  const rows = table.querySelectorAll('tbody tr[aria-hidden="true"]')
  expect(rows).toHaveLength(3)
  rows.forEach(row => {
    expect(row.querySelectorAll("td")).toHaveLength(4)
    expect(row.querySelectorAll(".animate-pulse")).toHaveLength(5)
  })
  await act(async () => resolve({ data: [], error: null }))
  expect(screen.queryByRole("status", { name: "Loading secrets" })).not.toBeInTheDocument()
  expect(screen.getByText("No secrets found. Add one to get started.")).toBeInTheDocument()
})

it("matches visits toggle settings and terms cards and hides inactive visits", () => {
  const view = render(<VisitsSection active />)
  const status = expectSkeleton("Loading visit settings")
  expect(status.querySelectorAll(".rounded-xl")).toHaveLength(2)
  expect(status.querySelectorAll(".h-6.w-11")).toHaveLength(5)
  expect(status.querySelector(".h-64.w-full")).not.toBeNull()
  view.rerender(<VisitsSection active={false} />)
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
})

it.each([
  ["SMS", SmsChannelSetup], ["Voice", VoiceChannelSetup],
] as const)("uses selectable phone row shapes for %s initial loads", (label, Component) => {
  render(<Component siteId="site-1" channel={{ id: "channel-1", metadata: {} }} onConnected={jest.fn()} />)
  const status = expectSkeleton(`Loading ${label} phone numbers`)
  expect(status.querySelectorAll(".h-4.w-4.rounded-full")).toHaveLength(3)
  expect(screen.queryByText("You don't have any phone numbers yet.")).not.toBeInTheDocument()
})

it("replaces voice option loading labels with two fields and preserves errors after loading", () => {
  const props = { value: { language: "auto", ttsVoiceId: "" }, onChange: jest.fn() }
  const view = render(<VoiceAgentSettingsFields {...props} options={{ items: [], languages: [], isLoading: true, error: null }} />)
  const status = expectSkeleton("Loading voice options")
  expect(status.querySelectorAll(".h-10.w-full")).toHaveLength(2)
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  view.rerender(<VoiceAgentSettingsFields {...props} options={{ items: [], languages: [], isLoading: false, error: "Unable to load voices" }} />)
  expect(screen.queryByRole("status", { name: "Loading voice options" })).not.toBeInTheDocument()
  expect(screen.getByRole("alert")).toHaveTextContent("Existing settings are preserved")
  expect(screen.getAllByRole("combobox")).toHaveLength(2)
})