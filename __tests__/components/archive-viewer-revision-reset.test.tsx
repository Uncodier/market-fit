import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import JSZip from 'jszip'
import { ZipViewer } from '@/app/components/simple-messages-view/components/ZipViewer'

jest.mock('@/app/context/ThemeContext', () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock('monaco-editor', () => ({}), { virtual: true })
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  loader: { config: jest.fn(), init: jest.fn().mockResolvedValue(undefined) },
  default: ({ value, path, onChange }: { value: string; path: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Archive editor" data-path={path} value={value} onChange={event => onChange(event.target.value)} />
  ),
}))

async function revision(version: number) {
  const zip = new JSZip()
  zip.file('readme.md', `Revision ${version} readme`)
  zip.file('selected.md', `Revision ${version} selected`)
  const bytes = await zip.generateAsync({ type: 'arraybuffer' })
  return { ok: true, blob: async () => new Blob([bytes], { type: 'application/zip' }) }
}

it('resets selection and edits for a new URL, but preserves them on same-URL rerenders', async () => {
  const first = await revision(1)
  const second = await revision(2)
  let resolveSecond!: (value: typeof second) => void
  const pendingSecond = new Promise<typeof second>(resolve => { resolveSecond = resolve })
  ;(fetch as jest.Mock).mockReset().mockResolvedValueOnce(first).mockReturnValueOnce(pendingSecond)
  const onSelect = jest.fn()
  const sendMessage = jest.fn()
  window.addEventListener('robot:send-message', sendMessage)
  try {
    const v1 = 'https://files.example.test/archive.zip?version=1'
    const v2 = 'https://files.example.test/archive.zip?version=2'
    const { rerender } = render(<ZipViewer url={v1} onFileSelect={onSelect} />)
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('Revision 1 readme'))
    fireEvent.click(screen.getByText('selected.md'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unsaved revision 1 edit' } })
    expect(screen.getByRole('button', { name: /Enviar 1 cambio/ })).toBeInTheDocument()

    rerender(<ZipViewer url={v1} onFileSelect={onSelect} isDarkMode className="rerender" />)
    expect(screen.getByRole('textbox')).toHaveValue('Unsaved revision 1 edit')
    expect(screen.getByRole('textbox')).toHaveAttribute('data-path', 'selected.md')
    expect(fetch).toHaveBeenCalledTimes(1)

    onSelect.mockClear()
    rerender(<ZipViewer url={v2} onFileSelect={onSelect} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Enviar/ })).not.toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()
    await act(async () => { resolveSecond(second) })
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('Revision 2 readme'))
    expect(screen.getByRole('textbox')).toHaveAttribute('data-path', 'readme.md')
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('readme.md')
    expect(screen.queryByRole('button', { name: /Enviar/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('selected.md'))
    expect(screen.getByRole('textbox')).toHaveValue('Revision 2 selected')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Only revision 2 edit' } })
    fireEvent.click(screen.getByRole('button', { name: /Enviar 1 cambio/ }))
    expect(sendMessage).toHaveBeenCalledTimes(1)
    const message = (sendMessage.mock.calls[0][0] as CustomEvent).detail.text
    expect(message).toContain('Only revision 2 edit')
    expect(message).not.toContain('Unsaved revision 1 edit')
    expect(screen.queryByRole('button', { name: /Enviar/ })).not.toBeInTheDocument()
  } finally {
    window.removeEventListener('robot:send-message', sendMessage)
  }
})