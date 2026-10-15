/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient:jest.fn() }))
jest.mock("@/lib/marketplace/merchant/connection", () => ({loadConnection:jest.fn()}))
jest.mock("@/lib/marketplace/merchant/reconcile", () => ({refreshConnectedStore:jest.fn()}))
import { createHmac, randomBytes, randomUUID } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { loadConnection } from "@/lib/marketplace/merchant/connection"
import { refreshConnectedStore } from "@/lib/marketplace/merchant/reconcile"
import { receiveUberProvisioning } from "@/lib/marketplace/merchant/control-events"

describe("signed Uber provisioning control events",()=>{
  const secret=randomBytes(32).toString("hex"),siteId=randomUUID(),id=randomUUID()
  const signingKey = randomBytes(32).toString("hex")
  const originalKey = process.env.UBER_EATS_WEBHOOK_SIGNING_KEY
  afterEach(() => {
    if (originalKey === undefined) delete process.env.UBER_EATS_WEBHOOK_SIGNING_KEY
    else process.env.UBER_EATS_WEBHOOK_SIGNING_KEY = originalKey
  })
  beforeEach(()=>{
    jest.clearAllMocks()
    process.env.UBER_EATS_WEBHOOK_SIGNING_KEY = signingKey
    const query={select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({error:null,data:[{id,site_id:siteId,merchant_connection_id:randomUUID()}]}).then(resolve)}
    jest.mocked(createServiceClient).mockResolvedValue({from:()=>query})
    jest.mocked(loadConnection).mockResolvedValue({app:{provider:"uber_eats",environment:"production",country:"MX",client_id:randomUUID(),client_secret:secret,
      redirect_uri:"https://app.example.test/callback",webhook_url:"https://app.example.test/webhook"},merchantToken:randomBytes(32).toString("hex"),
      connection:{id:randomUUID(),site_id:siteId,provider:"uber_eats",environment:"production",country:"MX",credential_mode:"platform",app_client_id_hash:randomBytes(32).toString("hex"),
        encrypted_authorization:"test",token_expires_at:null,authorized_stores:[],status:"authorized"}})
    jest.mocked(refreshConnectedStore).mockResolvedValue({status:"pending"})
  })
  it("only triggers an authoritative read, without assuming nomination means active",async()=>{
    const payload={event_type:"store.provisioned",meta:{user_id:randomUUID()}},raw=JSON.stringify(payload)
    const request=new Request("https://app.example.test/api/marketplace/webhooks/uber_eats",{method:"POST",headers:{"x-uber-signature":createHmac("sha256",signingKey).update(raw).digest("hex")},body:raw})
    expect(await receiveUberProvisioning(request,raw,payload)).toBe(true)
    expect(refreshConnectedStore).toHaveBeenCalledWith(id,siteId)
  })
  it("rejects invalid signatures before any provider read or state mutation",async()=>{
    const payload={event_type:"store.deprovisioned",user_id:randomUUID()},raw=JSON.stringify(payload)
    await expect(receiveUberProvisioning(new Request("https://app.example.test/webhook"),raw,payload)).rejects.toThrow("signature")
    expect(refreshConnectedStore).not.toHaveBeenCalled()
  })
  it("does not accept the OAuth secret when an independent signing key is configured", async () => {
    const payload = { event_type: "store.provisioned", user_id: randomUUID() }, raw = JSON.stringify(payload)
    const request = new Request("https://app.example.test/webhook", { headers: {
      "x-uber-signature": createHmac("sha256", secret).update(raw).digest("hex"),
    } })
    await expect(receiveUberProvisioning(request, raw, payload)).rejects.toThrow("signature")
    expect(refreshConnectedStore).not.toHaveBeenCalled()
  })
  it("does not treat an order resource_id as an authorized store selector",async()=>{
    const payload={event_type:"store.provisioned",resource_id:randomUUID()},raw=JSON.stringify(payload)
    await expect(receiveUberProvisioning(new Request("https://app.example.test/webhook"),raw,payload)).rejects.toThrow("store unavailable")
    expect(refreshConnectedStore).not.toHaveBeenCalled()
  })
})