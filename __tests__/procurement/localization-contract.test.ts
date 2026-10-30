/** @jest-environment node */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { procurementMessages } from '@/app/context/locales/procurement'
import { rawLocaleMessages } from '@/app/context/locale-catalog'
import { procurementMessage, procurementValueLabel } from '@/app/purchases/procurement/i18n/messages'

const locales = ['en', 'es', 'fr', 'de', 'ja'] as const
const root = path.join(__dirname, '../..')
const scopes = ['app/purchases/procurement', 'app/purchases/requests', 'app/purchases/tenders', 'app/suppliers', 'app/catalog/procurement', 'app/tenders', 'app/home']
const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(directory, entry.name)
  return entry.isDirectory() ? files(file) : /\.tsx?$/.test(file) ? [file] : []
})
const keys = new Set<string>()
const hardcoded: { file: string; text: string }[] = []
const displayAttributes = new Set(['aria-label', 'placeholder', 'title', 'label', 'description', 'triggerText', 'alt'])
const technicalText = new Set(['America/Mexico_City', 'Makinari', 'KiB ·'])
for (const scope of scopes) for (const file of files(path.join(root, scope))) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node) && /^procurement\.[\w.]+$/.test(node.text)) keys.add(node.text)
    const displayText = ts.isJsxText(node) ? node.text.trim().replace(/\s+/g, ' ')
      : ts.isJsxAttribute(node) && displayAttributes.has(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)
        ? node.initializer.text : ''
    if (/[\p{L}]{3}/u.test(displayText) && !technicalText.has(displayText)) hardcoded.push({ file: path.relative(root, file), text: displayText })
    ts.forEachChild(node, visit)
  }
  visit(source)
}
const parameters = (value: string) => [...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(match => match[1]).sort()

describe('added procurement modules are localized without counting English fallback', () => {
  test('scoped JSX and accessible labels have no unreviewed hardcoded UI copy', () => {
    expect(hardcoded).toEqual([])
  })
  test.each(locales)('registers every literal procurement key in %s', locale => {
    expect([...keys].filter(key => !rawLocaleMessages[locale][key]?.trim())).toEqual([])
    expect(Object.keys(procurementMessages[locale]).sort()).toEqual(Object.keys(procurementMessages.en).sort())
    for (const [key, english] of Object.entries(procurementMessages.en)) {
      expect(parameters(procurementMessages[locale][key])).toEqual(parameters(english))
      expect(rawLocaleMessages[locale][key]).toBe(procurementMessages[locale][key])
    }
  })
  test('all on-disk dictionaries are registered and remain below 500 lines', () => {
    const directory = path.join(root, 'app/context/locales/procurement')
    for (const file of readdirSync(directory).filter(file => file.endsWith('.json'))) {
      const locale = /-(en|es|fr|de|ja)\.json$/.exec(file)?.[1] as typeof locales[number]
      const content = readFileSync(path.join(directory, file), 'utf8')
      expect(content.split('\n').length).toBeLessThan(500)
      for (const [key, value] of Object.entries(JSON.parse(content))) expect(procurementMessages[locale][key]).toBe(value)
    }
  })
  test.each(['es', 'fr', 'de', 'ja'] as const)('translates known server errors and statuses at presentation time in %s', locale => {
    for (const message of ['Request not found', 'Rule manager is no longer authorized', 'Target must exceed the minimum', 'File content does not match its declared type']) {
      const translated = procurementMessage(message, locale)
      expect(translated).not.toBe(message)
      expect(procurementMessage(translated, locale)).toBe(translated)
    }
    for (const value of ['submitted', 'approved', 'requisition', 'under_review', 'invitation_only']) expect(procurementValueLabel(value, locale)).not.toBe(procurementValueLabel(value, 'en'))
    for (const raw of ['Number must be greater than or equal to 0', 'Number must be less than or equal to 50', 'Array must contain at most 100 element(s)']) {
      const translated = procurementMessage(raw, locale)
      expect(translated).not.toBe(raw)
      expect(translated).not.toBe(rawLocaleMessages[locale]['procurement.errors.invalidValue'])
      expect(procurementMessage(translated, locale)).toBe(translated)
    }
  })
})