const { createHash } = require('node:crypto');

const CATALOG = [
  { plan: 'engine', monthly: 2300, month: 'STRIPE_STARTER_PRICE_ID', year: 'STRIPE_STARTER_ANNUAL_PRICE_ID' },
  { plan: 'foundry', monthly: 9900, month: 'STRIPE_STARTUP_PRICE_ID', year: 'STRIPE_STARTUP_ANNUAL_PRICE_ID' },
  { plan: 'enterprise', monthly: 50000, month: 'STRIPE_ENTERPRISE_PRICE_ID', year: 'STRIPE_ENTERPRISE_ANNUAL_PRICE_ID' },
  { plan: 'addon', monthly: 1000, month: 'STRIPE_ACCOUNT_ADDON_PRICE_ID', year: 'STRIPE_ACCOUNT_ADDON_ANNUAL_PRICE_ID' },
];

const HELP = `Usage: node scripts/stripe-annual-prices.cjs --mode test|live --account acct_ID [--apply] [--confirm-live] [--dry-run]

Default: read-only preview. --dry-run takes precedence over --apply.
Live creation requires both --apply and --confirm-live.
Reads STRIPE_SECRET_KEY and the four monthly STRIPE_*_PRICE_ID variables.
Optional annual STRIPE_*_ANNUAL_PRICE_ID variables select existing prices explicitly.
Load an environment file explicitly with Node's --env-file option; no file is loaded automatically.
Never pass a secret key as a command-line argument.
Creates only annual Prices on existing Products. Does not update subscriptions,
monthly prices, portal configuration, environment files, or Supabase.
`;

class SetupError extends Error {}
const fail = (message) => { throw new SetupError(message); };
const hash = (value) => createHash('sha256').update(value).digest('hex');
const productId = (price) => typeof price.product === 'string' ? price.product : price.product?.id;

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) fail(`${name} is required.`);
  return value;
}

function parseOptions(args) {
  const options = { apply: false, mode: '', account: '', confirmLive: false, help: false };
  let dryRun = false;
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--help') options.help = true;
    else if (flag === '--apply') options.apply = true;
    else if (flag === '--dry-run') dryRun = true;
    else if (flag === '--confirm-live') options.confirmLive = true;
    else if (flag === '--mode' || flag === '--account') {
      const value = args[++index];
      if (!value || value.startsWith('--')) fail('An option value is missing. Run with --help.');
      options[flag === '--mode' ? 'mode' : 'account'] = value;
    } else fail('Unknown argument. Run with --help.');
  }
  if (dryRun) options.apply = false;
  if (!options.help) validateOptions(options);
  return options;
}

function validateOptions(options) {
  if (!['test', 'live'].includes(options.mode)) fail('--mode must be test or live.');
  if (!/^acct_[a-zA-Z0-9]+$/.test(options.account)) fail('--account must identify the expected Stripe account.');
  if (options.apply && options.mode === 'live' && !options.confirmLive) {
    fail('Live price creation requires --apply --confirm-live.');
  }
}

function validateKey(env, mode) {
  const key = required(env, 'STRIPE_SECRET_KEY');
  if (!new RegExp(`^(sk|rk)_${mode}_[a-zA-Z0-9]+$`).test(key)) {
    fail('STRIPE_SECRET_KEY must be a server key matching --mode.');
  }
  return key;
}

function compatible(price, amount, interval, mode, product, tax) {
  return price && /^price_[a-zA-Z0-9]+$/.test(price.id || '') && price.active === true && price.livemode === (mode === 'live') &&
    price.currency === 'usd' && price.unit_amount === amount && price.type === 'recurring' &&
    price.recurring?.interval === interval && price.recurring.interval_count === 1 &&
    price.recurring.usage_type === 'licensed' && price.billing_scheme === 'per_unit' &&
    !price.transform_quantity && !price.custom_unit_amount &&
    (!product || productId(price) === product) && (!tax || price.tax_behavior === tax);
}

async function listPrices(stripe, filters) {
  const result = [];
  let cursor;
  for (;;) {
    const page = await stripe.prices.list({ ...filters, limit: 100, ...(cursor ? { starting_after: cursor } : {}) });
    if (!Array.isArray(page.data)) fail('Stripe returned an invalid price list.');
    result.push(...page.data);
    if (!page.has_more) return result;
    const next = page.data.at(-1)?.id;
    if (!next || next === cursor) fail('Stripe price pagination did not advance.');
    cursor = next;
  }
}

