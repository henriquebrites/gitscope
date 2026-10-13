import type { Page, Route } from '@playwright/test'

export interface ProfileFixture {
  login: string
  name: string | null
  avatar_url: string
  html_url: string
  bio: string | null
  email: string | null
  followers: number
  following: number
  public_repos: number
}

export const octocat: ProfileFixture = {
  login: 'octocat',
  name: 'The Octocat',
  avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
  html_url: 'https://github.com/octocat',
  bio: 'Mascote do GitHub.',
  email: 'octocat@github.com',
  followers: 12345,
  following: 7,
  public_repos: 8,
}

// 1×1 transparent PNG, so avatars never leave the machine.
const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

export interface RepositoryFixture {
  id: number
  name: string
  full_name: string
  html_url: string
  description: string | null
  stargazers_count: number
  language: string | null
  updated_at: string
}

let nextRepositoryId = 1

export function repositoryOf(name: string, overrides: Partial<RepositoryFixture> = {}): RepositoryFixture {
  return {
    id: nextRepositoryId++,
    name,
    full_name: `octocat/${name}`,
    html_url: `https://github.com/octocat/${name}`,
    description: `Description of ${name}`,
    stargazers_count: 0,
    language: 'TypeScript',
    updated_at: '2026-10-01T12:00:00Z',
    ...overrides,
  }
}

/** `count` repositories named `<prefix>-<nnn>`. */
export function repositoriesOf(prefix: string, count: number): RepositoryFixture[] {
  return Array.from({ length: count }, (_, index) => repositoryOf(`${prefix}-${String(index + 1).padStart(3, '0')}`))
}

export type UserHandler = (route: Route, login: string) => Promise<void> | void
export type RepositoriesHandler = (route: Route, login: string, page: number) => Promise<void> | void

export function json(route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'Access-Control-Allow-Origin': '*',
      // As GitHub does (Context7: CORS); without Link the browser hides the pagination.
      'Access-Control-Expose-Headers': 'ETag, Link, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

/** Serves `repositories` in API pages of 100, linked by rel="next". */
export function pagedRepositories(repositories: RepositoryFixture[]): RepositoriesHandler {
  return (route, _login, page) => {
    const lastPage = Math.max(1, Math.ceil(repositories.length / 100))
    const next = `<https://api.github.com/user/1/repos?per_page=100&page=${page + 1}>; rel="next"`
    return json(route, repositories.slice((page - 1) * 100, page * 100), 200, page < lastPage ? { link: next } : {})
  }
}

const repositoriesPath = /^\/users\/[^/]+\/repos$/

/**
 * Simulates the GitHub API and avatar host. By default every user exists and mirrors
 * octocat under its own login, with no repositories; `onUser` and `onRepositories` replace
 * those answers. Returns the logins whose profile was requested.
 */
export async function stubGitHub(page: Page, onUser?: UserHandler, onRepositories?: RepositoriesHandler) {
  const users: string[] = []
  await page.route('https://avatars.githubusercontent.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: pixel }),
  )
  await page.route('https://api.github.com/users/*', (route) => {
    const login = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() ?? '')
    users.push(login)
    if (onUser) return onUser(route, login)
    return json(route, { ...octocat, login, html_url: `https://github.com/${login}` })
  })
  await page.route(
    (url) => url.hostname === 'api.github.com' && repositoriesPath.test(url.pathname),
    (route) => {
      const url = new URL(route.request().url())
      const login = decodeURIComponent(url.pathname.split('/')[2])
      const pageNumber = Number(url.searchParams.get('page'))
      if (onRepositories) return onRepositories(route, login, pageNumber)
      return json(route, [])
    },
  )
  return users
}
