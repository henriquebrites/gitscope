import type { Profile } from '../types/github'

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
async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
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
    return (await response.json()) as T
  } catch (error) {
    if (isAbort(error, signal)) throw error
    throw new GitHubApiError({ kind: 'unexpected', status: response.status })
  }
}

export async function getUser(login: string, signal?: AbortSignal): Promise<Profile> {
  const user = await request<Profile>(`/users/${encodeURIComponent(login)}`, signal)
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
