import { proxyFinderRequest } from './proxy-finder-request'

type Context = { params: Promise<{ path: string[] }> }

export async function GET(request: Request, context: Context) {
  return proxyFinderRequest(request, (await context.params).path)
}

export async function POST(request: Request, context: Context) {
  return proxyFinderRequest(request, (await context.params).path)
}

export async function DELETE(request: Request, context: Context) {
  return proxyFinderRequest(request, (await context.params).path)
}