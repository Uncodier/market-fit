import { fireEvent, render, screen } from '@testing-library/react'
import { TrendsTable } from '@/app/components/trends/TrendsTable'
import type { TrendItem } from '@/app/types/trends'

const trends: TrendItem[] = Array.from({ length: 11 }, (_, index) => ({
  id: `trend-${index}`, platform: 'google', title: `<b>Trend ${index}</b>`, timestamp: '',
  score: index === 0 ? 1500 : 100,
  change: index === 0 ? -12.3 : undefined,
  description: 'A &amp; B',
  matchedKeywords: index === 0 ? ['commercial:growth'] : undefined,
  tags: ['marketing'],
  contentOpportunity: 'high', relevanceScore: 90, commercialSignals: ['freshness']
}))

it('preserves successful table formatting, signals, row selection and pagination', () => {
  const onTrendClick = jest.fn()
  render(<TrendsTable trends={trends} onTrendClick={onTrendClick} />)
  expect(screen.getByText('Trend 0')).toHaveAttribute('title', 'Trend 0')
  expect(screen.getByText('1.5K')).toBeInTheDocument()
  expect(screen.getByText('12.3%')).toBeInTheDocument()
  expect(screen.getAllByText('A & B')).toHaveLength(5)
  expect(screen.getByText('growth')).toBeInTheDocument()
  expect(screen.getAllByText('Hot Topic')).toHaveLength(5)
  expect(screen.getAllByText('Fresh')).toHaveLength(5)
  expect(screen.queryByText('Trend 5')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Trend 0'))
  expect(onTrendClick).toHaveBeenCalledWith(trends[0])
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  expect(screen.queryByText('Trend 0')).not.toBeInTheDocument()
  expect(screen.getByText('Trend 5')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  expect(screen.getByText('Trend 10')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
})

it('clamps the selected page when partial results shrink instead of showing a stale empty page', () => {
  const { rerender } = render(<TrendsTable trends={trends} onTrendClick={jest.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  rerender(<TrendsTable trends={trends.slice(0, 2)} onTrendClick={jest.fn()} />)
  expect(screen.getByText('Trend 0')).toBeInTheDocument()
  expect(screen.getByText('Trend 1')).toBeInTheDocument()
  expect(screen.queryByText('Trend 10')).not.toBeInTheDocument()
})