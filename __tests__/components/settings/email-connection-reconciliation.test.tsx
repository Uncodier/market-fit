import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { FormProvider, useForm } from "react-hook-form"
import { useEmailConnectionReconciliation } from "@/app/components/settings/use-email-connection-reconciliation"
import type { SiteFormValues } from "@/app/components/settings/form-schema"

const readMock = jest.fn()
const fromMock = jest.fn()
const setValues = jest.fn()
const notifyMock = jest.fn()
jest.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: (...args: unknown[]) => fromMock(...args) }) }))
jest.mock("@/app/context/site-resource-sync", () => ({ notifySiteResourcesUpdated: (...args: unknown[]) => notifyMock(...args) }))

const channel = (id: string, metadata = {}) => ({ id, type: "email", name: id, status: "pending" as const, metadata })
const draft = channel("draft")
const sales = channel("sales", { domain: "example.com" })
const support = channel("support", { emailReceivingEnabled: false })
const canonicalSales = { ...sales, zavu_sender_id: "sales_sender", metadata: {
  domain: "example.com", email_domain_id: "domain_1", domain_status: "verified", zavu_webhook_secret: "synthetic-encrypted-fixture",
} }
const canonicalSupport = { ...support, metadata: { emailReceivingEnabled: true }, enabled: true }

function Action({ siteId }: { siteId: string }) {
  const reconcile = useEmailConnectionReconciliation(siteId)
  return <button onClick={() => { void reconcile("sales").catch((error: Error) => setValues(error.message)) }}>Refresh</button>
}

function Harness({ siteId = "site_1" }: { siteId?: string }) {
  const form = useForm<SiteFormValues>({ defaultValues: { channels: { connections: [sales, support, draft] } } })
  setValues(form)
  return <FormProvider {...form}><Action siteId={siteId} /></FormProvider>
}

function query(result: unknown) {
  const builder = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), abortSignal: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockImplementation(() => readMock(result)),
  }
  fromMock.mockReturnValue(builder)
  return builder
}

describe("canonical email connection reconciliation", () => {
  beforeEach(() => { jest.clearAllMocks(); readMock.mockImplementation(async (result) => result) })

  it("reads canonical state under RLS without a second settings mutation, preserving drafts and provider metadata", async () => {
    const builder = query({ data: { channels: { connections: [canonicalSales, canonicalSupport] } }, error: null })
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(setValues.mock.calls[0][0].getValues("channels.connections")[0]).toEqual(canonicalSales))
    expect(setValues.mock.calls[0][0].getValues("channels.connections")).toEqual([canonicalSales, canonicalSupport, draft])
    expect(fromMock).toHaveBeenCalledWith("settings")
    expect(builder.select).toHaveBeenCalledWith("channels")
    expect(builder.eq).toHaveBeenCalledWith("site_id", "site_1")
    expect(notifyMock).toHaveBeenCalledWith("site_1")
    expect(Object.keys(builder)).not.toContain("update")
  })

  it("keeps unsaved labels on independent addresses and non-email drafts", async () => {
    query({ data: { channels: { connections: [canonicalSales, { ...canonicalSupport, name: "Server label" }] } }, error: null })
    render(<Harness />)
    const form = setValues.mock.calls[0][0]
    act(() => { form.setValue("channels.connections.1.name", "Unsaved support label") })
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(form.getValues("channels.connections.0.zavu_sender_id")).toBe("sales_sender"))
    expect(form.getValues("channels.connections.1.name")).toBe("Unsaved support label")
    expect(form.getValues("channels.connections.1.metadata.emailReceivingEnabled")).toBe(true)
  })

  it.each([
    { data: null, error: { message: "failed" } },
    { data: { channels: { connections: [] } }, error: null },
    { data: { channels: { connections: [canonicalSales, canonicalSales] } }, error: null },
    { data: { channels: { connections: [{ ...canonicalSales, type: "sms" }] } }, error: null },
  ])("does not replay a provider mutation or overwrite form state after a bad read %j", async (result) => {
    query(result)
    render(<Harness />)
    const form = setValues.mock.calls[0][0]
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(setValues).toHaveBeenCalledWith(expect.stringContaining("were saved")))
    expect(form.getValues("channels.connections")).toEqual([sales, support, draft])
  })

  it("discards a completed read if the user switched sites while it was pending", async () => {
    let resolve!: (value: unknown) => void
    readMock.mockReturnValue(new Promise((done) => { resolve = done }))
    query(undefined)
    const { rerender } = render(<Harness />)
    const form = setValues.mock.calls[0][0]
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    rerender(<Harness siteId="site_2" />)
    await act(async () => { resolve({ data: { channels: { connections: [canonicalSales] } }, error: null }) })
    expect(form.getValues("channels.connections")).toEqual([sales, support, draft])
  })
})