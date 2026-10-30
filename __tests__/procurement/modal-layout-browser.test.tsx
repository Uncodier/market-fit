/** @jest-environment node */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium, webkit } from 'playwright'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import tailwindConfig from '@/tailwind.config'
import { Dialog, DialogContent, DialogForm, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { DatePickerContent } from '@/app/components/ui/date-picker-content'
import { DateOnlyField, DateTimeField, Field } from '@/app/purchases/procurement/components/form-fields'
import { TenderEditor } from '@/app/purchases/tenders/tender-editor'
import { RequestEditor } from '@/app/purchases/requests/request-editor'
import { RelationSelect } from '@/app/components/ui/relation-select'
import { CredentialForm } from '@/app/home/profile/credential-form'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/app/components/ui/alert-dialog'

// Render portals inline for static layout evidence only. Interaction and focus
// behavior are covered separately with the unmodified Radix primitives in jsdom.
jest.mock('@radix-ui/react-dialog', () => {
  const actual = jest.requireActual('@radix-ui/react-dialog')
  const React = jest.requireActual('react')
  const Overlay = React.forwardRef(function StaticOverlay(props: React.HTMLAttributes<HTMLDivElement>, ref: React.Ref<HTMLDivElement>) { return <div {...props} ref={ref} /> })
  const Content = React.forwardRef(function StaticContent({ onEscapeKeyDown, onPointerDownOutside, onFocusOutside, onInteractOutside, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>, ref: React.Ref<HTMLDivElement>) {
    void [onEscapeKeyDown, onPointerDownOutside, onFocusOutside, onInteractOutside]
    return <div {...props} role="dialog" ref={ref} />
  })
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => children,
    Overlay,
    Content,
  }
})
jest.mock('@radix-ui/react-alert-dialog', () => {
  const actual = jest.requireActual('@radix-ui/react-alert-dialog')
  const React = jest.requireActual('react')
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => children,
    Overlay: React.forwardRef(function StaticOverlay(props: React.HTMLAttributes<HTMLDivElement>, ref: React.Ref<HTMLDivElement>) { return <div {...props} ref={ref} /> }),
    Content: React.forwardRef(function StaticContent({ onEscapeKeyDown, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>, ref: React.Ref<HTMLDivElement>) {
      void onEscapeKeyDown
      return <div {...props} role="alertdialog" ref={ref} />
    }),
    Cancel: React.forwardRef(function StaticCancel(props: React.ButtonHTMLAttributes<HTMLButtonElement>, ref: React.Ref<HTMLButtonElement>) { return <button type="button" {...props} ref={ref} /> }),
  }
})
jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ locale: 'es', t: (key: string, values?: { date: string; time: string }) => values ? `${values.date} a las ${values.time}` : key }),
}))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: '00000000-0000-4000-8000-000000000001' } }) }))

const root = process.cwd()
const noop = () => {}
const date = new Date(2026, 10, 4, 17, 24)
const longName = 'VeryLongSupplierOrCredentialNameWithoutAnySpaces'.repeat(5)

function editorMarkup(headerInsideForm: boolean) {
  const header = <DialogHeader><DialogTitle>Create tender</DialogTitle><DialogDescription>{longName}</DialogDescription></DialogHeader>
  return renderToStaticMarkup(<Dialog open><DialogContent size="lg">
    {!headerInsideForm && header}
    <DialogForm>{headerInsideForm && header}<DialogBody>
      <fieldset className="space-y-5">
        <Field label="Title">{id => <Input id={id} defaultValue={longName} />}</Field>
        <RelationSelect label="Supplier" options={[]} value={{ mode: 'existing', id: 'supplier', label: longName }} onValueChange={noop} />
        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimeField label="Closing" value={date.toISOString()} onChange={noop} />
          <DateTimeField label="Opening" value={date.toISOString()} onChange={noop} />
          <DateOnlyField label="Issue date" value="2026-11-04" onChange={noop} />
          <DateOnlyField label="Expiry date" value="2026-11-05" onChange={noop} />
        </div>
        {Array.from({ length: 12 }, (_, index) => <fieldset key={index} className="space-y-3 rounded border p-4">
          <legend>Requirement {index + 1}</legend>
          <Field label="Description">{id => <Input id={id} defaultValue={longName} />}</Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Quantity">{id => <Input id={id} type="number" defaultValue="1" />}</Field>
            <Field label="Unit">{id => <Input id={id} defaultValue="unit" />}</Field>
          </div>
        </fieldset>)}
        <p data-last-field>Last requirement remains reachable</p>
      </fieldset>
    </DialogBody><DialogFooter>
      <Button type="button" variant="outline">Cancel</Button>
      <Button type="submit">Save this translated working version with a long action label</Button>
    </DialogFooter></DialogForm>
  </DialogContent></Dialog>)
}

function calendarMarkup() {
  return renderToStaticMarkup(<Dialog open><DialogContent flush
    className="w-[calc(100%-2rem)] max-w-[400px] sm:max-w-[400px] !inset-auto !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !rounded-xl">
    <DialogHeader><DialogTitle>Select date</DialogTitle></DialogHeader>
    <DialogBody className="p-0"><DatePickerContent mode="default" date={date} currentMonth={date} tempStartDate={null} error={null}
      disabled={false} navigateMonth={noop} selectDate={noop} events={[]} showEvents={false} customEvents={false}
      selectPreset={noop} showTimePicker selectedTime={{ hours: 17, minutes: 24 }} timeFormat="24h" displayTime="17:24" onTimeChange={noop} />
    </DialogBody>
  </DialogContent></Dialog>)
}

