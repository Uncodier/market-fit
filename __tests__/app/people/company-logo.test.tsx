import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CompanyLogo } from '@/app/people/company-logo'

let images: HTMLImageElement[]

beforeEach(() => {
  images = []
  jest.spyOn(window, 'Image').mockImplementation(() => {
    const image = document.createElement('img')
    images.push(image)
    return image
  })
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
})

it('shows a building icon when the company has no logo', () => {
  render(<CompanyLogo name="Acme" />)

  const fallback = screen.getByRole('img', { name: 'Acme logo unavailable' })
  expect(fallback.querySelector('svg')).toBeInTheDocument()
  expect(screen.queryByAltText('Acme logo')).not.toBeInTheDocument()
})

it('keeps the fallback when a logo fails to load', () => {
  render(<CompanyLogo name="Acme" src="https://example.com/broken.png" />)
  act(() => { images.forEach(image => fireEvent.error(image)) })

  expect(screen.getByRole('img', { name: 'Acme logo unavailable' })).toBeInTheDocument()
  expect(screen.queryByAltText('Acme logo')).not.toBeInTheDocument()
})

it('replaces the fallback with a successfully loaded logo', () => {
  render(<CompanyLogo name="Acme" src="https://example.com/logo.png" />)
  act(() => { images.forEach(image => fireEvent.load(image)) })

  expect(screen.getByAltText('Acme logo')).toHaveAttribute('src', 'https://example.com/logo.png')
  expect(screen.queryByRole('img', { name: 'Acme logo unavailable' })).not.toBeInTheDocument()
})

it('can load a new logo after the previous URL failed', () => {
  const { rerender } = render(<CompanyLogo name="Acme" src="https://example.com/broken.png" />)
  act(() => { images.forEach(image => fireEvent.error(image)) })
  rerender(<CompanyLogo name="Acme" src="https://example.com/new.png" />)
  act(() => { images.forEach(image => fireEvent.load(image)) })

  expect(screen.getByAltText('Acme logo')).toHaveAttribute('src', 'https://example.com/new.png')
  expect(screen.queryByRole('img', { name: 'Acme logo unavailable' })).not.toBeInTheDocument()
})