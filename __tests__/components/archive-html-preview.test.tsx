import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import JSZip from 'jszip'
import { ZipViewer } from '@/app/components/simple-messages-view/components/ZipViewer'
import { buildArchivePreview } from '@/app/components/simple-messages-view/components/ArchiveHtmlPreview'

jest.mock('@/app/context/ThemeContext', () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock('monaco-editor', () => ({}), { virtual: true })
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  loader: { config: jest.fn(), init: jest.fn().mockResolvedValue(undefined) },
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Archive editor" value={value} onChange={event => onChange(event.target.value)} />
  ),
}))

it('renders single-file HTML by default and toggles source without downloading again', async () => {
  const zip = new JSZip()
  zip.file('landing.html', '<html><head><style>h1{color:orange}</style></head><body><h1>Landing</h1></body></html>')
  const bytes = await zip.generateAsync({ type: 'arraybuffer' })
  ;(fetch as jest.Mock).mockReset().mockResolvedValue({ ok: true, blob: async () => new Blob([bytes]) })
  const url = 'https://files.example.test/landing.zip?version=1'
  const view = render(<ZipViewer url={url} />)
  await waitFor(() => expect(screen.getByTitle('Preview: landing.html')).toBeInTheDocument())
  const iframe = screen.getByTitle('Preview: landing.html')
   expect(iframe).toHaveAttribute('sandbox', 'allow-scripts')
  expect(iframe).toHaveAttribute('referrerpolicy', 'no-referrer')
  expect(iframe.getAttribute('srcdoc')).toContain('<h1>Landing</h1>')
  expect(iframe.getAttribute('srcdoc')).toContain('h1{color:orange}')
  expect(screen.getByRole('tab', { name: 'Preview' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.queryByRole('navigation', { name: 'Archive files' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Show files' }))
  expect(screen.getByRole('navigation', { name: 'Archive files' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Hide files' }))
  expect(screen.queryByRole('navigation', { name: 'Archive files' })).not.toBeInTheDocument()
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Source' }), { button: 0, ctrlKey: false })
  await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument())
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '<h1>Edited landing</h1>' } })
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Preview' }), { button: 0, ctrlKey: false })
  expect(screen.getByTitle('Preview: landing.html').getAttribute('srcdoc')).toContain('Edited landing')
  view.rerender(<ZipViewer url={url} isDarkMode />)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(screen.getByTitle('Preview: landing.html').getAttribute('srcdoc')).toContain('Edited landing')
})

it('shows the file tree by default for multiple files and keeps visibility choices on rerender', async () => {
  const zip = new JSZip()
  zip.file('index.html', '<h1>Multiple files</h1>')
  zip.file('styles.css', 'h1{color:orange}')
  const bytes = await zip.generateAsync({ type: 'arraybuffer' })
  ;(fetch as jest.Mock).mockReset().mockResolvedValue({ ok: true, blob: async () => new Blob([bytes]) })
  const url = 'https://files.example.test/multiple.zip'
  const view = render(<ZipViewer url={url} />)
  await waitFor(() => expect(screen.getByRole('navigation', { name: 'Archive files' })).toBeInTheDocument())
  expect(screen.getByTitle('Preview: index.html')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Hide files' }))
  view.rerender(<ZipViewer url={url} isDarkMode />)
  expect(screen.queryByRole('navigation', { name: 'Archive files' })).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('preserves inline animations but removes external scripts, embeds, base URLs and refresh directives', () => {
  const source = '<head><base href="https://evil.example.test"><meta http-equiv="refresh" content="0;url=https://evil.example.test"></head><body><script>window.parent.document</script><iframe src="/private"></iframe><object></object><embed><h1>Safe content</h1></body>'
  const result = buildArchivePreview(source)
  expect(result).toContain('<script>window.parent.document</script>')
  expect(buildArchivePreview('<script src="https://evil.example.test/code.js"></script>')).not.toContain('evil.example.test')
  expect(result).not.toContain('<iframe')
  expect(result).not.toContain('<base')
  expect(result).not.toContain('evil.example.test')
  expect(result).toContain("script-src 'unsafe-inline'")
  expect(result).toContain("connect-src 'none'")
  expect(result).toContain("form-action 'none'")
  expect(result).toContain('<h1>Safe content</h1>')
  expect(source).toContain('<script>')
})