async function preparePrices(stripe, env, options) {
  validateOptions(options);
  const inputs = CATALOG.map(entry => ({ ...entry, monthlyId: required(env, entry.month), annualId: env[entry.year]?.trim() }));
  const ids = inputs.flatMap(entry => [entry.monthlyId, ...(entry.annualId ? [entry.annualId] : [])]);
  if (ids.some(id => !/^price_[a-zA-Z0-9]+$/.test(id)) || new Set(ids).size !== ids.length) {
    fail('Price IDs must be valid and distinct across the catalog.');
  }
  const account = await stripe.accounts.retrieve();
  if (account.id !== options.account) fail('Stripe account does not match --account. No prices were created.');
  const prepared = [];
  for (const entry of inputs) {
    const monthly = await stripe.prices.retrieve(entry.monthlyId);
    if (!compatible(monthly, entry.monthly, 'month', options.mode)) fail(`${entry.month} is not a compatible active monthly USD price.`);
    const product = productId(monthly);
    if (!product) fail(`${entry.month} does not identify a product.`);
    const liveProduct = await stripe.products.retrieve(product);
    if (liveProduct.deleted || !liveProduct.active || liveProduct.livemode !== (options.mode === 'live')) {
      fail(`${entry.month} belongs to an inactive or wrong-mode product.`);
    }
    const tax = monthly.tax_behavior;
    if (!['exclusive', 'inclusive', 'unspecified'].includes(tax)) fail(`${entry.month} has invalid tax behavior.`);
    const amount = entry.monthly * 108 / 10;
    const lookupKey = `makinari_annual_v1_${entry.plan}_${hash(`${product}:${amount}:${tax}`).slice(0, 24)}`;
    let existing;
    if (entry.annualId) {
      existing = await stripe.prices.retrieve(entry.annualId);
      if (!compatible(existing, amount, 'year', options.mode, product, tax)) {
        fail(`${entry.year} is not a compatible annual price on the monthly product.`);
      }
    } else {
      const candidates = await listPrices(stripe, { product, active: true, type: 'recurring', currency: 'usd' });
      const matches = candidates.filter(price => compatible(price, amount, 'year', options.mode, product, tax));
      if (matches.length > 1) fail(`Multiple compatible annual prices found. Set ${entry.year} explicitly.`);
      existing = matches[0];
      if (!existing) {
        // A persistent lookup key protects against duplicates even after Stripe's
        // 24-hour idempotency retention. Never transfer another price's key.
        for (const active of [true, false]) {
          const collisions = await listPrices(stripe, { lookup_keys: [lookupKey], active });
          if (collisions.length) fail(`Annual lookup key is already occupied for ${entry.plan}. Review Stripe before retrying.`);
        }
      }
    }
    const params = {
      product, currency: 'usd', unit_amount: amount, active: true, billing_scheme: 'per_unit',
      recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' },
      tax_behavior: tax, lookup_key: lookupKey,
      nickname: `Makinari ${entry.plan} annual - save 10%`,
      metadata: { managed_by: 'makinari_annual_prices_v1', plan: entry.plan, monthly_price_id: entry.monthlyId },
    };
    prepared.push({ ...entry, product, amount, tax, existing, params,
      idempotencyKey: `makinari-annual-v1-${hash(`${account.id}:${options.mode}:${JSON.stringify(params)}`)}` });
  }
  return prepared;
}

async function provisionPrices(stripe, env, options, log = console.log) {
  // Complete every read and validation before the first write.
  const prepared = await preparePrices(stripe, env, options);
  log(`${options.apply ? 'APPLY' : 'DRY RUN'} | Stripe ${options.mode} | ${options.account}`);
  const assignments = {};
  for (const entry of prepared) {
    log(`${entry.plan}: USD ${(entry.amount / 100).toFixed(2)}/year | ${entry.product} | ${entry.existing ? 'reuse' : 'create'}`);
    let price = entry.existing;
    if (!price && options.apply) {
      price = await stripe.prices.create(entry.params, { idempotencyKey: entry.idempotencyKey });
      if (!compatible(price, entry.amount, 'year', options.mode, entry.product, entry.tax)) {
        fail(`Created price validation failed for ${entry.plan}. Stop and review Stripe.`);
      }
    }
    if (price) {
      assignments[entry.year] = price.id;
      // Print each non-secret ID immediately: Stripe writes are not a transaction.
      log(`${entry.year}=${price.id}`);
    } else log(`${entry.year}: would create (rerun with --apply).`);
  }
  return assignments;
}

function safeError(error) {
  if (error instanceof SetupError) return error.message;
  // Never print raw SDK errors, request headers, environment values or payloads.
  return 'Stripe request failed. No automatic rollback was attempted. Review Stripe and rerun the read-only preview; do not share credentials.';
}

async function main(args = process.argv.slice(2), env = process.env) {
  try {
    const options = parseOptions(args);
    if (options.help) { console.log(HELP); return; }
    const key = validateKey(env, options.mode);
    const Stripe = require('stripe');
    const stripe = new Stripe(key, { apiVersion: '2025-05-28.basil', timeout: 20000, maxNetworkRetries: 2 });
    await provisionPrices(stripe, env, options);
  } catch (error) {
    console.error(safeError(error));
    process.exitCode = 1;
  }
}

module.exports = { CATALOG, parseOptions, validateKey, preparePrices, provisionPrices, safeError, main };
if (require.main === module) void main();