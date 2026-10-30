import { fireEvent, render, screen } from '@testing-library/react'
import { CourseLessonPlayer } from '@/app/components/commerce/pdp/CourseLessonPlayer'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({
  t: (key: string, values?: { completed?: number; total?: number; number?: number }) => {
    if (key === 'pdp.course.progress') return `${values?.completed} of ${values?.total} completed`
    if (key === 'pdp.course.lesson') return `Lesson ${values?.number}`
    return ''
  },
}) }))

const videos = [
  { title: 'Discover the problem', url: '/course-resources/sample-flower.mp4' },
  { title: 'Explore alternatives', url: 'https://youtu.be/abcdefghijk' },
  { title: 'Test the prototype', url: 'javascript:alert(1)' },
]

beforeEach(() => jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}))
afterEach(() => jest.restoreAllMocks())

it('resumes a valid lesson and normalizes accessible progress', () => {
  render(<CourseLessonPlayer title="Design" videos={videos} progress={{ lastIndex: 1, completedIndexes: [0, 0, 99, -1] }} />)
  expect(screen.getByRole('heading', { name: 'Explore alternatives' })).toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33')
  expect(screen.getByRole('button', { name: /2. Explore alternatives/ })).toHaveAttribute('aria-current', 'step')
  expect(screen.getByTitle('Explore alternatives')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abcdefghijk')
})

it('navigates next/previous without automatically completing lessons', () => {
  const update = jest.fn()
  render(<CourseLessonPlayer title="Design" videos={videos} onProgressUpdate={update} />)
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Next lesson' }))
  expect(update).toHaveBeenCalledWith(1, false)
  expect(screen.getByRole('heading', { name: 'Explore alternatives' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
  expect(screen.getByRole('heading', { name: 'Discover the problem' })).toBeInTheDocument()
})

it('shows the full curriculum without a search field and allows direct lesson navigation', () => {
  const update = jest.fn()
  render(<CourseLessonPlayer title="Design" videos={videos} onProgressUpdate={update} />)
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /1. Discover/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /2. Explore/ })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /3. Test the prototype/ }))
  expect(update).toHaveBeenCalledWith(2, false)
  expect(screen.getByRole('alert')).toHaveTextContent('video is unavailable')
  expect(screen.getByRole('button', { name: 'Next lesson' })).toBeDisabled()
})

it('exposes completion as an explicit toggle and allows uncompleting', () => {
  const update = jest.fn()
  render(<CourseLessonPlayer title="Design" videos={videos} progress={{ lastIndex: 0, completedIndexes: [0] }} onProgressUpdate={update} />)
  const toggle = screen.getByRole('button', { name: 'Completed' })
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(toggle)
  expect(update).toHaveBeenCalledWith(0, false)
})

it('uses native inline media and displays playback failures without losing navigation', () => {
  const { container } = render(<CourseLessonPlayer title="Design" videos={videos} />)
  const video = container.querySelector('video')!
  expect(video).toHaveAttribute('playsinline')
  expect(video).toHaveAttribute('preload', 'metadata')
  fireEvent.error(video)
  expect(screen.getByRole('alert')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next lesson' })).toBeEnabled()
})

it('handles empty courses and corrupt resume indices without crashing', () => {
  const view = render(<CourseLessonPlayer title="Design" videos={[]} />)
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
  view.rerender(<CourseLessonPlayer title="Design" videos={videos} progress={{ lastIndex: 100, completedIndexes: [] }} />)
  expect(screen.getByRole('heading', { name: 'Discover the problem' })).toBeInTheDocument()
})