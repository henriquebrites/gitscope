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

// Primary rate limit: 403 or 429 with x-ratelimit-remaining 0; the reset is in UTC epoch seconds.
function toError(response: Response): GitHubError {
  if (response.status === 404) return { kind: 'not-found' }
  const limited =
    (response.status === 403 || response.status === 429) &&
    response.headers.get('x-ratelimit-remaining') === '0'
  if (limited) {
    const reset = Number(response.headers.get('x-ratelimit-reset') ?? Number.NaN)
    return Number.isFinite(reset)
      ? { kind: 'rate-limited', resetAt: new Date(reset * 1000) }
      : { kind: 'rate-limited' }
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
