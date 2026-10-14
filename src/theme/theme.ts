import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

/** Same key and values as the script in index.html, which applies the theme before paint. */
export const THEME_STORAGE_KEY = 'github-explorer:theme'

const darkQuery = '(prefers-color-scheme: dark)'

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

/** The visitor's choice wins; without one, the system's preference. */
export function resolveTheme(stored: Theme | null, systemIsDark: boolean): Theme {
  return stored ?? (systemIsDark ? 'dark' : 'light')
}

// A choice made while storage is blocked still wins over the system for this session.
let sessionChoice: Theme | null = null

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    if (isTheme(value)) return value
  } catch {
    // Blocked storage: fall back to this session's choice, if any.
  }
  return sessionChoice
}

function systemIsDark(): boolean {
  return window.matchMedia?.(darkQuery).matches ?? false
}

function apply(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function currentTheme(): Theme {
  const applied = document.documentElement.getAttribute('data-theme')
  return isTheme(applied) ? applied : resolveTheme(storedTheme(), systemIsDark())
}

/** Applies `theme` and keeps it as the visitor's choice; blocked storage keeps it in memory. */
export function chooseTheme(theme: Theme) {
  sessionChoice = theme
  apply(theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Blocked storage: the choice lasts for this session only.
  }
}

/** Notifies on every change of the applied theme, and follows the system while nothing is chosen. */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const media = window.matchMedia?.(darkQuery)
  const followSystem = () => {
    if (storedTheme() === null) apply(systemIsDark() ? 'dark' : 'light')
  }
  media?.addEventListener('change', followSystem)
  return () => {
    observer.disconnect()
    media?.removeEventListener('change', followSystem)
  }
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, currentTheme)
  const toggle = useCallback(() => chooseTheme(currentTheme() === 'dark' ? 'light' : 'dark'), [])
  return { theme, toggle }
}

/** Test-only: forgets the in-memory choice between tests. */
export function resetSessionChoice() {
  sessionChoice = null
}
