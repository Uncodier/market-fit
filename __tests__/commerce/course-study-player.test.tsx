import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CourseStudyPlayer } from '@/app/components/commerce/course/CourseStudyPlayer'
import { formatCourseTime, readStudyProgress, resolveCourseMedia } from '@/app/components/commerce/course/course-model'
import { demoAccountLibrary } from '@/app/home/demo-commerce'

const course = demoAccountLibrary.find(row => row.id === 'demo-course-1')!
const props = { item: course.catalog_item, storageKey: 'test-course', backUrl: '/home/library?subtype=course' }

beforeEach(() => { localStorage.clear(); jest.clearAllMocks() })

it('uses the catalog metadata shape and does not request account APIs', async () => {
  render(<CourseStudyPlayer {...props} />)
  expect(await screen.findByRole('heading', { name: 'Welcome to product design' })).toBeInTheDocument()
  expect(screen.getByText('Beginner')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Previous lesson/ })).toBeDisabled()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  expect(fetch).not.toHaveBeenCalled()
})

it('completes and reopens a lesson, without completing it through navigation', async () => {
  render(<CourseStudyPlayer {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Mark as complete' }))
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '17')
  fireEvent.click(screen.getByRole('button', { name: 'Completed' }))
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  fireEvent.click(screen.getByRole('button', { name: /Next lesson/ }))
  expect(screen.getByRole('heading', { name: 'Understand the problem before the solution' })).toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
})

it('restores a valid lesson and completion state without overwriting storage on mount', async () => {
  localStorage.setItem(props.storageKey, JSON.stringify({ lastIndex: 5, completedIndexes: [0, 1], positions: { 5: 20 }, notes: { 5: 'Try three ideas' } }))
  render(<CourseStudyPlayer {...props} />)
  expect(await screen.findByRole('heading', { name: 'Your next steps as a product designer' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Next lesson/ })).toBeDisabled()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33')
  await waitFor(() => expect(JSON.parse(localStorage.getItem(props.storageKey)!).notes[5]).toBe('Try three ideas'))
})

it('marks a native video complete only when it ends and handles retry', async () => {
  const load = jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  render(<CourseStudyPlayer {...props} />)
  const video = await screen.findByLabelText('Welcome to product design')
  fireEvent.ended(video)
  expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument()
  fireEvent.error(video)
  expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load this video')
  fireEvent.click(screen.getByRole('button', { name: 'Retry video' }))
  expect(load).toHaveBeenCalled()
  load.mockRestore()
})

it('remains functional when storage is unavailable', async () => {
  const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable') })
  render(<CourseStudyPlayer {...props} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Browser storage is unavailable')
  fireEvent.click(screen.getByRole('button', { name: /Next lesson/ }))
  expect(screen.getByRole('heading', { name: 'Understand the problem before the solution' })).toBeInTheDocument()
  get.mockRestore()
})

it('validates stored progress and does not trust malformed or stale indexes', () => {
  expect(readStudyProgress('{', 6).lastIndex).toBe(0)
  expect(readStudyProgress(JSON.stringify({ lastIndex: 99, completedIndexes: [0, 0, -1, 99, '1'], positions: { 0: -2 }, notes: { 0: 5 } }), 6))
    .toEqual({ lastIndex: 0, completedIndexes: [0], positions: {}, notes: {} })
  expect(formatCourseTime(75)).toBe('1:15')
})

it('normalizes exact provider hosts and rejects unsafe video URLs', () => {
  expect(resolveCourseMedia('https://youtu.be/aqz-KE-bpKQ')).toEqual({ kind: 'embed', url: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ' })
  expect(resolveCourseMedia('https://vimeo.com/123456')).toEqual({ kind: 'embed', url: 'https://player.vimeo.com/video/123456' })
  for (const url of ['javascript:alert(1)', 'http://example.com/video.mp4', 'https://user:password@example.com/v.mp4', 'https://youtube.com/watch?v=bad']) expect(resolveCourseMedia(url)).toBeNull()
  expect(resolveCourseMedia('https://example.com/youtube.com/watch?v=aqz-KE-bpKQ')?.kind).toBe('video')
})