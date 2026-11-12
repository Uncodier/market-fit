import "@testing-library/jest-dom"

global.fetch = jest.fn()
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", { writable: true, value: jest.fn(query => ({
    matches: String(query).includes("prefers-reduced-motion"), media: query, onchange: null, addListener: jest.fn(), removeListener: jest.fn(),
    addEventListener: jest.fn(), removeEventListener: jest.fn(), dispatchEvent: jest.fn(),
  })) })
}