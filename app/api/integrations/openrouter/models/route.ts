import { proxyOpenRouter } from "../proxy"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(request: Request) {
  return proxyOpenRouter(request, true)
}