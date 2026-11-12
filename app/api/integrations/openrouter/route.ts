import { proxyOpenRouter } from "./proxy"

export const runtime = "nodejs"
export const maxDuration = 240

export async function GET(request: Request) {
  return proxyOpenRouter(request)
}

export async function POST(request: Request) {
  return proxyOpenRouter(request)
}