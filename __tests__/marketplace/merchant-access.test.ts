/** @jest-environment node */
jest.mock("server-only",()=>({}))
jest.mock("@/lib/auth/api-site-access",()=>({requireSiteAccess:jest.fn()}))
import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { requireMerchantManager } from "@/lib/marketplace/merchant/access"

it("retains authentication failures before using service-owned merchant data",async()=>{
  const denied=NextResponse.json({error:"Unauthorized"},{status:401})
  jest.mocked(requireSiteAccess).mockResolvedValue({error:denied})
  expect(await requireMerchantManager(new Request("https://app.example.test"),randomUUID())).toEqual({error:denied})
})
it("requires update permission even when the user has a manager role",async()=>{
  const rpc=jest.fn(async()=>({data:false,error:null})),siteId=randomUUID()
  jest.mocked(requireSiteAccess).mockResolvedValue({role:"admin",userId:randomUUID(),userEmail:null,supabase:{rpc}})
  const access=await requireMerchantManager(new Request("https://app.example.test"),siteId)
  expect(access.error?.status).toBe(403)
  expect(rpc).toHaveBeenCalledWith("user_can",{p_site_id:siteId,p_command:"update"})
})