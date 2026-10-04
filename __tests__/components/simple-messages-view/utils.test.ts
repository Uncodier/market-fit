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
import type { InstanceLog, PlanStep } from '@/app/components/simple-messages-view/types'

const toolLog = (fields: Partial<InstanceLog>): InstanceLog => ({
  id: 'log-1', instance_id: 'instance-1', log_type: 'tool_call',
  level: 'info', message: '', created_at: '2024-01-30T14:30:00Z', ...fields,
})

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

    it.each([
      ['plan', 'Plan'],
      ['create-automation', 'Create Automation'],
      ['create-app', 'Create App'],
      ['create-presentation', 'Create Presentation'],
      ['create-document', 'Create Document'],
    ])('uses an English label for %s', (activity, label) => {
      expect(getActivityName(activity)).toBe(label)
    })
  })

  describe('getSystemPromptForActivity', () => {
    it('returns correct system prompts', () => {
      expect(getSystemPromptForActivity('ask')).toBe('answer')
      expect(getSystemPromptForActivity('generate-image')).toBe('generate image')
      expect(getSystemPromptForActivity('unknown')).toBe('answer')
    })

    it('lets the agent choose voice and language for legacy or auto audio parameters', () => {
      for (const audioParameters of [undefined, { format: 'MP3' as const }, { format: 'MP3' as const, voice: 'auto' as const, language: 'auto' as const }]) {
        const prompt = getSystemPromptForActivity('generate-audio', { audioParameters })
        expect(prompt).toContain('Choose a suitable listed voice')
        expect(prompt).toContain('Infer the spoken language')
        expect(prompt).not.toContain('Use the user-selected voice: auto')
      }
    })

    it('passes explicit speech preferences as agent instructions, not spoken text', () => {
      const prompt = getSystemPromptForActivity('generate-audio', {
        audioParameters: { format: 'WAV', voice: 'nova', language: 'fr' },
      })
      expect(prompt).toContain('format: WAV')
      expect(prompt).toContain('Use the user-selected voice: nova')
      expect(prompt).toContain('language code fr BEFORE calling generate_audio')
      expect(prompt).toContain('synthesis does not translate')
      expect(prompt).toContain('not these instructions')
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
      expect(getToolName(toolLog({ tool_name: 'test_tool' }))).toBe('test_tool')
    })

    it('handles alternative field names', () => {
      expect(getToolName(toolLog({ toolName: 'alternative_tool' }))).toBe('alternative_tool')
    })
  })

  describe('getToolResult', () => {
    it('extracts tool result from log', () => {
      expect(getToolResult(toolLog({ tool_result: { output: 'test' } }))).toEqual({ output: 'test' })
    })

    it('handles alternative field names', () => {
      expect(getToolResult(toolLog({ tool_results: { output: 'test' } }))).toEqual({ output: 'test' })
    })
  })

  describe('isBase64Image', () => {
    it('identifies data URL images', () => {
      expect(isBase64Image('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')).toBe(true)
    })

    it('identifies long, unwrapped base64 payloads as images', () => {
      const longBase64 = Buffer.alloc(1024).toString('base64')
      expect(isBase64Image(longBase64)).toBe(true)
    })

    it('rejects concatenated padded base64 strings even when long', () => {
      const concatenated = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='.repeat(20)
      expect(isBase64Image(concatenated)).toBe(false)
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
