import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { CloudFilesViewer } from '@/app/robots/cloud-files-viewer'
import { ZipViewer } from '@/app/components/simple-messages-view/components/ZipViewer'
import { useArchiveContents, type FileNode } from '@/app/components/simple-messages-view/components/use-archive-contents'

jest.mock('@/app/components/simple-messages-view/components/use-archive-contents', () => ({
  useArchiveContents: jest.fn(),
}))
jest.mock('@/app/context/ThemeContext', () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: () => null,
  // Navigation and Markdown preview do not depend on Monaco becoming ready.
  loader: { config: jest.fn(), init: jest.fn(() => new Promise<void>(() => {})) },
}))
jest.mock('monaco-editor', () => ({}), { virtual: true })
jest.mock('@/app/components/simple-messages-view/components/ArchiveHtmlPreview', () => ({
  ArchiveHtmlPreview: () => null,
  isPreviewableHtml: () => false,
}))
jest.mock('@/app/components/simple-messages-view/components/ArchiveMarkdownPreview', () => ({
  ArchiveMarkdownPreview: ({ content }: { content: string }) => <article>{content}</article>,
  isPreviewableMarkdown: (path: string) => path.endsWith('.md'),
}))

const url = 'https://example.com/delivery.zip'
let archiveTree: FileNode

function makeTree(names: string[]): FileNode {
  return {
    name: 'root', path: '/', isDir: true,
    children: Object.fromEntries(names.map(name => [name, {
      name, path: name, isDir: false, content: `Content of ${name}`, children: {},
    }])),
  }
}

beforeEach(() => {
  archiveTree = makeTree(['readme.md'])
  jest.mocked(useArchiveContents).mockImplementation(function useMockArchiveContents({ setLoading, setFileTree }) {
    React.useEffect(() => {
      setFileTree(archiveTree)
      setLoading(false)
    }, [setLoading, setFileTree])
  })
})

describe('cloud file navigation defaults', () => {
  it('places the files toggle outside the address bar on the left and keeps mode controls inside', () => {
    const toggleTarget = document.createElement('div')
    const target = document.createElement('div')
    document.body.append(toggleTarget, target)
    const { container, unmount } = render(<CloudFilesViewer url={url} files={[{ url }]} toolbarTarget={target} filesToggleTarget={toggleTarget} />)
    const addressBar = within(target)
    const filesButton = within(toggleTarget)

    expect(addressBar.queryByRole('button', { name: 'Show files' })).not.toBeInTheDocument()
    expect(filesButton.getByRole('button', { name: 'Show files' }).compareDocumentPosition(
      addressBar.getByRole('tab', { name: 'Preview' }),
    ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelector('.lg\\:hidden')).toBeInTheDocument()
    fireEvent.click(filesButton.getByRole('button', { name: 'Show files' }))
    expect(screen.getByRole('navigation', { name: 'Archive files' })).toBeInTheDocument()
    fireEvent.click(filesButton.getByRole('button', { name: 'Hide files' }))
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    fireEvent.mouseDown(addressBar.getByRole('tab', { name: 'Source' }), { button: 0, ctrlKey: false })
    expect(addressBar.getByRole('tab', { name: 'Source' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    fireEvent.mouseDown(addressBar.getByRole('tab', { name: 'Preview' }), { button: 0, ctrlKey: false })
    expect(screen.getByRole('article')).toHaveTextContent('Content of readme.md')

    unmount()
    expect(target).toBeEmptyDOMElement()
    expect(toggleTarget).toBeEmptyDOMElement()
    target.remove()
    toggleTarget.remove()
  })

  it('collapses one delivery with one file, including duplicate delivery URLs', () => {
    render(<CloudFilesViewer url={url} files={[{ url }, { url }]} />)

    expect(screen.queryByRole('navigation', { name: 'Archive files' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show files' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('article')).toHaveTextContent('Content of readme.md')

    fireEvent.click(screen.getByRole('button', { name: 'Show files' }))
    expect(screen.getByRole('navigation', { name: 'Archive files' })).toHaveTextContent('Delivery 1')
    fireEvent.click(screen.getByRole('button', { name: 'Hide files' }))
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('keeps navigation open for multiple distinct deliveries with one file each', () => {
    render(<CloudFilesViewer url={url} files={[{ url }, { url: 'https://example.com/second.zip' }]} />)

    expect(screen.getByRole('navigation', { name: 'Archive files' })).toHaveTextContent('Delivery 2')
    expect(screen.getByRole('button', { name: 'Hide files' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('keeps navigation open for one delivery containing multiple files', () => {
    archiveTree = makeTree(['readme.md', 'notes.md'])
    render(<CloudFilesViewer url={url} files={[{ url }]} />)

    expect(screen.getByRole('navigation', { name: 'Archive files' })).toHaveTextContent('notes.md')
  })

  it('does not count directories as additional files', () => {
    const child = archiveTree
    archiveTree = { name: 'root', path: '/', isDir: true, children: { nested: child } }
    render(<CloudFilesViewer url={url} files={[{ url }]} />)

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveTextContent('Content of readme.md')
  })

  it('preserves standalone archive defaults', () => {
    const { unmount } = render(<ZipViewer url={url} />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    unmount()

    archiveTree = makeTree(['readme.md', 'notes.md'])
    render(<ZipViewer url={url} />)
    expect(screen.getByRole('navigation', { name: 'Archive files' })).toBeInTheDocument()
  })

  it('resets a manual visibility override when the archive revision changes', () => {
    const { rerender } = render(<CloudFilesViewer url={url} files={[{ url }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show files' }))

    const nextUrl = 'https://example.com/revision.zip'
    rerender(<CloudFilesViewer url={nextUrl} files={[{ url: nextUrl }]} />)

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show files' })).toHaveAttribute('aria-expanded', 'false')
  })
})