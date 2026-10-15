/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/lib/marketplace/merchant/connection", () => ({ loadConnection: jest.fn(), requireFreshMerchantToken: jest.fn() }))
jest.mock("@/lib/marketplace/merchant/webhook-keys", () => ({ readWebhookKeys: jest.fn(async()=>({})), saveWebhookKey:jest.fn() }))
jest.mock("@/lib/marketplace/merchant/providers", () => ({ activateMerchantStore:jest.fn(),deactivateMerchantStore:jest.fn(),getMerchantStoreStatus:jest.fn(),
  registerRappiProvisioningWebhook:jest.fn(),registerRappiStoreWebhooks:jest.fn() }))
import { randomBytes, randomUUID } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { loadConnection } from "@/lib/marketplace/merchant/connection"
import { activateConnectedStore } from "@/lib/marketplace/merchant/provisioning"
import { activateMerchantStore, getMerchantStoreStatus, registerRappiStoreWebhooks } from "@/lib/marketplace/merchant/providers"

describe("merchant activation orchestration", () => {
  const siteId=randomUUID(), actorId=randomUUID(), connectionId=randomUUID(), claimId=randomUUID()
  const input={site_id:siteId,connection_id:connectionId,external_store_id:"provider-store",origin_location_id:randomUUID()}
  let rpc: jest.Mock
  beforeEach(()=>{
    jest.clearAllMocks()
    jest.mocked(loadConnection).mockResolvedValue({ connection:{id:connectionId,site_id:siteId,provider:"rappi",environment:"sandbox",country:"MX",
      credential_mode:"platform",status:"authorized",app_client_id_hash:randomBytes(32).toString("hex"),encrypted_authorization:"test",token_expires_at:null,authorized_stores:[{id:input.external_store_id,name:"Kitchen"}]},
      app:{provider:"rappi",environment:"sandbox",country:"MX",client_id:randomUUID(),client_secret:randomBytes(32).toString("hex"),
        integration_id:randomUUID(),redirect_uri:"https://app.example.test/api/marketplace/oauth/rappi/callback",webhook_url:"https://app.example.test/api/marketplace/webhooks/rappi"},merchantToken:randomBytes(32).toString("hex") })
    jest.mocked(getMerchantStoreStatus).mockResolvedValue({id:input.external_store_id,name:"Kitchen",integration_status:"active",integrated:true})
    rpc=jest.fn(async(name:string)=>({error:null,data:name==="claim_marketplace_provisioning"?{batch_id:claimId,duplicate:false}:name==="claim_marketplace_webhook_registration"?{claim_id:randomUUID(),acquired:true}:{} }))
    const query={select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),maybeSingle:jest.fn(async()=>({error:null,data:null}))}
    jest.mocked(createServiceClient).mockResolvedValue({rpc,from:()=>query})
  })
  it("registers Rappi order webhook keys before confirming an already-integrated store active", async()=>{
    const sequence:string[]=[]
    jest.mocked(activateMerchantStore).mockResolvedValue({status:"active"})
    jest.mocked(registerRappiStoreWebhooks).mockImplementation(async()=>{sequence.push("webhooks");return {}})
    rpc.mockImplementation(async(name:string,args:Record<string,unknown>)=>{
      if(name==="finish_marketplace_provisioning")sequence.push(String(args.p_result))
      return {error:null,data:name==="claim_marketplace_provisioning"?{batch_id:claimId,duplicate:false}:name==="claim_marketplace_webhook_registration"?{claim_id:randomUUID(),acquired:true}:{}}
    })
    expect(await activateConnectedStore(input,actorId)).toMatchObject({status:"active"})
    expect(sequence).toEqual(["webhooks","confirmed"])
  })
  it("does not falsely confirm active when Rappi webhook registration fails", async()=>{
    jest.mocked(activateMerchantStore).mockResolvedValue({status:"active"})
    jest.mocked(registerRappiStoreWebhooks).mockRejectedValue(new Error("Provider response unavailable"))
    await expect(activateConnectedStore(input,actorId)).rejects.toThrow("pending or uncertain")
    const finishes=rpc.mock.calls.filter(([name])=>name==="finish_marketplace_provisioning")
    expect(finishes).toHaveLength(1)
    expect(finishes[0][1].p_result).toBe("unknown")
  })
  it("never repeats activation on a durable pending claim", async()=>{
    rpc.mockImplementation(async(name:string)=>({error:null,data:name==="claim_marketplace_provisioning"?{batch_id:claimId,duplicate:true,integration:{provisioning_status:"pending"}}:{}}))
    expect(await activateConnectedStore(input,actorId)).toMatchObject({status:"pending"})
    expect(activateMerchantStore).not.toHaveBeenCalled()
    expect(registerRappiStoreWebhooks).not.toHaveBeenCalled()
  })
})