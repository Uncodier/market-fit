import { readEnvironment } from './environment'

export function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

export function requireMutationEnvironment(env: NodeJS.ProcessEnv = process.env) {
  required(env, 'TEST_SITE_NAME')
  const siteId = required(env, 'TEST_SITE_ID')
  requireUuid(siteId, 'TEST_SITE_ID')
  const environment = readEnvironment(env)
  if (!['local', 'staging'].includes(environment.target)) {
    throw new Error('Mutations are forbidden in production')
  }
  if (env.TEST_ALLOW_MUTATIONS !== '1' || env.TEST_DISPOSABLE_ENVIRONMENT !== '1') {
    throw new Error('Mutations require TEST_ALLOW_MUTATIONS=1 and TEST_DISPOSABLE_ENVIRONMENT=1')
  }
  return environment
}

export function requireUuid(value: string, label: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${label} must be a UUID`)
  }
  return value
}

export function invitationDomain(env: NodeJS.ProcessEnv = process.env): string {
  requireMutationEnvironment(env)
  const domain = required(env, 'TEST_INVITE_EMAIL_DOMAIN').toLowerCase()
  // Reserved domains cannot route invitations to real users. Configure the
  // disposable deployment's mail transport to capture these recipients.
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.(test|invalid)$/.test(domain)) {
    throw new Error('TEST_INVITE_EMAIL_DOMAIN must be a disposable .test or .invalid mail sink')
  }
  return domain
}

export function fixtureConnection(env: NodeJS.ProcessEnv = process.env) {
  const environment = requireMutationEnvironment(env)
  const url = new URL(required(env, 'TEST_SUPABASE_URL'))
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('TEST_SUPABASE_URL must be an origin without credentials')
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (environment.target === 'local' && (!local || !['http:', 'https:'].includes(url.protocol))) {
    throw new Error('Local fixtures require a loopback TEST_SUPABASE_URL')
  }
  if (environment.target === 'staging') {
    const ref = required(env, 'TEST_SUPABASE_PROJECT_REF')
    if (!/^[a-z0-9]{20}$/.test(ref) || url.hostname !== `${ref}.supabase.co` || url.protocol !== 'https:') {
      throw new Error('Staging fixtures require the explicitly selected TEST_SUPABASE_PROJECT_REF')
    }
  }
  const key = required(env, 'TEST_SUPABASE_ANON_KEY')
  if (!key.startsWith('sb_publishable_')) {
    let role: unknown
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role } catch { /* rejected below */ }
    if (role !== 'anon') throw new Error('TEST_SUPABASE_ANON_KEY must be a public anon key')
  }
  return {
    environment, url: url.origin, key,
    email: required(env, 'TEST_ADMIN_EMAIL'),
    password: required(env, 'TEST_ADMIN_PASSWORD'),
  }
}