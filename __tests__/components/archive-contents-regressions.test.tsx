/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import { act, renderHook, waitFor } from '@testing-library/react'
import JSZip from 'jszip'
import * as tar from 'tar-stream'
import { gzipSync } from 'fflate'
import { TextDecoder } from 'node:util'
import type { Readable } from 'node:stream'
import { useArchiveContents, type FileNode } from '@/app/components/simple-messages-view/components/use-archive-contents'

const v1 = 'https://files.example.test/archive.zip?version=1'
const v2 = 'https://files.example.test/archive.zip?version=2'
const fetchMock = fetch as jest.Mock

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function setters() {
  return {
    setLoading: jest.fn(), setError: jest.fn(), setRawZip: jest.fn(),
    setFileTree: jest.fn(), setExpandedDirs: jest.fn(),
  }
}

async function archive(format: string, paths: string[]) {
  let bytes: Uint8Array
  if (format === 'zip') {
    const zip = new JSZip()
    for (const path of paths) zip.file(path, `Contents of ${path}`, { createFolders: false })
    bytes = await zip.generateAsync({ type: 'uint8array' })
  } else {
    // The app's local tar-stream declaration only covers extraction.
    const { pack: createPack } = jest.requireActual<{ pack: () => Readable & {
      entry: (header: { name: string }, content: string) => void
      finalize: () => void
    } }>('tar-stream')
    const pack = createPack()
    const chunks: Buffer[] = []
    const done = new Promise<Buffer>((resolve, reject) => {
      pack.on('data', (chunk: Buffer) => chunks.push(chunk))
      pack.on('end', () => resolve(Buffer.concat(chunks)))
      pack.on('error', reject)
    })
    for (const name of paths) pack.entry({ name }, `Contents of ${name}`)
    pack.finalize()
    bytes = await done
    if (format === 'tar.gz') bytes = gzipSync(bytes)
  }
  const buffer = new ArrayBuffer(bytes.length)
  new Uint8Array(buffer).set(bytes)
  const blob = new Blob([buffer], { type: format === 'zip' ? 'application/zip' : 'application/x-tar' })
  // jsdom's Blob lacks arrayBuffer; keep the actual archive bytes for TAR parsing.
  Object.defineProperty(blob, 'arrayBuffer', { value: async () => buffer, configurable: true })
  return blob
}

function response(blob: Blob) { return { ok: true, blob: async () => blob } }

function expectPrototypeFree(node: FileNode) {
  expect(Object.getPrototypeOf(node.children)).toBeNull()
  for (const child of Object.values(node.children)) expectPrototypeFree(child)
}

beforeAll(() => { Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder, configurable: true }) })
beforeEach(() => fetchMock.mockReset())
afterEach(() => jest.restoreAllMocks())

describe.each(['zip', 'tar', 'tar.gz'])('%s archive tree', format => {
  it.each(['files', 'directories'])('handles prototype-colliding %s at root and nested levels', async kind => {
    const names = ['__proto__', 'constructor', 'toString']
    const paths = kind === 'files'
      ? names.flatMap(name => [name, `nested/${name}`])
      : names.flatMap(name => [`${name}/note.md`, `nested/${name}/constructor/toString/__proto__/note.md`])
    const prototypeBefore = Object.getOwnPropertyDescriptors(Object.prototype)
    const blob = await archive(format, paths)
    fetchMock.mockResolvedValue(response(blob))
    const state = setters()
    renderHook(() => useArchiveContents({ url: `https://files.example.test/archive.${format}`, ...state }))
    await waitFor(() => expect(state.setLoading).toHaveBeenLastCalledWith(false))
    expect(state.setError).toHaveBeenCalledTimes(1)
    const tree: FileNode = state.setFileTree.mock.calls.at(-1)![0]
    expect(tree).not.toBeNull()
    expectPrototypeFree(tree)
    for (const path of paths) {
      let node = tree
      for (const part of path.split('/')) {
        expect(Object.prototype.hasOwnProperty.call(node.children, part)).toBe(true)
        node = node.children[part]
      }
      expect(node.path).toBe(path)
      expect(node.isDir).toBe(false)
      expect(node.content).toBe(path.endsWith('.md') ? `Contents of ${path}`
        : 'Binary file or unsupported format. Please download the archive to view.')
    }
    expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(prototypeBefore)
  })
})

it.each(['success', 'failure'])('ignores a late v1 fetch %s after v2 finishes, including every setter', async outcome => {
  const oldFetch = deferred<ReturnType<typeof response>>()
  const newFetch = deferred<ReturnType<typeof response>>()
  const oldBlob = await archive('zip', ['old/readme.md'])
  const newBlob = await archive('zip', ['new/readme.md'])
  fetchMock.mockReturnValueOnce(oldFetch.promise).mockReturnValueOnce(newFetch.promise)
  const state = setters()
  const { rerender } = renderHook(({ url }) => useArchiveContents({ url, ...state }), { initialProps: { url: v1 } })
  rerender({ url: v2 })
  await act(async () => { newFetch.resolve(response(newBlob)) })
  await waitFor(() => expect(state.setFileTree.mock.calls.at(-1)![0]?.path).toBe('new'))
  expect(state.setRawZip).toHaveBeenLastCalledWith(newBlob)
  const calls = Object.values(state).map(setter => setter.mock.calls.length)
  await act(async () => {
    if (outcome === 'success') oldFetch.resolve(response(oldBlob))
    else oldFetch.reject(new Error('obsolete download failed'))
  })
  expect(Object.values(state).map(setter => setter.mock.calls.length)).toEqual(calls)
})

