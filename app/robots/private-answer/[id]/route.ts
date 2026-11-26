import { privateAnswerResponse, type AnswerParams } from '../private-answer-response'

export function GET(request: Request, context: AnswerParams) {
  return privateAnswerResponse(request, context, 'page')
}