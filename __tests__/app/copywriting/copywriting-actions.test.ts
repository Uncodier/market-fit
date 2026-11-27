/** @jest-environment node */

import { createCopyTemplate, getCopywriting, saveCopywriting } from "@/app/copywriting/actions"
import { COPY_STATUSES, COPY_TYPES, initialCopyFields } from "@/app/copywriting/copywriting-model"
import { copyTemplateVariables, copyTestSchema, renderCopyTemplate, whatsappTemplateSourceTag } from "@/app/copywriting/template-model"
import { siteFormSchema } from "@/app/components/settings/form-schema"
import { rawLocaleMessages } from "@/app/context/locale-catalog"
import { findNavigationMenuItem } from "@/app/config/navigation-areas"
import { getNavKeyForPath } from "@/lib/auth/screen-access"
import { workspaceScreenTitle } from "@/lib/navigation/workspace-screen"
import { createClient } from "@/lib/supabase/server"
import { readWorkspaceScreenScope } from "@/lib/permissions/workspace-screen-scope"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { revalidatePath } from "next/cache"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/permissions/workspace-screen-scope", () => ({ readWorkspaceScreenScope: jest.fn() }))
jest.mock("@/lib/auth/site-role-lookup", () => ({ lookupCurrentUserSiteRole: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/permissions/site-access", () => ({ userCanOnSite: jest.fn() }))
jest.mock("@/lib/permissions/location-boundary", () => ({ canAccessUnscopedSite: async () => true }))

const site = "b576fa67-6e80-4d19-a273-0de8459048a7"
const id = "a365be64-82ea-41b3-b7de-b91d08d6957b"
const fields = { ...initialCopyFields(undefined, "sales_pitch"), title: "Pitch", content: "Hello" }
const row = { ...fields, target_audience: null, use_case: null, notes: null, id }
const query = { insert: jest.fn(), update: jest.fn(), select: jest.fn(), eq: jest.fn(), contains: jest.fn(), single: jest.fn(), maybeSingle: jest.fn() }
const from = jest.fn()

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(userCanOnSite).mockResolvedValue(true)
  from.mockReturnValue(query)
  for (const method of [query.insert, query.update, query.select, query.eq, query.contains]) method.mockReturnValue(query)
  query.single.mockResolvedValue({ data: row, error: null })
  query.maybeSingle.mockResolvedValue({ data: row, error: null })
  jest.mocked(createClient).mockResolvedValue({
    from, auth: { getUser: async () => ({ data: { user: { id: "actor" } }, error: null }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(readWorkspaceScreenScope).mockResolvedValue({ status: "ready", role: "collaborator", blockedScreens: [], locationRestricted: false })
})

it("inserts values from the canonical contract and attributes the authenticated actor", async () => {
  await expect(saveCopywriting(site, null, fields)).resolves.toEqual(row)
  expect(query.insert).toHaveBeenCalledWith({ ...fields, target_audience: null, use_case: null, notes: null, site_id: site, user_id: "actor" })
  expect(revalidatePath).toHaveBeenCalledWith("/copywriting")
})

it("scopes updates to the site's row and fails when no updated row is returned", async () => {
  query.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } })
  await expect(saveCopywriting(site, id, fields)).rejects.toThrow("Failed to save")
  expect(query.eq.mock.calls).toEqual([["site_id", site], ["id", id]])
  expect(revalidatePath).not.toHaveBeenCalled()
})

it("does not query blocked screens or allow writes from read-only members", async () => {
  jest.mocked(readWorkspaceScreenScope).mockResolvedValueOnce({ status: "ready", role: "collaborator", blockedScreens: ["copywriting"], locationRestricted: false })
    .mockResolvedValueOnce({ status: "ready", role: "marketing", blockedScreens: [], locationRestricted: false })
  await expect(getCopywriting(site)).rejects.toThrow("access denied")
  await expect(saveCopywriting(site, id, fields)).rejects.toThrow("write denied")
  await expect(saveCopywriting(site, id, { ...fields, site_id: "other" } as typeof fields)).rejects.toThrow()
  expect(from).not.toHaveBeenCalled()
})

it("creates a private newsletter draft in Content without modifying the copy", async () => {
  await expect(createCopyTemplate(site, id, { kind: "newsletter", title: "April", body: "Newsletter body" })).resolves.toEqual({ id })
  expect(from.mock.calls).toEqual([["copywriting"], ["content"]])
  expect(query.insert).toHaveBeenCalledWith({ site_id: site, user_id: "actor", author_id: "actor", type: "newsletter",
    title: "April", text: "Newsletter body", status: "draft", metadata: { source_copywriting_id: id } })
  expect(query.update).not.toHaveBeenCalled()
})

it("saves a reusable WhatsApp draft without creating a provider approval record", async () => {
  query.maybeSingle.mockResolvedValueOnce({ data: row }).mockResolvedValueOnce({ data: null })
  await createCopyTemplate(site, id, { kind: "whatsapp", title: "WhatsApp April", body: "WhatsApp body" })
  expect(from.mock.calls).toEqual([["copywriting"], ["copywriting"], ["copywriting"]])
  expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ site_id: site, user_id: "actor", copy_type: "other",
    status: "draft", tags: ["whatsapp-template", whatsappTemplateSourceTag(id)], content: "WhatsApp body" }))
  expect(query.update).not.toHaveBeenCalled()
})