it('does not clear v2 loading when the old response body finishes', async () => {
  const body = deferred<Blob>()
  const pending = deferred<ReturnType<typeof response>>()
  fetchMock.mockResolvedValueOnce({ ok: true, blob: () => body.promise }).mockReturnValueOnce(pending.promise)
  const state = setters()
  const { rerender } = renderHook(({ url }) => useArchiveContents({ url, ...state }), { initialProps: { url: v1 } })
  await act(async () => {})
  rerender({ url: v2 })
  const calls = Object.values(state).map(setter => setter.mock.calls.length)
  const oldBlob = await archive('zip', ['old.md'])
  await act(async () => { body.resolve(oldBlob) })
  expect(Object.values(state).map(setter => setter.mock.calls.length)).toEqual(calls)
  expect(state.setLoading).toHaveBeenLastCalledWith(true)
})

it('ignores a ZIP text read that finishes after the URL changes', async () => {
  const oldBlob = await archive('zip', ['old.md'])
  const newBlob = await archive('zip', ['new/readme.md'])
  const text = deferred<string>()
  const originalLoad = JSZip.prototype.loadAsync
  let reading = false
  jest.spyOn(JSZip.prototype, 'loadAsync').mockImplementationOnce(async function (this: JSZip, ...args) {
    const zip = await originalLoad.apply(this, args)
    // Parse real ZIP bytes, then pause only the entry's asynchronous text read.
    jest.spyOn(zip.files['old.md'], 'async').mockImplementationOnce(() => {
      reading = true
      return text.promise
    })
    return zip
  })
  fetchMock.mockResolvedValueOnce(response(oldBlob)).mockResolvedValueOnce(response(newBlob))
  const state = setters()
  const { rerender } = renderHook(({ url }) => useArchiveContents({ url, ...state }), { initialProps: { url: v1 } })
  await waitFor(() => expect(reading).toBe(true))
  rerender({ url: v2 })
  await waitFor(() => expect(state.setFileTree.mock.calls.at(-1)![0]?.path).toBe('new'))
  const calls = Object.values(state).map(setter => setter.mock.calls.length)
  await act(async () => { text.resolve('obsolete text') })
  expect(Object.values(state).map(setter => setter.mock.calls.length)).toEqual(calls)
})

it.each(['finish', 'error'])('ignores outdated TAR %s callbacks after v2 publishes', async event => {
  const oldBlob = await archive('tar', ['old/readme.md'])
  const newBlob = await archive('zip', ['new/readme.md'])
  const extractor = tar.extract()
  const originalEmit = extractor.emit
  let release!: () => void
  jest.spyOn(Object.getPrototypeOf(extractor), 'emit').mockImplementation(function (this: typeof extractor, ...eventArgs: unknown[]) {
    const [name, ...args] = eventArgs as [string | symbol, ...unknown[]]
    if (name === 'finish') {
      release = () => originalEmit.call(this, event, ...(event === 'error' ? [new Error('obsolete TAR error')] : args))
      return true
    }
    return originalEmit.call(this, name, ...args)
  })
  fetchMock.mockResolvedValueOnce(response(oldBlob)).mockResolvedValueOnce(response(newBlob))
  const state = setters()
  const { rerender } = renderHook(({ url }) => useArchiveContents({ url, ...state }), {
    initialProps: { url: 'https://files.example.test/archive.tar?version=1' },
  })
  await waitFor(() => expect(release).toBeDefined())
  expect(state.setLoading).toHaveBeenLastCalledWith(true)
  rerender({ url: v2 })
  await waitFor(() => expect(state.setFileTree.mock.calls.at(-1)![0]?.path).toBe('new'))
  const calls = Object.values(state).map(setter => setter.mock.calls.length)
  await act(async () => { release() })
  expect(Object.values(state).map(setter => setter.mock.calls.length)).toEqual(calls)
})

it('resets all revision state on URL change and ignores completion after unmount', async () => {
  const blob = await archive('zip', ['old/nested/readme.md'])
  const pending = deferred<ReturnType<typeof response>>()
  fetchMock.mockResolvedValueOnce(response(blob)).mockReturnValueOnce(pending.promise)
  const state = setters()
  const { rerender, unmount } = renderHook(({ url }) => useArchiveContents({ url, ...state }), { initialProps: { url: v1 } })
  await waitFor(() => expect(state.setFileTree.mock.calls.at(-1)![0]?.path).toBe('old/nested'))
  rerender({ url: v2 })
  expect(state.setLoading).toHaveBeenLastCalledWith(true)
  expect(state.setError).toHaveBeenLastCalledWith(null)
  expect(state.setRawZip).toHaveBeenLastCalledWith(null)
  expect(state.setFileTree).toHaveBeenLastCalledWith(null)
  expect(state.setExpandedDirs).toHaveBeenLastCalledWith(new Set(['/']))
  unmount()
  const calls = Object.values(state).map(setter => setter.mock.calls.length)
  await act(async () => { pending.resolve(response(blob)) })
  expect(Object.values(state).map(setter => setter.mock.calls.length)).toEqual(calls)
})