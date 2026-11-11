import '@testing-library/jest-dom'

// jsdom lacks layout observation used by the actual Radix radio controls.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.matchMedia = jest.fn().mockImplementation(query => ({
  matches: String(query).includes('prefers-reduced-motion'),
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}))