it("updates the server-resolved linked draft without changing the source or creating a new row", async () => {
  const linked = { ...row, id: site }
  query.maybeSingle.mockResolvedValueOnce({ data: row }).mockResolvedValueOnce({ data: linked })
  query.single.mockResolvedValueOnce({ data: linked })
  await expect(createCopyTemplate(site, id, { kind: "whatsapp", title: "Follow-up", body: "Hi {{1}}" })).resolves.toEqual({ id: linked.id, item: linked })
  expect(query.eq.mock.calls).toEqual([["site_id", site], ["id", id], ["site_id", site], ["site_id", site], ["id", linked.id]])
  expect(query.contains).toHaveBeenNthCalledWith(2, "tags", ["whatsapp-template", whatsappTemplateSourceTag(id)])
  expect(query.update).toHaveBeenCalledWith({ title: "Follow-up", content: "Hi {{1}}", updated_at: expect.any(String) })
  expect(query.insert).not.toHaveBeenCalled()
})

it("updates a legacy WhatsApp draft in place", async () => {
  query.maybeSingle.mockResolvedValueOnce({ data: { ...row, tags: ["whatsapp-template"] } })
  await createCopyTemplate(site, id, { kind: "whatsapp", title: "Follow-up", body: "Hi {{1}}" })
  expect(query.maybeSingle).toHaveBeenCalledTimes(1)
  expect(query.eq.mock.calls).toEqual([["site_id", site], ["id", id], ["site_id", site], ["id", id]])
  expect(query.contains).toHaveBeenCalledWith("tags", ["whatsapp-template"])
  expect(query.insert).not.toHaveBeenCalled()
})

it("does not mutate the linked draft without update capability", async () => {
  query.maybeSingle.mockResolvedValueOnce({ data: row }).mockResolvedValueOnce({ data: { id: site } })
  jest.mocked(userCanOnSite).mockResolvedValueOnce(false)
  await expect(createCopyTemplate(site, id, { kind: "whatsapp", title: "Follow-up", body: "Hi" })).rejects.toThrow("denied")
  expect(userCanOnSite).toHaveBeenCalledWith(expect.anything(), site, "update")
  expect(query.update).not.toHaveBeenCalled()
  expect(query.insert).not.toHaveBeenCalled()
})

it("renders repeated named and numbered placeholders literally and rejects unresolved values", () => {
  const body = "Hi {{ name }}: {{1}} / {{name}} / {{constructor}}"
  expect(copyTemplateVariables("{{name}}", body)).toEqual(["name", "1", "constructor"])
  const test = (content: string) => copyTestSchema.safeParse({ copy_id: id, lead_id: site, draft: { kind: "whatsapp", title: "WhatsApp", body: content } }).success
  expect(test(renderCopyTemplate(body, { name: "Ana", 1: " " }))).toBe(false)
  const rendered = renderCopyTemplate(body, { name: "Ana", 1: "$&", constructor: "OK" })
  expect(rendered).toBe("Hi Ana: $& / Ana / OK")
  expect(test(rendered)).toBe(true)
  expect(test("Hi {{bad name}}")).toBe(false)
})

it("does not create a template from a missing source or blocked Content screen", async () => {
  const draft = { kind: "newsletter", title: "April", body: "Newsletter body" } as const
  jest.mocked(readWorkspaceScreenScope).mockResolvedValueOnce({ status: "ready", role: "collaborator", blockedScreens: ["content"], locationRestricted: false })
  await expect(createCopyTemplate(site, id, draft)).rejects.toThrow("denied")
  query.maybeSingle.mockResolvedValueOnce({ data: null })
  await expect(createCopyTemplate(site, id, draft)).rejects.toThrow("Source copy unavailable")
  expect(query.insert).not.toHaveBeenCalled()
})

it("uses the Settings data contract and has a localized Sales launch entry", () => {
  const settings = siteFormSchema.shape.copywriting.removeDefault().unwrap().element.shape
  expect(COPY_TYPES).toEqual(settings.copy_type.options)
  expect(COPY_STATUSES).toEqual(settings.status.removeDefault().unwrap().options)
  expect(findNavigationMenuItem("copywriting")).toEqual({ area: "sales", item: { key: "copywriting", href: "/copywriting" } })
  expect(getNavKeyForPath("/copywriting", new URLSearchParams())).toBe("copywriting")
  expect(workspaceScreenTitle("/copywriting", key => rawLocaleMessages.es[key] ?? key)).toBe("Textos comerciales")
  for (const catalog of Object.values(rawLocaleMessages)) {
    for (const key of [...COPY_TYPES.map(type => `types.${type}`), ...COPY_STATUSES.map(status => `statuses.${status}`)]) {
      expect(catalog[`copywriting.screen.${key}`]).toBeTruthy()
    }
  }
})