import { showPrivateReport } from '../private-report-handler'

export async function GET(request: Request, { params }: { params: Promise<{id: string}> }) {
  return showPrivateReport(request, (await params).id)
}