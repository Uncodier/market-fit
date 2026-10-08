import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import {
  CATALOG, parseOptions, validateKey, preparePrices, provisionPrices, safeError,
} from '../../scripts/stripe-annual-prices.cjs'

const options = (extra = {}) => ({ mode: 'test', account: 'acct_synthetic', apply: false, ...extra })
const makePrice = (id, product, amount, interval = 'month', extra = {}) => ({
  id, product, active: true, livemode: false, currency: 'usd', unit_amount: amount,
  type: 'recurring', recurring: { interval, interval_count: 1, usage_type: 'licensed' },
  billing_scheme: 'per_unit', transform_quantity: null, custom_unit_amount: null,
  tax_behavior: 'exclusive', lookup_key: null, ...extra,
})

function fixture() {
  const env = Object.fromEntries(CATALOG.map(entry => [entry.month, `price_month${entry.plan}`]))
  const prices = CATALOG.map(entry => makePrice(env[entry.month], `prod_${entry.plan}`, entry.monthly))
  let counter = 0
  const stripe = {
    accounts: { retrieve: jest.fn(async () => ({ id: 'acct_synthetic' })) },
    products: { retrieve: jest.fn(async id => ({ id, active: true, livemode: false })) },
    prices: {
      retrieve: jest.fn(async id => {
        const price = prices.find(item => item.id === id)
        if (!price) throw new Error('Synthetic missing price')
        return price
      }),
      list: jest.fn(async filters => ({ has_more: false, data: prices.filter(price =>
        price.active === filters.active && (!filters.product || price.product === filters.product) &&
        (!filters.currency || price.currency === filters.currency) &&
        (!filters.type || price.type === filters.type) &&
        (!filters.lookup_keys || filters.lookup_keys.includes(price.lookup_key))) })),
      create: jest.fn(async params => {
        const price = makePrice(`price_created${++counter}`, params.product, params.unit_amount, 'year', params)
        prices.push(price)
        return price
      }),
    },
  }
  return { env, prices, stripe, log: jest.fn() }
}

