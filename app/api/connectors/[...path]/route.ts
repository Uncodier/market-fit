import type { NextRequest } from "next/server"
import { proxyConnector } from "../proxy"

type Context = { params: Promise<{ path: string[] }> }
async function handle(request: NextRequest, context: Context) {
  return proxyConnector(request, (await context.params).path)
}

export const GET = handle
export const POST = handle
export const PATCH = handle