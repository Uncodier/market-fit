/** @jest-environment jsdom */
import "@testing-library/jest-dom"
import { randomUUID } from "node:crypto"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { MarketplaceMerchantConnect } from "@/app/integrations/components/MarketplaceMerchantConnect"
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), message: jest.fn() } }))
jest.mock("@/app/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange: (value:string)=>void }) =>
    <select aria-label="Method selector" value={value} onChange={event => onValueChange(event.target.value)}>{children}</select>,
  SelectContent: ({children}:{children:React.ReactNode})=><>{children}</>,
  SelectTrigger: ()=>null, SelectValue: ()=>null,
  SelectItem: ({children,value,disabled}:{children:React.ReactNode;value:string;disabled?:boolean})=><option value={value} disabled={disabled}>{children}</option>,
}))

const props = { provider: "uber_eats" as const, siteId: randomUUID(), canManage: true,
  platformApps: { production: true, sandbox: false }, locations: [{id:randomUUID(),name:"Main kitchen"}], integrations: [], onChanged:jest.fn() }
beforeEach(() => { global.fetch = jest.fn(async () => ({ok:true,json:async()=>({connections:[]})})) as unknown as typeof fetch })

it("defaults to Makinari with no credential entry and leaves developer credentials opt-in", async () => {
  render(<MarketplaceMerchantConnect {...props} />)
  expect(screen.getAllByLabelText("Method selector")[0]).toHaveValue("platform")
  expect(screen.getByRole("button",{name:"Authorize Uber Eats"})).not.toBeDisabled()
  expect(screen.getByRole("button",{name:"Authorize Uber Eats"})).toHaveClass("ring-input")
  expect(screen.getByRole("button",{name:"Authorize Uber Eats"}).closest("div.border-t")).toHaveClass("justify-end")
  expect(screen.queryByLabelText("Your application Client secret")).not.toBeInTheDocument()
  fireEvent.change(screen.getAllByLabelText("Method selector")[0], {target:{value:"custom"}})
  expect(screen.getByLabelText("Your application Client secret")).toHaveAttribute("type","password")
  expect(screen.getByLabelText("Your application Client ID")).toHaveAttribute("type","password")
  await act(async()=>{ await Promise.resolve() })
})
it("cannot authorize an unconfigured platform environment", async () => {
  render(<MarketplaceMerchantConnect {...props} platformApps={{production:false,sandbox:false}} />)
  expect(screen.getByRole("button",{name:"Authorize Uber Eats"})).toBeDisabled()
  expect(screen.getByRole("status")).toHaveTextContent("not configured")
  await act(async()=>{ await Promise.resolve() })
})
it("does not discover merchant accounts for read-only members", () => {
  render(<MarketplaceMerchantConnect {...props} canManage={false} />)
  expect(global.fetch).not.toHaveBeenCalled()
  expect(screen.getByRole("button",{name:"Authorize Uber Eats"})).toBeDisabled()
})
it("shows pending store status rather than implying provider acknowledgement means connected", async () => {
  render(<MarketplaceMerchantConnect {...props} integrations={[{id:randomUUID(),site_id:props.siteId,provider:"uber_eats",environment:"production",country:"MX",
    external_store_id:"authorized-store",origin_location_id:props.locations[0].id,enabled:true,manual_ready:false,credential_mode:"platform",provisioning_status:"pending",
    has_credentials:{client_id:true,client_secret:true,webhook_secret:false},webhook_url:"https://app.example.test/api/marketplace/webhooks/uber_eats"}]} />)
  expect(screen.getByText("authorized-store · pending")).toBeInTheDocument()
  expect(screen.getByRole("button",{name:"Refresh status"})).toBeInTheDocument()
  await waitFor(()=>expect(global.fetch).toHaveBeenCalledTimes(1))
})

it("keeps activation in the footer and submits the selected provider store and native location", async () => {
  const connectionId = randomUUID(), onChanged = jest.fn()
  const fetchMock = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ connections: [{ id: connectionId, provider: "uber_eats", environment: "production", country: "MX",
      authorization_expired: false, stores: [{ id: "store-1", name: "Authorized kitchen" }] }] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "pending" }) })
  global.fetch = fetchMock
  render(<MarketplaceMerchantConnect {...props} onChanged={onChanged} />)
  const activate = await screen.findByRole("button", { name: "Activate selected store" })
  expect(activate.closest("div.border-t")).toHaveClass("justify-end")
  expect(activate).toHaveClass("ring-input")
  expect(activate).toBeDisabled()
  const selectors = screen.getAllByLabelText("Method selector")
  fireEvent.change(selectors[3], { target: { value: `${connectionId}:store-1` } })
  fireEvent.change(selectors[4], { target: { value: props.locations[0].id } })
  expect(activate).not.toBeDisabled()
  fireEvent.click(activate)
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
  expect(fetchMock.mock.calls[1][0]).toBe(`/api/marketplace/merchant-connections/${connectionId}/stores`)
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ siteId: props.siteId, external_store_id: "store-1", origin_location_id: props.locations[0].id })
})