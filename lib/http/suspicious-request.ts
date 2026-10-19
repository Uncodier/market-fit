// Exact route exceptions only; authentication, authorization and admission stay
// in the existing middleware/route boundaries, not in this scanner heuristic.
const AUTHENTICATED_SETUP_PATHS = new Set([
  '/api/site/setup',
  '/api/stripe/auto-top-up/setup',
])

const SUSPICIOUS_PATTERNS = [
  /\.php(\?|$)/i,
  /\/wp-/i,
  /\/admin/i,
  /\/backend/i,
  /\/scripts/i,
  /\/server\/php/i,
  /filemanager/i,
  /upload/i,
  /\.asp(\?|$)/i,
  /\.jsp(\?|$)/i,
  /\.cgi(\?|$)/i,
  /\/cgi-bin/i,
  /\/xmlrpc/i,
  /\/phpmyadmin/i,
  /\/mysql/i,
  /\.env/i,
  /\.git/i,
  /\.sql/i,
  /\/config\./i,
  /\/install/i,
]

const MALICIOUS_EXTENSIONS = [
  '.php', '.asp', '.aspx', '.jsp', '.cgi', '.pl', '.py', '.rb', '.sh',
]

export function isSuspiciousRequest(path: string): boolean {
  if (SUSPICIOUS_PATTERNS.some(pattern => pattern.test(path))) return true
  if (!path.startsWith('/api/') && MALICIOUS_EXTENSIONS.some(ext => path.includes(ext))) return true
  if (path.includes('..') || path.includes('%2e%2e')) return true
  // Do not skip other scanner checks or exempt the whole /api prefix. Allow a
  // single trailing slash, but never descendants or prefix/suffix lookalikes.
  const canonicalPath = path.endsWith('/') ? path.slice(0, -1) : path
  return /\/setup/i.test(path) && !AUTHENTICATED_SETUP_PATHS.has(canonicalPath)
}