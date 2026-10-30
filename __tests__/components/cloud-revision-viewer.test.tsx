import React from 'react'
import { randomUUID } from 'node:crypto'
import { render, screen, renderHook, waitFor } from '@testing-library/react'
import { cloudRevisionFormat, archiveRequestUrl } from '@/lib/cloud-file-url'
import { renderObjectWithImages } from '@/app/components/simple-messages-view/render-helpers'
import { useArchiveContents } from '@/app/components/simple-messages-view/components/use-archive-contents'

jest.mock('next/dynamic', () => ({ __esModule: true, default: () =>
  function ExistingZipViewer({ url }: { url: string }) { return <div data-testid="zip-viewer">{url}</div> },
}))
jest.mock('@/app/components/simple-messages-view/components/SessionNeededComponent', () => ({ SessionNeededComponent: () => null }))
jest.mock('@/app/components/simple-messages-view/utils', () => ({ isBase64Image: () => false }))
jest.mock('jszip', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => ({
  loadAsync: jest.fn().mockResolvedValue({ files: { 'document.md': { dir: false, async: async () => '# Private revision' } } }),
})) }))

const path = `/api/robots/instance/${randomUUID()}/cloud-files/${randomUUID()}`
const zip = `${path}?version=2&format=zip`
const text = `${path}?version=2&format=text`

it('renders URL-only cloud receipts with the existing viewer and a text download', () => {
  render(renderObjectWithImages({ archive_url: zip, download_url: text }))
  expect(screen.getByTestId('zip-viewer')).toHaveTextContent(zip)
  expect(screen.getByRole('link', { name: 'Download cloud revision' })).toHaveAttribute('href', text)
  expect(screen.getByRole('link')).toHaveAttribute('download')
})

it('only bypasses the public proxy for strict relative version-pinned cloud ZIP URLs', () => {
  expect(archiveRequestUrl(zip, 'https://app.example.test')).toBe(zip)
  expect(cloudRevisionFormat(text)).toBe('text')
  for (const invalid of [`https://evil.example.test${zip}`, `//evil.example.test${zip}`, `${zip}&url=x`,
    `${zip}&version=3`, `${zip}#fragment`, zip.replace('version=2', 'version=0'), zip.replace('version=2', 'version=2147483648')]) {
    expect(cloudRevisionFormat(invalid)).toBeNull()
    expect(archiveRequestUrl(invalid, 'https://app.example.test')).toMatch(/^\/api\/assets\/proxy-zip\?url=/)
  }
  expect(archiveRequestUrl('https://files.example.test/source.zip', 'https://app.example.test'))
    .toBe('/api/assets/proxy-zip?url=https%3A%2F%2Ffiles.example.test%2Fsource.zip')
})

it('loads a private revision directly with same-origin cookies and parses the archive', async () => {
  const blob = new Blob(['archive'], { type: 'application/zip' })
  ;(fetch as jest.Mock).mockReset().mockResolvedValue({ ok: true, blob: async () => blob })
  const setters = { setLoading: jest.fn(), setError: jest.fn(), setRawZip: jest.fn(), setFileTree: jest.fn(), setExpandedDirs: jest.fn() }
  renderHook(() => useArchiveContents({ url: zip, ...setters }))
  await waitFor(() => expect(setters.setFileTree.mock.calls.at(-1)?.[0]?.children['document.md']?.content).toBe('# Private revision'))
  expect(fetch).toHaveBeenCalledWith(zip)
  expect(setters.setRawZip).toHaveBeenCalledWith(blob)
  expect(setters.setFileTree).toHaveBeenNthCalledWith(1, null)
  expect(setters.setFileTree.mock.calls.at(-1)[0].children['document.md'].content).toBe('# Private revision')
  expect(setters.setError).toHaveBeenCalledTimes(1)
  expect(setters.setError).toHaveBeenCalledWith(null)
})