function confirmationMarkup() {
  return renderToStaticMarkup(<AlertDialog open><AlertDialogContent>
    <AlertDialogHeader><AlertDialogTitle>Discard working version</AlertDialogTitle><AlertDialogDescription>{longName.repeat(8)}</AlertDialogDescription></AlertDialogHeader>
    <AlertDialogFooter><AlertDialogCancel>Keep editing this document</AlertDialogCancel><Button>Confirm discarding this working version</Button></AlertDialogFooter>
  </AlertDialogContent></AlertDialog>)
}

let css: string
beforeAll(async () => {
  css = (await postcss([tailwindcss({
    ...tailwindConfig,
    content: ['app/components/ui/**/*.{ts,tsx}', 'app/purchases/procurement/components/form-fields.tsx', {
      raw: editorMarkup(true) + calendarMarkup() + confirmationMarkup() + renderToStaticMarkup(<TenderEditor />) + renderToStaticMarkup(<CredentialForm onSaved={noop} onCancel={noop} />), extension: 'html',
    }],
  })]).process(readFileSync(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') })).css
}, 30_000)

const cases = [chromium, webkit].flatMap(browserType =>
  [[320, 568], [390, 844], [640, 480], [700, 900], [1440, 900]].map(([width, height]) => ({ name: browserType.name(), browserType, width, height })))

test.each(cases)('$name keeps modal fields, close and footer within $width × $height', async ({ browserType, width, height }) => {
  if (!existsSync(browserType.executablePath())) throw new Error(`Install the ${browserType.name()} browser before running modal layout verification.`)
  const browser = await browserType.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width, height } })
  const requests: string[] = []
  await page.route('**/*', route => { requests.push(route.request().url()); return route.abort() })
  try {
    const surfaces = [editorMarkup(true), editorMarkup(false), renderToStaticMarkup(<TenderEditor />),
      renderToStaticMarkup(<RequestEditor siteId="00000000-0000-4000-8000-000000000001" busy={false} onSave={async () => {}} />),
      renderToStaticMarkup(<CredentialForm onSaved={noop} onCancel={noop} />), ...(width < 768 ? [calendarMarkup()] : [])]
    for (const markup of surfaces) {
      await page.setContent(`<!doctype html><html class="safari" lang="es"><head><style>${css}</style></head><body>${markup}</body></html>`)
      const geometry = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]') as HTMLElement
        const body = dialog.querySelector('[data-slot="dialog-body"]') as HTMLElement
        const footer = dialog.querySelector('[data-slot="dialog-footer"]') as HTMLElement | null
        const close = dialog.querySelector('[data-slot="dialog-close"]') as HTMLElement
        const rect = dialog.getBoundingClientRect()
        const within = (element: Element, parent: DOMRect) => {
          const bounds = element.getBoundingClientRect()
          return bounds.left >= parent.left - 1 && bounds.right <= parent.right + 1
        }
        const fieldsFit = Array.from(body.querySelectorAll('input,button,fieldset')).every(element => within(element, body.getBoundingClientRect()))
        const dateActionsFit = Array.from(body.querySelectorAll('button[aria-label]')).every(button => within(button, button.parentElement!.getBoundingClientRect()))
        const footerFit = !footer || Array.from(footer.querySelectorAll('button')).every(button => within(button, footer.getBoundingClientRect()))
        body.scrollTop = body.scrollHeight
        const last = body.querySelector('[data-last-field]')
        const lastBounds = last?.getBoundingClientRect()
        const bodyBounds = body.getBoundingClientRect()
        return {
          viewportFit: rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1,
          horizontalOverflow: body.scrollWidth > body.clientWidth + 1,
          fieldsFit, dateActionsFit, footerFit,
          closePosition: getComputedStyle(close).position,
          closeWithinHeader: close.getBoundingClientRect().bottom <= dialog.querySelector('[data-slot="dialog-header"]')!.getBoundingClientRect().bottom + 1,
          footerVisible: !footer || footer.getBoundingClientRect().bottom <= rect.bottom + 1,
          lastReachable: !lastBounds || (lastBounds.top >= bodyBounds.top - 1 && lastBounds.bottom <= bodyBounds.bottom + 1),
        }
      })
      expect(geometry).toEqual({ viewportFit: true, horizontalOverflow: false, fieldsFit: true, dateActionsFit: true,
        footerFit: true, closePosition: 'absolute', closeWithinHeader: true, footerVisible: true, lastReachable: true })
    }
    await page.setContent(`<!doctype html><html class="safari"><head><style>${css}</style></head><body>${confirmationMarkup()}</body></html>`)
    expect(await page.evaluate(() => {
      const dialog = document.querySelector('[role="alertdialog"]') as HTMLElement
      const bounds = dialog.getBoundingClientRect()
      dialog.scrollTop = dialog.scrollHeight
      return {
        viewportFit: bounds.top >= -1 && bounds.bottom <= innerHeight + 1 && bounds.left >= -1 && bounds.right <= innerWidth + 1,
        horizontalOverflow: dialog.scrollWidth > dialog.clientWidth + 1,
        actionsReachable: Array.from(dialog.querySelectorAll('button')).every(button => {
          const rect = button.getBoundingClientRect()
          return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 && rect.bottom <= bounds.bottom + 1 && rect.top >= bounds.top - 1
        }),
      }
    })).toEqual({ viewportFit: true, horizontalOverflow: false, actionsReachable: true })
    expect(requests).toEqual([])
  } finally { await browser.close() }
}, 30_000)