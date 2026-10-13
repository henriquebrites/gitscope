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

export type UserHandler = (route: Route, login: string) => Promise<void> | void

export function json(route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

/**
 * Simulates the GitHub API and avatar host. By default every user exists and mirrors
 * octocat under its own login, and every repository exists; `onUser` replaces the user answer.
 */
export async function stubGitHub(page: Page, onUser?: UserHandler) {
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
  await stubRepository(page)
  return users
}

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

export function repositoryOf(owner: string, name: string): RepositoryFixture {
  return {
    id: 1296269,
    name,
    full_name: `${owner}/${name}`,
    html_url: `https://github.com/${owner}/${name}`,
    description: 'My first repository on GitHub!',
    stargazers_count: 12345,
    language: 'TypeScript',
    updated_at: '2026-10-01T12:00:00Z',
  }
}

export type RepositoryHandler = (route: Route, owner: string, name: string) => Promise<void> | void

/**
 * Simulates `GET /repos/{owner}/{repo}`; registered after `stubGitHub`, it takes precedence.
 * By default every repository exists. Returns the `owner/name` of every request.
 */
export async function stubRepository(page: Page, onRepository?: RepositoryHandler) {
  const requested: string[] = []
  await page.route('https://api.github.com/repos/*/*', (route) => {
    const [owner, name] = new URL(route.request().url()).pathname
      .split('/')
      .slice(2)
      .map(decodeURIComponent)
    requested.push(`${owner}/${name}`)
    if (onRepository) return onRepository(route, owner, name)
    return json(route, repositoryOf(owner, name))
  })
  return requested
}
