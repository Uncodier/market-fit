import { selectTrends } from '@/app/components/trends/trends-presentation'
import type { TrendItem, TrendPlatform } from '@/app/types/trends'

function items(platform: TrendPlatform, count: number): TrendItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${platform}-${index}`, platform, title: `${platform} result ${index}`, timestamp: '',
    score: 100 - index, relevanceScore: platform === 'reddit' ? 200 - index : 100 - index
  }))
}

it('keeps section provider order and selects the first ten sorted items from each', () => {
  const original = [...items('twitter', 12), ...items('google', 11), ...items('reddit', 2)]
  const selected = selectTrends(original, 'section')
  expect(selected.map(trend => trend.id)).toEqual([
    ...items('twitter', 10), ...items('google', 10), ...items('reddit', 2)
  ].map(trend => trend.id))
  expect(original).toHaveLength(25)
})

it('keeps column top-five per provider and relevance/score ordering', () => {
  const selected = selectTrends([...items('twitter', 8), ...items('reddit', 8), ...items('google', 8)], 'column')
  expect(selected).toHaveLength(15)
  expect(selected.slice(0, 5).map(trend => trend.id)).toEqual(items('reddit', 5).map(trend => trend.id))
  expect(selected[5].id).toBe('google-0')
  expect(selected[6].id).toBe('twitter-0')
  expect(selected.some(trend => trend.id.endsWith('-5'))).toBe(false)
})