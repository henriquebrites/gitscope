import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeToggle from '../components/layout/ThemeToggle'
import { resetSessionChoice, resolveTheme, THEME_STORAGE_KEY } from './theme'

/** A `prefers-color-scheme` the test can flip, with the change event a browser would fire. */
function stubSystem(initiallyDark: boolean) {
  const listeners = new Set<() => void>()
  const media = {
    matches: initiallyDark,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', () => media)
  // Async act: the theme store hears the attribute change through a MutationObserver.
  return (dark: boolean) =>
    act(async () => {
      media.matches = dark
      listeners.forEach((listener) => listener())
    })
}

const root = () => document.documentElement.getAttribute('data-theme')

beforeEach(() => {
  localStorage.clear()
  resetSessionChoice()
  document.documentElement.setAttribute('data-theme', 'light')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('data-theme')
})

describe('resolveTheme', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    [null, false, 'light'],
    [null, true, 'dark'],
  ] as const)('stored %s, system dark %s -> %s', (stored, systemIsDark, expected) => {
    expect(resolveTheme(stored, systemIsDark)).toBe(expected)
  })
})

describe('ThemeToggle', () => {
  it('names the theme it switches to', () => {
    stubSystem(false)
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: 'Usar tema escuro' })).toBeVisible()
  })

  it.each(['click', 'Enter', 'Space'])('toggle stores the opposite theme (%s)', async (how) => {
    stubSystem(false)
    render(<ThemeToggle />)
    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: 'Usar tema escuro' })

    const press = async () => {
      if (how === 'click') await user.click(button)
      else {
        button.focus()
        await user.keyboard(how === 'Enter' ? '{Enter}' : ' ')
      }
    }

    await press()
    expect(root()).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(button).toHaveAccessibleName('Usar tema claro')
    expect(button).toHaveFocus()

    await press()
    expect(root()).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(button).toHaveAccessibleName('Usar tema escuro')
  })

  it('system change without a stored choice follows the system', async () => {
    const setSystem = stubSystem(false)
    render(<ThemeToggle />)

    await setSystem(true)
    expect(root()).toBe('dark')
    expect(screen.getByRole('button')).toHaveAccessibleName('Usar tema claro')
    await setSystem(false)
    expect(root()).toBe('light')
  })

  it('system change with a stored choice changes nothing', async () => {
    const setSystem = stubSystem(false)
    render(<ThemeToggle />)
    await userEvent.setup().click(screen.getByRole('button'))
    expect(root()).toBe('dark')

    await setSystem(true)
    await setSystem(false)
    expect(root()).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('blocked storage: the toggle still switches for the session, and the choice holds', async () => {
    const setSystem = stubSystem(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    render(<ThemeToggle />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Usar tema escuro' }))
    expect(root()).toBe('dark')
    expect(screen.getByRole('button')).toHaveAccessibleName('Usar tema claro')
    await setSystem(true)
    await setSystem(false)
    expect(root()).toBe('dark')
  })
})
