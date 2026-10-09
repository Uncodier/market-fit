/** @jest-environment node */
import { randomBytes, randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/stripe/payment-method/route'
import { resolveBillingPaymentMethod } from '@/lib/billing/payment-method.server'
const siteId = randomUUID(), access = jest.fn(), from = jest.fn()
jest.mock('stripe', () => ({ __esModule:true, default:jest.fn(() => ({})) }))
jest.mock('@/lib/auth/api-stripe-access', () => ({requireStripeSiteAccess: (...args:unknown[])=>access(...args)}))
jest.mock('@/lib/billing/payment-method.server', () => ({...jest.requireActual('@/lib/billing/payment-method.server'),resolveBillingPaymentMethod:jest.fn()}))
const original = process.env.STRIPE_SECRET_KEY
beforeEach(()=>{
  jest.clearAllMocks(); process.env.STRIPE_SECRET_KEY=randomBytes(32).toString('hex')
  access.mockResolvedValue({supabase:{from}})
  from.mockReturnValue({select:()=>({eq:()=>({maybeSingle:async()=>({data:{stripe_customer_id:'cus_synthetic',stripe_subscription_id:'sub_synthetic'},error:null})})})})
})
afterAll(()=>{if(original===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=original})
it('uses the same principal Billing card resolver as the top-up proposal',async()=>{
  jest.mocked(resolveBillingPaymentMethod).mockResolvedValue({id:'pm_synthetic',customer:'cus_synthetic',type:'card',card:{brand:'visa',last4:'1234',exp_month:12,exp_year:2099}} as never)
  const response=await GET(new NextRequest(`https://app.example.test/api/stripe/payment-method?siteId=${siteId}`))
  expect(response.status).toBe(200);expect(await response.json()).toEqual({paymentMethod:{brand:'visa',last4:'1234',expMonth:12,expYear:2099}})
  expect(resolveBillingPaymentMethod).toHaveBeenCalledWith(expect.anything(),'cus_synthetic',siteId,'sub_synthetic')
})
it('rejects unauthenticated requests before provider access',async()=>{
  access.mockResolvedValueOnce({error:Response.json({}, {status:401})})
  expect((await GET(new NextRequest(`https://app.example.test/api/stripe/payment-method?siteId=${siteId}`))).status).toBe(401)
  expect(resolveBillingPaymentMethod).not.toHaveBeenCalled()
})
it('does not leak provider errors',async()=>{
  const sensitive=randomBytes(32).toString('hex');jest.mocked(resolveBillingPaymentMethod).mockRejectedValueOnce(new Error(sensitive))
  const response=await GET(new NextRequest(`https://app.example.test/api/stripe/payment-method?siteId=${siteId}`))
  expect(response.status).toBe(503);expect(await response.text()).not.toContain(sensitive)
})
