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

let nextRepositoryId = 1

export function repositoryOf(name: string, overrides: Partial<Repository> = {}): Repository {
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

/** `count` repositories named `<prefix>-<n>`, with 0 stars unless `stars` says otherwise. */
export function repositoriesOf(prefix: string, count: number, stars: (index: number) => number = () => 0) {
  return Array.from({ length: count }, (_, index) =>
    repositoryOf(`${prefix}-${String(index + 1).padStart(3, '0')}`, { stargazers_count: stars(index) }),
  )
}

/** A repositories page, with `link` rel="next" when another page follows. */
export function repositoriesPage(items: Repository[], page: number, lastPage: number) {
  const url = (n: number) => `<https://api.github.com/user/1/repos?per_page=100&page=${n}>`
  const links: string[] = []
  if (page < lastPage) links.push(`${url(page + 1)}; rel="next"`, `${url(lastPage)}; rel="last"`)
  if (page > 1) links.push(`${url(1)}; rel="first"`, `${url(page - 1)}; rel="prev"`)
  return jsonResponse(items, 200, links.length > 0 ? { link: links.join(', ') } : {})
}

export function isRepositoriesUrl(url: string): boolean {
  return /^https:\/\/api\.github\.com\/users\/[^/]+\/repos\?/.test(url)
}

export function pageOf(url: string): number {
  return Number(new URL(url).searchParams.get('page'))
}

/**
 * A `fetch` stub for routes: profiles mirror octocat under the requested login, each login's
 * repositories come from `repositories` (default: none), split in pages of 100, and every
 * single repository exists, mirroring Hello-World under the requested owner and name.
 */
export function githubFetch(repositories: Record<string, Repository[]> = {}) {
  return async (url: string): Promise<Response> => {
    const [, root, owner = '', name = ''] = new URL(url).pathname.split('/').map(decodeURIComponent)
    if (root === 'repos') {
      return jsonResponse({
        ...helloWorld,
        name,
        full_name: `${owner}/${name}`,
        html_url: `https://github.com/${owner}/${name}`,
      })
    }
    const login = owner
    if (!isRepositoriesUrl(url)) {
      return jsonResponse({ ...octocat, login, html_url: `https://github.com/${login}` })
    }
    const all = repositories[login.toLowerCase()] ?? []
    const page = pageOf(url)
    const lastPage = Math.max(1, Math.ceil(all.length / 100))
    return repositoriesPage(all.slice((page - 1) * 100, page * 100), page, lastPage)
  }
}
