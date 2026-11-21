import { showPrivateReport } from './private-report-handler'

export async function GET(request: Request) {
  return showPrivateReport(request)
}