/** @jest-environment node */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const manifest = JSON.parse(readFileSync(path.join(root, 'licenses/procurement-scope.json'), 'utf8')) as {
  license: string; license_file: string; directory_prefixes: string[]; files: string[]; excluded_directory_prefixes: string[];
}
const covered = (file: string) => !manifest.excluded_directory_prefixes.some(prefix => file.startsWith(prefix)) &&
  (manifest.files.includes(file) || manifest.directory_prefixes.some(prefix => file.startsWith(prefix)))

describe('procurement licensing scope notice', () => {
  test('references a real license and existing paths without broad repository wildcards', () => {
    expect(manifest.license).toBe('LicenseRef-Makinari-Internal-Use-1.0')
    expect(existsSync(path.join(root, manifest.license_file))).toBe(true)
    for (const file of [...manifest.files, ...manifest.directory_prefixes]) {
      expect(file).not.toMatch(/(^\/|\.\.|\*)/)
      expect(existsSync(path.join(root, file))).toBe(true)
    }
    for (const prefix of manifest.directory_prefixes) {
      expect(prefix.endsWith('/')).toBe(true)
      expect(statSync(path.join(root, prefix)).isDirectory()).toBe(true)
    }
    expect(new Set(manifest.files).size).toBe(manifest.files.length)
  })
  test.each([
    'app/suppliers/page.tsx', 'app/purchases/requests/page.tsx', 'app/purchases/tenders/page.tsx',
    'app/api/procurement/approvals/inbox/route.ts', 'app/purchases/procurement/evidence/schema.ts',
    'app/home/profile/credential-form.tsx', 'app/home/submissions/page.tsx', 'app/catalog/procurement/schema.ts',
  ])('covers feature implementation %s', file => expect(covered(file)).toBe(true))
  test.each([
    'app/components/ui/table.tsx', 'app/components/navigation/topbar-primary-actions.tsx',
    'app/buyer/components/BuyerShell.tsx', 'app/commerce/checkout.ts', 'app/home/orders/page.tsx',
    'app/purchases/orders/page.tsx', 'lib/auth/api-site-access.ts', 'node_modules/next/package.json',
  ])('does not relicense shared or pre-existing code %s', file => expect(covered(file)).toBe(false))
  test('lists every procurement-named migration and design explicitly', () => {
    for (const dir of ['supabase/migrations', 'docs']) {
      for (const file of readdirSync(path.join(root, dir)).filter(file => dir === 'docs' ? file.startsWith('PROCUREMENT_') : file.includes('procurement'))) {
        expect(covered(`${dir}/${file}`)).toBe(true)
      }
    }
  })
  test('documents internal production permission, third-party restrictions and preserved prior rights', () => {
    const license = readFileSync(path.join(root, manifest.license_file), 'utf8')
    expect(license).toContain('including development, testing and production')
    expect(license).toContain('SaaS')
    expect(license).toContain('Suppliers and other business counterparties')
    expect(license).toContain('not retroactively withdraw')
    expect(readFileSync(path.join(root, 'LICENSE.md'), 'utf8')).toContain('No repository-wide open-source license')
  })
})