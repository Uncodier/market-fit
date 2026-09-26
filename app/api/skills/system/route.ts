import { NextRequest } from "next/server"
import { proxySkills } from "../skills-proxy"

export const GET = (request: NextRequest) => proxySkills(request, "system")
