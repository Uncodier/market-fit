import { followPrivateChoice } from '../../private-report-handler'

export async function POST(request: Request, { params }: { params: Promise<{id: string}> }) {
  return followPrivateChoice(request, (await params).id)
}