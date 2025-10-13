import { 
  formatTime, 
  getActivityName, 
  getSystemPromptForActivity, 
  removeDuplicateSteps,
  getToolName,
  getToolResult,
  isBase64Image,
  formatBase64Image
} from '@/app/components/simple-messages-view/utils'
import { PlanStep } from '@/app/components/simple-messages-view/types'

describe('SimpleMessagesView Utils', () => {
  describe('formatTime', () => {
    it('formats time correctly', () => {
      const date = new Date('2024-01-30T14:30:00Z')
      const result = formatTime(date)
      expect(result).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/)
    })
  })

  describe('getActivityName', () => {
    it('returns correct activity names', () => {
      expect(getActivityName('ask')).toBe('Ask')
      expect(getActivityName('robot')).toBe('Execute Plan')
      expect(getActivityName('generate-image')).toBe('Publish Content')
      expect(getActivityName('unknown')).toBe('unknown')
    })
  })

  describe('getSystemPromptForActivity', () => {
    it('returns correct system prompts', () => {
      expect(getSystemPromptForActivity('ask')).toBe('answer')
      expect(getSystemPromptForActivity('generate-image')).toBe('generate image')
      expect(getSystemPromptForActivity('unknown')).toBe('answer')
    })
  })

  describe('removeDuplicateSteps', () => {
    it('removes duplicate steps', () => {
      const steps: PlanStep[] = [
        { id: '1', title: 'Step 1', status: 'pending', order: 1 },
        { id: '2', title: 'Step 2', status: 'pending', order: 2 },
        { id: '1', title: 'Step 1 Duplicate', status: 'pending', order: 3 }
      ]
      
      const result = removeDuplicateSteps(steps)
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('1')
      expect(result[1].id).toBe('2')
    })

    it('sorts steps by order', () => {
      const steps: PlanStep[] = [
        { id: '2', title: 'Step 2', status: 'pending', order: 2 },
        { id: '1', title: 'Step 1', status: 'pending', order: 1 }
      ]
      
      const result = removeDuplicateSteps(steps)
      expect(result[0].order).toBe(1)
      expect(result[1].order).toBe(2)
    })
  })

  describe('getToolName', () => {
    it('extracts tool name from log', () => {
      const log = { tool_name: 'test_tool' }
      expect(getToolName(log as any)).toBe('test_tool')
    })

    it('handles alternative field names', () => {
      const log = { toolName: 'alternative_tool' }
      expect(getToolName(log as any)).toBe('alternative_tool')
    })
  })

  describe('getToolResult', () => {
    it('extracts tool result from log', () => {
      const log = { tool_result: { output: 'test' } }
      expect(getToolResult(log as any)).toEqual({ output: 'test' })
    })

    it('handles alternative field names', () => {
      const log = { tool_results: { output: 'test' } }
      expect(getToolResult(log as any)).toEqual({ output: 'test' })
    })
  })

  describe('isBase64Image', () => {
    it('identifies data URL images', () => {
      expect(isBase64Image('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')).toBe(true)
    })

    it('identifies long base64 strings as images', () => {
      const longBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='.repeat(10)
      expect(isBase64Image(longBase64)).toBe(true)
    })

    it('rejects short strings', () => {
      expect(isBase64Image('short')).toBe(false)
    })

    it('rejects non-base64 strings', () => {
      expect(isBase64Image('not-base64!')).toBe(false)
    })
  })

  describe('formatBase64Image', () => {
    it('returns data URL as-is', () => {
      const dataUrl = 'data:image/png;base64,test'
      expect(formatBase64Image(dataUrl)).toBe(dataUrl)
    })

    it('adds PNG data URL prefix to plain base64', () => {
      const base64 = 'test'
      expect(formatBase64Image(base64)).toBe('data:image/png;base64,test')
    })
  })
})
