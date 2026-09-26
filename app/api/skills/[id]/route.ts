import { NextRequest } from "next/server"
import { proxySkills } from "../skills-proxy"

type Context = { params: Promise<{ id: string }> }
export const PATCH = async (request: NextRequest, { params }: Context) => proxySkills(request, "item", (await params).id)
export const DELETE = async (request: NextRequest, { params }: Context) => proxySkills(request, "item", (await params).id)