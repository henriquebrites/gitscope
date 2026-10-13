import { useCallback, useEffect, useState } from 'react'
import { useGitHub } from '../context/GitHubContext'
import { userKey } from '../context/githubReducer'
import { getRepositories, GitHubApiError, type GitHubError } from '../services/githubApi'
import type { Repository } from '../types/github'

export type RepositoriesResult =
  | { status: 'idle' }
  | { status: 'loading'; page: number }
  | { status: 'success'; repositories: Repository[] }
  | { status: 'error'; error: GitHubError }

/**
 * Every repository of `login`, from the session cache or the API. Nothing is requested until
 * `enabled` (the profile loaded); a login change or unmount aborts the pages in flight.
 */
export function useRepositories(
  login: string,
  enabled: boolean,
): { result: RepositoriesResult; retry: () => void } {
  const { state, dispatch } = useGitHub()
  const [attempt, setAttempt] = useState(0)
  const key = userKey(login)
  const cached = state.users[key]?.repositories
  const isCached = cached !== undefined

  useEffect(() => {
    if (!enabled || isCached) return
    const controller = new AbortController()
    dispatch({ type: 'repos/requested', key })
    getRepositories(key, {
      signal: controller.signal,
      onPage: (page) => {
        if (!controller.signal.aborted) dispatch({ type: 'repos/page', key, page })
      },
    }).then(
      (repositories) => {
        if (!controller.signal.aborted) dispatch({ type: 'repos/loaded', key, repositories })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        dispatch({
          type: 'repos/failed',
          key,
          error: error instanceof GitHubApiError ? error.error : { kind: 'unexpected' },
        })
      },
    )
    return () => {
      controller.abort()
      dispatch({ type: 'repos/cancelled', key })
    }
  }, [key, enabled, isCached, attempt, dispatch])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])

  const request = state.reposRequest
  let result: RepositoriesResult = { status: 'idle' }
  if (cached) result = { status: 'success', repositories: cached }
  else if (enabled) {
    const own = request?.key === key ? request : null
    if (own?.status === 'error') result = { status: 'error', error: own.error }
    else result = { status: 'loading', page: own?.page ?? 1 }
  }
  return { result, retry }
}
