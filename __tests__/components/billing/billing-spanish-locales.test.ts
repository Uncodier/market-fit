import fs from 'node:fs'
import path from 'node:path'
import en from '@/app/context/locales/en.json'
import es from '@/app/context/locales/es.json'
import { flattenMessages } from '@/app/context/locale-messages'

const english = flattenMessages(en)
const spanish = flattenMessages(es)
const billingKeys = Object.keys(english).filter(key => key.startsWith('billing.'))
const placeholders = (value: string) => [...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)]
  .map(match => match[1]).sort()

describe('Spanish billing translations', () => {
  it('translates the billing navigation and page title', () => {
    expect(spanish['layout.sidebar.billing']).toBe('Facturación')
    expect(spanish['layout.nav.billing.title']).toBe('Facturación')
    expect(spanish['layout.modal.ai.goToBilling']).toBe('Ir a Facturación')
  })

  it.each(billingKeys)('provides an explicit Spanish translation for %s without English fallback', key => {
    expect(spanish[key]).toEqual(expect.any(String))
    expect(spanish[key]?.trim()).toBeTruthy()
    expect(spanish[key]).not.toBe(key)
    expect(placeholders(spanish[key])).toEqual(placeholders(english[key]))
  })

  it('keeps every billing key referenced by the billing UI in both dictionaries', () => {
    const directories = ['app/components/billing', 'app/billing']
    const inspect = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name)
        if (entry.isDirectory()) inspect(file)
        else if (/\.tsx?$/.test(file)) {
          const source = fs.readFileSync(file, 'utf8')
          for (const match of source.matchAll(/['"](billing\.[\w.]+)['"]/g)) {
            expect({ file, key: match[1], value: english[match[1]] }).toEqual({
              file, key: match[1], value: expect.any(String),
            })
            expect(spanish[match[1]]).toEqual(expect.any(String))
          }
        }
      }
    }
    directories.forEach(directory => inspect(path.join(process.cwd(), directory)))
  })
})