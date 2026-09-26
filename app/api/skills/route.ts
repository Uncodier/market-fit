import { NextRequest } from "next/server"
import { proxySkills } from "./skills-proxy"

export const GET = (request: NextRequest) => proxySkills(request, "catalog")
export const POST = (request: NextRequest) => proxySkills(request, "catalog")