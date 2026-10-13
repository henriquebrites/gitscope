import { useCallback, useEffect, useState } from 'react'
import { useGitHub } from '../context/GitHubContext'
import { userKey } from '../context/githubReducer'
import { getUser, GitHubApiError, type GitHubError } from '../services/githubApi'
import type { Profile } from '../types/github'

export type ProfileResult =
  | { status: 'loading' }
  | { status: 'success'; profile: Profile }
  | { status: 'error'; error: GitHubError }

/**
 * Profile of `login`, from the session cache or the API. Only the current login's answer
 * is ever shown: a login change or unmount aborts the request in flight.
 */
export function useProfile(login: string): { result: ProfileResult; retry: () => void } {
  const { state, dispatch } = useGitHub()
  const [attempt, setAttempt] = useState(0)
  const key = userKey(login)
  const cached = state.users[key]
  const isCached = cached !== undefined

  useEffect(() => {
    if (isCached) return
    const controller = new AbortController()
    dispatch({ type: 'profile/requested', key })
    // GitHub logins are case-insensitive, so the cache key doubles as the requested login.
    getUser(key, controller.signal).then(
      (profile) => {
        if (!controller.signal.aborted) dispatch({ type: 'profile/loaded', key, profile })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        dispatch({
          type: 'profile/failed',
          key,
          error: error instanceof GitHubApiError ? error.error : { kind: 'unexpected' },
        })
      },
    )
    return () => {
      controller.abort()
      dispatch({ type: 'profile/cancelled', key })
    }
  }, [key, isCached, attempt, dispatch])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])

  const request = state.profileRequest
  let result: ProfileResult = { status: 'loading' }
  if (cached) result = { status: 'success', profile: cached.profile }
  else if (request?.key === key && request.status === 'error') {
    result = { status: 'error', error: request.error }
  }
  return { result, retry }
}
