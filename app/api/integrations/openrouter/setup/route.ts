import { proxyOpenRouter } from "../proxy"
export const runtime = "nodejs"
export async function GET(request: Request) { return proxyOpenRouter(request, "setup") }