describe('annual Stripe price provisioning (offline)', () => {
  it('previews by default; explicit dry-run overrides apply even in live mode', () => {
    expect(parseOptions(['--mode', 'test', '--account', 'acct_synthetic']).apply).toBe(false)
    expect(parseOptions(['--mode', 'live', '--account', 'acct_synthetic', '--apply', '--dry-run']).apply).toBe(false)
    expect(parseOptions(['--mode', 'live', '--account', 'acct_synthetic', '--apply', '--confirm-live']).apply).toBe(true)
  })

  it.each([
    [], ['--mode', 'other', '--account', 'acct_synthetic'], ['--mode', 'test'],
    ['--mode'], ['--mode', 'live', '--account', 'acct_synthetic', '--apply'], ['--secret-key'],
  ].map(args => ({ args })))('rejects unsafe or incomplete arguments ($args)', ({ args }) => {
    expect(() => parseOptions(args)).toThrow()
  })

  it('validates mode without exposing synthetic credentials', () => {
    const secret = `sk_test_${randomBytes(24).toString('hex')}`
    expect(validateKey({ STRIPE_SECRET_KEY: secret }, 'test')).toBe(secret)
    let error
    try { validateKey({ STRIPE_SECRET_KEY: secret }, 'live') } catch (caught) { error = caught }
    expect(safeError(error)).not.toContain(secret)
    expect(safeError(new Error(`Provider reflected ${secret}`))).not.toContain(secret)
    expect(() => validateKey({}, 'test')).toThrow('STRIPE_SECRET_KEY is required')
  })

  it('previews all four annual prices without writes or secret output', async () => {
    const { stripe, env, log } = fixture()
    const secret = `sk_test_${randomBytes(24).toString('hex')}`
    await expect(provisionPrices(stripe, { ...env, STRIPE_SECRET_KEY: secret }, options(), log)).resolves.toEqual({})
    expect(stripe.prices.create).not.toHaveBeenCalled()
    expect(log.mock.calls.flat().join('\n')).not.toContain(secret)
    for (const amount of ['248.40', '1069.20', '5400.00', '108.00']) {
      expect(log.mock.calls.flat().join('\n')).toContain(`USD ${amount}/year`)
    }
  })

  it('creates only missing annual prices, copies tax behavior, and reuses all prices on rerun', async () => {
    const { stripe, env, log } = fixture()
    const result = await provisionPrices(stripe, env, options({ apply: true }), log)
    expect(Object.keys(result)).toEqual(CATALOG.map(entry => entry.year))
    expect(stripe.prices.create).toHaveBeenCalledTimes(4)
    for (const [index, entry] of CATALOG.entries()) {
      const [params, request] = stripe.prices.create.mock.calls[index]
      expect(params).toMatchObject({
        product: `prod_${entry.plan}`, currency: 'usd', unit_amount: entry.monthly * 108 / 10,
        billing_scheme: 'per_unit', tax_behavior: 'exclusive',
        recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' },
      })
      expect(params).not.toHaveProperty('product_data')
      expect(params).not.toHaveProperty('transfer_lookup_key')
      expect(params.lookup_key).toMatch(/^makinari_annual_v1_/)
      expect(request.idempotencyKey.length).toBeLessThan(255)
    }
    await expect(provisionPrices(stripe, env, options({ apply: true }), log)).resolves.toEqual(result)
    expect(stripe.prices.create).toHaveBeenCalledTimes(4)
  })

  it('reuses an existing annual price without changing it', async () => {
    const { stripe, prices, env, log } = fixture()
    prices.push(makePrice('price_existing', 'prod_engine', 24840, 'year'))
    const result = await provisionPrices(stripe, env, options({ apply: true }), log)
    expect(result.STRIPE_STARTER_ANNUAL_PRICE_ID).toBe('price_existing')
    expect(stripe.prices.create).toHaveBeenCalledTimes(3)
  })

  it('requires confirmation at the write boundary and validates live-mode resources', async () => {
    const { stripe, prices, env, log } = fixture()
    await expect(provisionPrices(stripe, env, options({ mode: 'live', apply: true }), log)).rejects.toThrow('--confirm-live')
    expect(stripe.accounts.retrieve).not.toHaveBeenCalled()
    for (const price of prices) price.livemode = true
    stripe.products.retrieve.mockImplementation(async id => ({ id, active: true, livemode: true }))
    const create = stripe.prices.create.getMockImplementation()
    stripe.prices.create.mockImplementation(async params => ({ ...await create(params), livemode: true }))
    const result = await provisionPrices(stripe, env, options({ mode: 'live', apply: true, confirmLive: true }), log)
    expect(Object.keys(result)).toHaveLength(4)
    expect(stripe.prices.create).toHaveBeenCalledTimes(4)
  })

  it('requires explicit selection when multiple compatible annual prices exist', async () => {
    const { stripe, prices, env, log } = fixture()
    prices.push(makePrice('price_first', 'prod_engine', 24840, 'year'), makePrice('price_second', 'prod_engine', 24840, 'year'))
    await expect(provisionPrices(stripe, env, options({ apply: true }), log)).rejects.toThrow('Multiple compatible annual prices')
    expect(stripe.prices.create).not.toHaveBeenCalled()
    env.STRIPE_STARTER_ANNUAL_PRICE_ID = 'price_second'
    const result = await provisionPrices(stripe, env, options(), log)
    expect(result.STRIPE_STARTER_ANNUAL_PRICE_ID).toBe('price_second')
  })

  it.each([
    { unit_amount: 1 }, { currency: 'eur' }, { active: false }, { livemode: true },
    { billing_scheme: 'tiered' }, { transform_quantity: { divide_by: 5 } },
    { recurring: { interval: 'month', interval_count: 12, usage_type: 'licensed' } },
    { recurring: { interval: 'month', interval_count: 1, usage_type: 'metered' } },
  ])('validates the entire catalog before writes (%j)', async invalid => {
    const { stripe, prices, env, log } = fixture()
    Object.assign(prices.at(-1), invalid)
    await expect(provisionPrices(stripe, env, options({ apply: true }), log)).rejects.toThrow('compatible active monthly')
    expect(stripe.prices.create).not.toHaveBeenCalled()
  })

  it('rejects configured annual mismatches instead of creating replacements', async () => {
    const { stripe, prices, env, log } = fixture()
    prices.push(makePrice('price_wrongproduct', 'prod_other', 24840, 'year'))
    env.STRIPE_STARTER_ANNUAL_PRICE_ID = 'price_wrongproduct'
    await expect(provisionPrices(stripe, env, options({ apply: true }), log)).rejects.toThrow('not a compatible annual price')
    expect(stripe.prices.create).not.toHaveBeenCalled()
  })

  it('checks account, products, missing configuration and catalog ID uniqueness before writes', async () => {
    const { stripe, env, log } = fixture()
    await expect(provisionPrices(stripe, env, options({ account: 'acct_other', apply: true }), log)).rejects.toThrow('account does not match')
    stripe.products.retrieve.mockResolvedValue({ deleted: true })
    await expect(provisionPrices(stripe, env, options({ apply: true }), log)).rejects.toThrow('inactive or wrong-mode product')
    env.STRIPE_ACCOUNT_ADDON_PRICE_ID = env.STRIPE_STARTER_PRICE_ID
    await expect(provisionPrices(stripe, env, options({ apply: true }), log)).rejects.toThrow('distinct')
    delete env.STRIPE_ACCOUNT_ADDON_PRICE_ID
    await expect(provisionPrices(stripe, env, options({ apply: true }), log)).rejects.toThrow('STRIPE_ACCOUNT_ADDON_PRICE_ID is required')
    expect(stripe.prices.create).not.toHaveBeenCalled()
  })

  it('paginates prices to find an existing annual price beyond the first page', async () => {
    const { stripe, env, log } = fixture()
    const list = stripe.prices.list.getMockImplementation()
    stripe.prices.list.mockImplementation(async filters => {
      if (filters.product === 'prod_engine') {
        if (!filters.starting_after) return { has_more: true, data: [makePrice('price_pageone', 'prod_engine', 100)] }
        expect(filters.starting_after).toBe('price_pageone')
        return { has_more: false, data: [makePrice('price_pagelast', 'prod_engine', 24840, 'year')] }
      }
      return list(filters)
    })
    const result = await provisionPrices(stripe, env, options(), log)
    expect(result.STRIPE_STARTER_ANNUAL_PRICE_ID).toBe('price_pagelast')
    expect(stripe.prices.create).not.toHaveBeenCalled()
  })

  it('blocks an occupied inactive lookup key and never reactivates or transfers it', async () => {
    const { stripe, prices, env, log } = fixture()
    const prepared = await preparePrices(stripe, env, options())
    prices.push(makePrice('price_retired', 'prod_engine', 24840, 'year', { active: false, lookup_key: prepared[0].params.lookup_key }))
    await expect(provisionPrices(stripe, env, options({ apply: true }), log)).rejects.toThrow('lookup key is already occupied')
    expect(stripe.prices.create).not.toHaveBeenCalled()
  })

  it('fails a read error before any writes and sanitizes provider error output', async () => {
    const { stripe, env, log } = fixture()
    const secret = `sk_test_${randomBytes(24).toString('hex')}`
    stripe.prices.list.mockRejectedValueOnce(new Error(`Synthetic provider error ${secret}`))
    let error
    try { await provisionPrices(stripe, env, options({ apply: true }), log) } catch (caught) { error = caught }
    expect(error).toBeInstanceOf(Error)
    expect(safeError(error)).not.toContain(secret)
    expect(log.mock.calls.flat().join('\n')).not.toContain(secret)
    expect(stripe.prices.create).not.toHaveBeenCalled()
  })

  it('rejects stalled pagination rather than looping or creating duplicate prices', async () => {
    const { stripe, env, log } = fixture()
    stripe.prices.list.mockResolvedValue({ has_more: true, data: [] })
    await expect(provisionPrices(stripe, env, options({ apply: true }), log)).rejects.toThrow('pagination did not advance')
    expect(stripe.prices.create).not.toHaveBeenCalled()
  })

  it('does not reuse annual prices with a different tax behavior', async () => {
    const { stripe, prices, env, log } = fixture()
    prices.push(makePrice('price_taxdifferent', 'prod_engine', 24840, 'year', { tax_behavior: 'inclusive' }))
    env.STRIPE_STARTER_ANNUAL_PRICE_ID = 'price_taxdifferent'
    await expect(provisionPrices(stripe, env, options({ apply: true }), log)).rejects.toThrow('not a compatible annual price')
    expect(stripe.prices.create).not.toHaveBeenCalled()
    delete env.STRIPE_STARTER_ANNUAL_PRICE_ID
    const result = await provisionPrices(stripe, env, options({ apply: true }), log)
    expect(result.STRIPE_STARTER_ANNUAL_PRICE_ID).not.toBe('price_taxdifferent')
  })

  it('validates creation responses and stops without issuing later price writes', async () => {
    const { stripe, env, log } = fixture()
    stripe.prices.create.mockResolvedValueOnce(makePrice('price_invalidcreated', 'prod_engine', 1, 'year'))
    await expect(provisionPrices(stripe, env, options({ apply: true }), log)).rejects.toThrow('Created price validation failed')
    expect(stripe.prices.create).toHaveBeenCalledTimes(1)
  })

  it('keeps stable idempotency parameters for retries and reports partial progress safely', async () => {
    const { stripe, env, log } = fixture()
    const first = await preparePrices(stripe, env, options())
    const second = await preparePrices(stripe, env, options())
    expect(second.map(entry => entry.idempotencyKey)).toEqual(first.map(entry => entry.idempotencyKey))
    const create = stripe.prices.create.getMockImplementation()
    stripe.prices.create.mockImplementationOnce(create).mockRejectedValueOnce(new Error('Synthetic failure'))
    await expect(provisionPrices(stripe, env, options({ apply: true }), log)).rejects.toThrow('Synthetic failure')
    expect(log.mock.calls.flat()).toContain('STRIPE_STARTER_ANNUAL_PRICE_ID=price_created1')
    const result = await provisionPrices(stripe, env, options({ apply: true }), log)
    expect(result.STRIPE_STARTER_ANNUAL_PRICE_ID).toBe('price_created1')
    expect(stripe.prices.create).toHaveBeenCalledTimes(5)
  })

  it('runs CLI help without credentials or a Stripe connection', () => {
    const script = path.resolve(__dirname, '../../scripts/stripe-annual-prices.cjs')
    const output = execFileSync(process.execPath, [script, '--help'], { env: {}, encoding: 'utf8' })
    expect(output).toContain('Default: read-only preview')
    expect(output).toContain('--confirm-live')
  })
})