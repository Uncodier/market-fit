/** @jest-environment node */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import * as script from '../../scripts/repair-stripe-sale-wallet.cjs'

const site = '00000000-0000-4000-8000-000000000001'
const saleId = '00000000-0000-4000-8000-000000000002'
const orderId = '00000000-0000-4000-8000-000000000003'
const args = ['--site', site, '--session', 'cs_test_repair', '--project', 'abcdefghijklmnopqrst', '--mode', 'test']
const manual = ['--verified-usd-minor', '830', '--evidence-reference', 'approved-case:local-proof', '--ack-manual-usd']
const root = process.cwd()
const env = { STRIPE_SECRET_KEY: 'sk_test_fake', SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: `header.${Buffer.from(JSON.stringify({ role: 'service_role', ref: 'abcdefghijklmnopqrst' })).toString('base64url')}.signature` }

function setup(extraArgs: string[] = []) {
  const options = script.parseOptions([...args, ...extraArgs])
  const effect = { stripe_session_id: options.session, sale_reference: saleId, sale_id: saleId, order_id: orderId,
    payment_intent_id: 'pi_test_repair', amount_minor: 16400, currency: 'mxn',
    financial_status: 'completed', settlement_status: 'settled', compensation_status: 'not_required', stripe_refund_id: null }
  const sale = { id: saleId, site_id: site, stripe_checkout_session_id: options.session,
    stripe_payment_intent_id: 'pi_test_repair', currency: 'MXN', amount_due: 0, status: 'completed' }
  const payment = { site_id: site, amount: 164, currency: 'MXN', details: { sale_id: saleId,
    stripe_session_id: options.session, stripe_payment_intent_id: 'pi_test_repair' } } as {
      site_id: string; amount: number; currency: string; details: Record<string, unknown>
    }
  const commission = { amount: 8.2, currency: 'MXN', details: {} }
  const session = { id: options.session, mode: 'payment', status: 'complete', payment_status: 'paid', livemode: false,
    metadata: { site_id: site, sale_id: saleId, type: 'sale_order', order_id: orderId }, payment_intent: 'pi_test_repair', currency: 'mxn', amount_total: 16400 }
  const charge = { id: 'ch_test_repair', payment_intent: 'pi_test_repair', status: 'succeeded', paid: true,
    amount: 16400, amount_captured: 16400, currency: 'mxn', livemode: false, refunded: false, amount_refunded: 0, disputed: false }
  const intent = { id: 'pi_test_repair', status: 'succeeded', amount: 16400, amount_received: 16400,
    currency: 'mxn', livemode: false, latest_charge: charge }
  const stripe = { checkout: { sessions: { retrieve: jest.fn(async () => session) } },
    paymentIntents: { retrieve: jest.fn(async () => intent) }, charges: { retrieve: jest.fn(async () => charge) } }
  const preview = { status: 'preview', audit: { usd_amount_minor: 830, balance_delta: -147.92 } }
  const rpc = jest.fn(async (_name: string, parameters: { p_apply: boolean }) => ({ data: {
    ...preview, status: parameters.p_apply ? 'repaired' : 'preview',
  }, error: null }))
  const from = jest.fn((table: string) => {
    const filters: Record<string, string> = {}
    const query: { select: jest.Mock; eq: jest.Mock; single: jest.Mock } = { select: jest.fn(() => query), eq: jest.fn((key: string, value: string) => { filters[key] = value; return query }),
      single: jest.fn(async () => ({ data: table === 'stripe_sale_checkout_effects' ? effect : table === 'sales' ? sale :
        filters.transaction_id?.startsWith('commission_') ? commission : payment, error: null })) }
    return query
  })
  const resolveAmount = jest.fn(async () => ({ amount: 8.3, currency: 'USD' }))
  return { options, supabase: { from, rpc }, stripe, resolveAmount, effect, sale, payment, session, intent, charge }
}

