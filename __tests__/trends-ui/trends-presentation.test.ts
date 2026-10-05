import { selectTrends } from '@/app/components/trends/trends-presentation'
import type { TrendItem, TrendPlatform } from '@/app/types/trends'

function items(platform: TrendPlatform, count: number): TrendItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${platform}-${index}`, platform, title: `${platform} result ${index}`, timestamp: '',
    score: 100 - index, relevanceScore: platform === 'reddit' ? 200 - index : 100 - index
  }))
}

it('keeps section provider order and selects the first ten sorted items from each', () => {
  const original = [...items('reddit', 12), ...items('google', 11), ...items('twitter', 2)]
  const selected = selectTrends(original, 'section')
  expect(selected.map(trend => trend.id)).toEqual([
    ...items('reddit', 10), ...items('google', 10)
  ].map(trend => trend.id))
  expect(original).toHaveLength(25)
})

it('keeps column top-five per provider and relevance/score ordering', () => {
  const selected = selectTrends([...items('twitter', 8), ...items('reddit', 8), ...items('google', 8)], 'column')
  expect(selected).toHaveLength(10)
  expect(selected.slice(0, 5).map(trend => trend.id)).toEqual(items('reddit', 5).map(trend => trend.id))
  expect(selected[5].id).toBe('google-0')
  expect(selected.every(trend => trend.platform !== 'twitter')).toBe(true)
  expect(selected.some(trend => trend.id.endsWith('-5'))).toBe(false)
})