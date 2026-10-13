import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  // Tests never reach the real GitHub API; a test that needs the network stubs fetch itself.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      throw new Error(`Unstubbed fetch in a test: ${String(input)}`)
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
