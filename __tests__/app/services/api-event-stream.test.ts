/** @jest-environment node */
import { handleApiResponse } from '@/app/services/api-client-response'

const encoder = new TextEncoder()
function response(chunks: string[]) {
  return new Response(new ReadableStream({
    start(controller) {
      chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)))
      controller.close()
    },
  }), { headers: { 'content-type': 'text/event-stream' } })
}
const accepted = 'event: accepted\ndata: {"type":"accepted","success":true}\n\n'
const completed = 'event: completed\ndata: {"type":"completed","success":true,"data":{"answer":"ready"}}\n\n'

it('waits through acceptance/keepalive and parses chunked CRLF terminal success', async () => {
  const stream = accepted + ': keepalive\n\n' + completed.replace(/\n/g, '\r\n')
  const chunks = Array.from(stream)
  await expect(handleApiResponse(response(chunks))).resolves.toEqual({
    success: true, status: 200, data: { answer: 'ready' },
  })
})

it('does not resolve when only accepted has arrived', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({ start(c) { controller = c } })
  const settled = jest.fn()
  const onAccepted = jest.fn()
  const pending = handleApiResponse(new Response(stream, { headers: { 'content-type': 'text/event-stream' } }), { onAccepted }).then(settled)
  controller.enqueue(encoder.encode(accepted))
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(onAccepted).toHaveBeenCalledTimes(1)
  expect(settled).not.toHaveBeenCalled()
  controller.enqueue(encoder.encode(completed))
  await pending
  expect(settled).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
})

it('does not acknowledge keepalives, rejected or malformed acceptance events', async () => {
  const onAccepted = jest.fn()
  const invalid = [
    ': keepalive\n\n',
    'event: accepted\ndata: {"type":"accepted","success":false}\n\n',
    'event: accepted\ndata: {"type":"other","success":true}\n\n',
  ].join('')
  await handleApiResponse(response([invalid, completed]), { onAccepted })
  expect(onAccepted).not.toHaveBeenCalled()
})

it('surfaces terminal error with a safe message/code and forbids replay', async () => {
  const error = 'event: error\ndata: {"success":false,"error":{"message":"Assistant failed safely","code":"ASSISTANT_WORKFLOW_FAILED"}}\n\n'
  await expect(handleApiResponse(response([accepted, error]))).resolves.toEqual({
    success: false, status: 200, retryable: false,
    error: { message: 'Assistant failed safely', code: 'ASSISTANT_WORKFLOW_FAILED' },
  })
})

it.each([[], [accepted], [': keepalive\n\n'], ['event: completed\ndata: {bad}\n\n']])(
  'does not silently succeed for incomplete or malformed streams: %j', async (...chunks) => {
    const result = await handleApiResponse(response(chunks as string[]))
    expect(result).toMatchObject({ success: false, retryable: false })
  },
)

it('reports read failures without replaying a possibly running workflow', async () => {
  const stream = new ReadableStream({ start(controller) { controller.error(new Error('disconnected')) } })
  const result = await handleApiResponse(new Response(stream, { headers: { 'content-type': 'text/event-stream' } }))
  expect(result).toMatchObject({ success: false, retryable: false, error: { code: 'ASSISTANT_STREAM_INTERRUPTED' } })
})

it('bounds a stalled stream and cancels the reader', async () => {
  jest.useFakeTimers()
  const cancel = jest.fn()
  try {
    const stream = new ReadableStream({ cancel })
    const pending = handleApiResponse(new Response(stream, { headers: { 'content-type': 'text/event-stream' } }))
    await jest.advanceTimersByTimeAsync(13 * 60 * 1000)
    await expect(pending).resolves.toMatchObject({ success: false, retryable: false })
    expect(cancel).toHaveBeenCalled()
  } finally { jest.useRealTimers() }
})

it('preserves JSON response and validation error behavior', async () => {
  await expect(handleApiResponse(Response.json({ success: true, data: { id: 'one' } }))).resolves.toMatchObject({ success: true, data: { id: 'one' } })
  await expect(handleApiResponse(Response.json({ error: { message: 'Invalid input' } }, { status: 400 })))
    .resolves.toMatchObject({ success: false, status: 400, error: { message: 'Invalid input' } })
})