describe('Stripe wallet repair CLI authorization and evidence', () => {
  it('defaults to preview and requires explicit target and mode', () => {
    expect(script.parseOptions(args)).toMatchObject({ apply: false, mode: 'test', site })
    for (const bad of [[], ['--mode', 'test'], [...args, '--apply', '--apply'], [...args, '--unknown']]) {
      expect(() => script.parseOptions(bad)).toThrow()
    }
    expect(() => script.parseOptions(args.map(value => value === 'test' ? 'live' : value).concat('--apply'))).toThrow('Live apply requires')
  })

  it('validates explicit credentials and binds URL and JWT to the confirmed project without loading env files', () => {
    const options = script.parseOptions(args)
    expect(script.validateEnvironment(env, options)).toMatchObject({ url: env.SUPABASE_URL })
    for (const bad of [{ ...env, STRIPE_SECRET_KEY: 'sk_live_fake' }, { ...env, SUPABASE_URL: 'https://other.supabase.co' },
      { ...env, SUPABASE_SERVICE_ROLE_KEY: 'not-service-role' }, {}]) {
      expect(() => script.validateEnvironment(bad, options)).toThrow()
    }
  })

  it('requires all manual flags and a safe integer and non-secret evidence reference', () => {
    expect(script.parseOptions([...args, ...manual])).toMatchObject({ ackManualUsd: true, verifiedUsdMinor: '830' })
    for (const invalid of [manual.slice(0, -1), ['--ack-manual-usd'], ['--verified-usd-minor', '830'],
      ['--verified-usd-minor', '8.30', '--evidence-reference', 'case:proof', '--ack-manual-usd'],
      ['--verified-usd-minor', '9007199254740992', '--evidence-reference', 'case:proof', '--ack-manual-usd']]) {
      expect(() => script.parseOptions([...args, ...invalid])).toThrow('Manual USD evidence requires')
    }
  })

  it('re-fetches checkout then verifies PI and charge before a preview-only RPC', async () => {
    const dependencies = setup()
    expect((await script.runRepair(dependencies)).status).toBe('preview')
    expect(dependencies.stripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_test_repair')
    expect(dependencies.stripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_test_repair', { expand: ['latest_charge'] })
    expect(dependencies.resolveAmount).toHaveBeenCalledWith(dependencies.stripe, dependencies.session)
    expect(dependencies.supabase.rpc).toHaveBeenCalledTimes(1)
    expect(dependencies.supabase.rpc).toHaveBeenCalledWith('repair_stripe_sale_wallet_currency', expect.objectContaining({
      p_apply: false, p_site_id: site, p_expected_gross: 164, p_expected_commission: 8.2, p_expected_currency: 'MXN', p_usd_amount_minor: 830,
      p_evidence: expect.objectContaining({ source: 'resolveStripeSaleWalletAmount', checkout_amount_minor: 16400, checkout_currency: 'mxn' }),
    }))
  })

  it('applies only after successful preview and only with --apply', async () => {
    const dependencies = setup(['--apply'])
    expect((await script.runRepair(dependencies)).status).toBe('repaired')
    expect(dependencies.supabase.rpc.mock.calls.map(call => call[1].p_apply)).toEqual([false, true])
  })

  it('uses manually verified evidence only when explicitly selected, while still verifying PI/charge', async () => {
    const dependencies = setup(manual)
    await script.runRepair(dependencies)
    expect(dependencies.resolveAmount).not.toHaveBeenCalled()
    expect(dependencies.stripe.paymentIntents.retrieve).toHaveBeenCalledTimes(1)
    expect(dependencies.supabase.rpc).toHaveBeenCalledWith('repair_stripe_sale_wallet_currency', expect.objectContaining({
      p_usd_amount_minor: 830, p_evidence: expect.objectContaining({ source: 'verified_operator_usd',
        evidence_reference: 'approved-case:local-proof', ack_manual_usd: true }),
    }))
  })

  it('does not fall back or call RPC when resolver fails to prove USD', async () => {
    const dependencies = setup(['--apply'])
    dependencies.resolveAmount.mockRejectedValue(new Error('Non-USD balance transaction'))
    await expect(script.runRepair(dependencies)).rejects.toThrow('Non-USD balance transaction')
    expect(dependencies.supabase.rpc).not.toHaveBeenCalled()
  })

  it.each(['sale', 'site', 'order', 'type', 'amount', 'currency', 'intent', 'status', 'mode', 'effect', 'payment', 'refunded', 'disputed'])
  ('refuses forged/mismatched checkout or unsafe charge before RPC (%s)', async kind => {
    const dependencies = setup(['--apply'])
    if (kind === 'sale') dependencies.session.metadata.sale_id = site
    if (kind === 'site') dependencies.session.metadata.site_id = saleId
    if (kind === 'order') dependencies.session.metadata.order_id = saleId
    if (kind === 'type') dependencies.session.metadata.type = 'sale'
    if (kind === 'amount') dependencies.session.amount_total = 123
    if (kind === 'currency') dependencies.session.currency = 'usd'
    if (kind === 'intent') dependencies.session.payment_intent = 'pi_forged'
    if (kind === 'status') dependencies.session.payment_status = 'unpaid'
    if (kind === 'mode') dependencies.session.livemode = true
    if (kind === 'effect') dependencies.effect.financial_status = 'pending'
    if (kind === 'payment') dependencies.payment.details.sale_id = site
    if (kind === 'refunded') dependencies.charge.amount_refunded = 1
    if (kind === 'disputed') dependencies.charge.disputed = true
    await expect(script.runRepair(dependencies)).rejects.toThrow()
    expect(dependencies.supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects manual proof too when Stripe identity cannot be verified', async () => {
    const dependencies = setup(manual)
    dependencies.stripe.paymentIntents.retrieve.mockRejectedValue(new Error('Stripe not available'))
    await expect(script.runRepair(dependencies)).rejects.toThrow('Stripe not available')
    expect(dependencies.supabase.rpc).not.toHaveBeenCalled()
  })

  it('uses audit originals on replay and never applies again after already_repaired preview', async () => {
    const dependencies = setup(['--apply'])
    dependencies.payment.amount = 8.3; dependencies.payment.currency = 'USD'
    dependencies.payment.details.fx_repair = { original: { gross: { amount: 164, currency: 'MXN' }, commission: { amount: 8.2 } } }
    dependencies.supabase.rpc.mockResolvedValue({ data: { status: 'already_repaired', audit: { usd_amount_minor: 830, balance_delta: -147.92 } }, error: null })
    await script.runRepair(dependencies)
    expect(dependencies.supabase.rpc).toHaveBeenCalledTimes(1)
    expect(dependencies.supabase.rpc.mock.calls[0][1]).toMatchObject({ p_expected_gross: 164, p_expected_currency: 'MXN', p_expected_commission: 8.2 })
  })

  it('loads the real resolver through ts-node in a clean subprocess without aliases or credentials', () => {
    const code = `const {loadResolver}=require('./scripts/repair-stripe-sale-wallet.cjs'); loadResolver()({}, {
      mode:'payment',status:'complete',payment_status:'paid',amount_total:705,currency:'usd'
    }).then(value => console.log(JSON.stringify(value)));`
    const minimalEnv = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'test' as const }
    expect(JSON.parse(execFileSync(process.execPath, ['-e', code], { cwd: root, env: minimalEnv, encoding: 'utf8' })))
      .toEqual({ amount: 7.05, currency: 'USD' })
    expect(execFileSync(process.execPath, [path.join(root, 'scripts/repair-stripe-sale-wallet.cjs'), '--help'],
      { cwd: root, env: minimalEnv, encoding: 'utf8' })).toContain('Default: read-only preview')
  })
})