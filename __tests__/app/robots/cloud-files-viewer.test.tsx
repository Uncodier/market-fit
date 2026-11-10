import { fireEvent, render, screen } from '@testing-library/react'
import { CloudFilesViewer } from '@/app/robots/cloud-files-viewer'

jest.mock('@/app/components/simple-messages-view/components/ZipViewer', () => ({
  ZipViewer: ({ url, folderNavigation }: { url: string; folderNavigation: (tree: React.ReactNode) => React.ReactNode }) => (
    <div><nav>{folderNavigation(<span data-testid="file-tree">{url}.html</span>)}</nav><div data-testid="preview">{url}</div></div>
  ),
}))

it('selects folders in the same viewer and deduplicates the main archive', () => {
  const onFileSelect = jest.fn()
  const files = [{ url: 'first', title: 'Animation' }, { url: 'second', title: 'Video' }]
  const view = render(<CloudFilesViewer url="first" files={files} onFileSelect={onFileSelect} />)
  expect(screen.getAllByRole('button')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Video' }))
  expect(screen.getByTestId('preview')).toHaveTextContent('second')
  expect(screen.getByRole('button', { name: 'Video' }).parentElement).toContainElement(screen.getByTestId('file-tree'))
  fireEvent.click(screen.getByRole('button', { name: 'Video' }))
  expect(screen.queryByTestId('file-tree')).not.toBeInTheDocument()
  expect(onFileSelect).toHaveBeenCalledWith('')
  view.rerender(<CloudFilesViewer url="first" files={[files[0]]} />)
  expect(screen.getByTestId('preview')).toHaveTextContent('first')
})