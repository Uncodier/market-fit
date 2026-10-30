import { act } from '@testing-library/react'
import { renderToString } from 'react-dom/server.node'
import { hydrateRoot } from 'react-dom/client'
import { formatProcurementDate } from '@/app/purchases/procurement/i18n/format-date'
import { TenderListingCard } from '@/app/tenders/tender-listing-card'
import type { PublicTenderRow } from '@/app/tenders/public-data'

let mockLocale = 'en'
jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ locale: mockLocale, t: (key: string) => key }),
}))

const deadline = '2026-11-05T01:05:00Z'
const settings = { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' } as const
const NativeDateTimeFormat = Intl.DateTimeFormat
const row = {
  site_slug: 'pigs', site_name: 'Pigs', tender_slug: 'tender', publication_id: 'publication', version: 1,
  status: 'published', published_at: '2026-10-01T00:00:00Z',
  snapshot: { title: 'Published tender', description: 'Published scope', currency: 'USD',
    participation: 'open', opening_policy: 'after_close', participation_deadline: deadline,
    opening_at: deadline, requirements: [] },
} satisfies PublicTenderRow

/** Model the reported ICU difference only when date and time are formatted together. */
function runtimeFormatter(connector: string) {
  jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((locales, options) => {
    const formatter = new NativeDateTimeFormat(locales, options)
    if (options?.dateStyle && options.timeStyle) {
      const { dateStyle, timeStyle, ...shared } = options
      Object.defineProperty(formatter, 'format', { value: (value: Date) => {
        const date = new NativeDateTimeFormat(locales, { ...shared, dateStyle }).format(value)
        const time = new NativeDateTimeFormat(locales, { ...shared, timeStyle }).format(value)
        return `${date}${connector}${time}`
      } })
    }
    return formatter
  })
}

afterEach(() => jest.restoreAllMocks())

test.each(['en', 'es', 'fr', 'de', 'ja'])('tender card hydrates without changing deadline text in %s', async locale => {
  mockLocale = locale
  runtimeFormatter(', ')
  const server = renderToString(<TenderListingCard row={row} closed={false} />)
  jest.restoreAllMocks()
  runtimeFormatter(' at ')
  const container = document.createElement('div')
  container.innerHTML = server
  document.body.appendChild(container)
  const originalArticle = container.querySelector('article')
  const originalText = container.textContent
  const onRecoverableError = jest.fn()
  let root: ReturnType<typeof hydrateRoot> | undefined
  try {
    await act(async () => {
      root = hydrateRoot(container, <TenderListingCard row={row} closed={false} />, { onRecoverableError })
    })
    expect(container.textContent).toBe(originalText)
    expect(container.querySelector('article')).toBe(originalArticle)
    expect(container.textContent).toContain(`${formatProcurementDate(locale, deadline, settings)} UTC`)
    expect(onRecoverableError).not.toHaveBeenCalled()
  } finally {
    await act(async () => root?.unmount())
    container.remove()
  }
})

test('keeps UTC deadlines independent of the input offset', () => {
  expect(formatProcurementDate('en', '2026-11-04T20:05:00-05:00', settings)).toBe('Nov 5, 2026, 1:05 AM')
})

test('preserves date-only, time-only, explicit field options, and invalid-date behavior', () => {
  for (const options of [
    { dateStyle: 'medium', timeZone: 'UTC' },
    { timeStyle: 'short', timeZone: 'America/New_York', hour12: false },
    { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' },
  ] satisfies Intl.DateTimeFormatOptions[]) {
    expect(formatProcurementDate('de', deadline, options)).toBe(new NativeDateTimeFormat('de', options).format(new Date(deadline)))
  }
  expect(formatProcurementDate('en', 'invalid', settings)).toBe('—')
  expect(formatProcurementDate('en', new Date(NaN))).toBe('—')
  const date = new Date(deadline)
  expect(formatProcurementDate('en', date)).toBe(
    `${new NativeDateTimeFormat('en', { dateStyle: 'medium' }).format(date)}, ${new NativeDateTimeFormat('en', { timeStyle: 'short' }).format(date)}`,
  )
})