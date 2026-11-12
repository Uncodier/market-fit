import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import JSZip from 'jszip'
import { ZipViewer } from '@/app/components/simple-messages-view/components/ZipViewer'
import { ArchiveMarkdownPreview, isPreviewableMarkdown } from '@/app/components/simple-messages-view/components/ArchiveMarkdownPreview'

jest.mock('@/app/context/ThemeContext', () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock('monaco-editor', () => ({}), { virtual: true })
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  loader: { config: jest.fn(), init: jest.fn().mockResolvedValue(undefined) },
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Archive editor" value={value} onChange={event => onChange(event.target.value)} />
  ),
}))

it.each(['contract.md', 'README.MD', 'notes.markdown'])('recognizes %s as Markdown', path => {
  expect(isPreviewableMarkdown(path)).toBe(true)
})

it('does not treat other source files as Markdown', () => {
  expect(isPreviewableMarkdown('script.ts')).toBe(false)
  expect(isPreviewableMarkdown('page.html')).toBe(false)
})

it('renders Markdown safely with tables, code, links and the viewer theme', () => {
  const content = '# Contract\n\n**Company** {{company_name}}\n\n- First clause\n\n| Item | Amount |\n| --- | --- |\n| Campaign | 100 |\n\n```js\nconst amount = 100\n```\n\n[Reference](https://example.test)\n\n![Logo](https://example.test/image.png)\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert(1))'
  const { container } = render(<ArchiveMarkdownPreview content={content} name="contract.md" isDarkMode />)
  expect(screen.getByRole('heading', { name: 'Contract' })).toBeInTheDocument()
  expect(container.querySelector('strong')).toHaveTextContent('Company')
  expect(container.querySelector('ul')).toHaveTextContent('First clause')
  expect(screen.getByRole('table')).toHaveTextContent('Campaign')
  expect(container.querySelector('pre code')).toHaveTextContent('const amount = 100')
  expect(screen.getByText(/company_name/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Reference' })).toHaveAttribute('rel', 'noopener noreferrer')
  expect(screen.getByText('Unsafe')).not.toHaveAttribute('href')
  expect(container.querySelector('script')).toBeNull()
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('.prose-invert')).toBeInTheDocument()
})

it('defaults to preview and reuses source edits without another download', async () => {
  const zip = new JSZip()
  zip.file('contract.md', '# Contract\n\n**Company**')
  const bytes = await zip.generateAsync({ type: 'arraybuffer' })
  ;(fetch as jest.Mock).mockReset().mockResolvedValue({ ok: true, blob: async () => new Blob([bytes]) })
  const url = 'https://files.example.test/contract.zip?version=1'
  const view = render(<ZipViewer url={url} />)
  await screen.findByRole('heading', { name: 'Contract' })
  expect(screen.getByRole('tab', { name: 'Preview' })).toHaveAttribute('aria-selected', 'true')
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Source' }), { button: 0, ctrlKey: false })
  await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('# Contract\n\n**Company**'))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '# Edited contract' } })
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Preview' }), { button: 0, ctrlKey: false })
  expect(screen.getByRole('heading', { name: 'Edited contract' })).toBeInTheDocument()
  view.rerender(<ZipViewer url={url} isDarkMode />)
  expect(screen.getByRole('heading', { name: 'Edited contract' })).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(1)
})