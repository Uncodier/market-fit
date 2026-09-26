import { NextRequest } from "next/server"
import { proxySkills } from "../../skills-proxy"

export const POST = (request: NextRequest) => proxySkills(request, "preview")