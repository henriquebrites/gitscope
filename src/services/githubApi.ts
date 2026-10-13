import type { Profile, Repository } from '../types/github'

const API_URL = 'https://api.github.com'

/** Failures the interface can act on; nothing outside this module sees HTTP. */
export type GitHubError =
  | { kind: 'not-found' }
  | { kind: 'rate-limited'; resetAt?: Date }
  | { kind: 'network' }
  | { kind: 'unexpected'; status?: number }

export class GitHubApiError extends Error {
  readonly error: GitHubError

  constructor(error: GitHubError) {
    super(`GitHub request failed: ${error.kind}`)
    this.name = 'GitHubApiError'
    this.error = error
  }
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError')
}

function rateLimited(resetMs: number): GitHubError {
  return Number.isFinite(resetMs)
    ? { kind: 'rate-limited', resetAt: new Date(resetMs) }
    : { kind: 'rate-limited' }
}

// 403 or 429. Secondary limit: retry-after in seconds, which takes precedence. Primary limit:
// x-ratelimit-remaining 0, with the reset in UTC epoch seconds.
function toError(response: Response): GitHubError {
  if (response.status === 404) return { kind: 'not-found' }
  if (response.status === 403 || response.status === 429) {
    const retryAfter = response.headers.get('retry-after')
    if (retryAfter !== null) return rateLimited(Date.now() + Number(retryAfter) * 1000)
    if (response.headers.get('x-ratelimit-remaining') === '0') {
      return rateLimited(Number(response.headers.get('x-ratelimit-reset') ?? Number.NaN) * 1000)
    }
  }
  return { kind: 'unexpected', status: response.status }
}

/** Anonymous GET; an abort rejects with the original AbortError, never a domain error. */
async function request<T>(path: string, signal?: AbortSignal): Promise<{ body: T; headers: Headers }> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal,
    })
  } catch (error) {
    if (isAbort(error, signal)) throw error
    throw new GitHubApiError({ kind: 'network' })
  }
  if (!response.ok) throw new GitHubApiError(toError(response))
  try {
    return { body: (await response.json()) as T, headers: response.headers }
  } catch (error) {
    if (isAbort(error, signal)) throw error
    throw new GitHubApiError({ kind: 'unexpected', status: response.status })
  }
}

export async function getUser(login: string, signal?: AbortSignal): Promise<Profile> {
  const { body: user } = await request<Profile>(`/users/${encodeURIComponent(login)}`, signal)
  return {
    login: user.login,
    name: user.name ?? null,
    avatar_url: user.avatar_url,
    html_url: user.html_url,
    bio: user.bio ?? null,
    email: user.email ?? null,
    followers: user.followers,
    following: user.following,
    public_repos: user.public_repos,
  }
}

const API_PAGE_SIZE = 100

// `link: <…?page=2>; rel="next", <…?page=3>; rel="last"`; GitHub omits it on a single page.
function hasNextPage(headers: Headers): boolean {
  const link = headers.get('link') ?? ''
  return link.split(',').some((part) => /;\s*rel="next"/.test(part))
}

function toRepository(repository: Repository): Repository {
  return {
    id: repository.id,
    name: repository.name,
    full_name: repository.full_name,
    html_url: repository.html_url,
    description: repository.description ?? null,
    stargazers_count: repository.stargazers_count,
    language: repository.language ?? null,
    updated_at: repository.updated_at,
  }
}

/**
 * Every public repository of `login`, one page at a time: page N+1 is requested only after
 * page N arrived and only while its `link` header has rel="next". Any failing page rejects
 * the whole list.
 */
export async function getRepositories(
  login: string,
  options: { signal?: AbortSignal; onPage?: (page: number) => void } = {},
): Promise<Repository[]> {
  const { signal, onPage } = options
  const repositories: Repository[] = []
  for (let page = 1; ; page += 1) {
    onPage?.(page)
    const { body, headers } = await request<Repository[]>(
      `/users/${encodeURIComponent(login)}/repos?per_page=${API_PAGE_SIZE}&page=${page}`,
      signal,
    )
    // A response that ignored the abort must not lead to the next page.
    signal?.throwIfAborted()
    if (!Array.isArray(body)) throw new GitHubApiError({ kind: 'unexpected', status: 200 })
    repositories.push(...body.map(toRepository))
    if (!hasNextPage(headers)) return repositories
  }
}
