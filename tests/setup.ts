import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom does not implement scrolling; the router calls it on every navigation.
window.scrollTo = vi.fn()

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.location.hash = ''
})
