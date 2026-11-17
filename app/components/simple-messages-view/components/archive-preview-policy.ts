const PUBLIC_STORAGE_PATH = '/storage/v1/object/public/'

/** Permit public Storage objects, not API access or arbitrary Makinari subdomains. */
export function archiveStorageSources(supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL): string[] {
  const origins = new Set(['https://db.makinari.com'])
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl)
      if (url.protocol === 'https:' && !url.username && !url.password && !url.port &&
        /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)) {
        origins.add(url.origin)
      }
    } catch {
      // Invalid configuration must not broaden the preview's network access.
    }
  }
  return [...origins].map(origin => `${origin}${PUBLIC_STORAGE_PATH}`)
}

export function archivePreviewPolicy(): string {
  const storage = archiveStorageSources().join(' ')
  return `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: ${storage}; font-src data:; media-src data: blob: ${storage}; connect-src ${storage}; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`
}