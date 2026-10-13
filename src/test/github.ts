import type { Profile, Repository } from '../types/github'

export const octocat: Profile = {
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

export function profileOf(login: string, overrides: Partial<Profile> = {}): Profile {
  return {
    ...octocat,
    login,
    name: `Name of ${login}`,
    html_url: `https://github.com/${login}`,
    bio: `Bio of ${login}`,
    email: `${login}@example.com`,
    ...overrides,
  }
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

export function abortError() {
  return new DOMException('The operation was aborted.', 'AbortError')
}

/** A promise with its resolve and reject exposed. */
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export const helloWorld: Repository = {
  id: 1296269,
  name: 'Hello-World',
  full_name: 'octocat/Hello-World',
  html_url: 'https://github.com/octocat/Hello-World',
  description: 'My first repository on GitHub!',
  stargazers_count: 12345,
  language: 'TypeScript',
  updated_at: '2026-10-01T12:00:00Z',
}
