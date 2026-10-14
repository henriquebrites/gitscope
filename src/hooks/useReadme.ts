import { useCallback, useEffect, useState } from 'react'
import { useGitHub } from '../context/GitHubContext'
import { repositoryKey } from '../context/githubReducer'
import { getReadme, GitHubApiError, type GitHubError } from '../services/githubApi'

export type ReadmeResult =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; html: string }
  | { status: 'absent' }
  | { status: 'error'; error: GitHubError }

/**
 * README of `owner/repo`, from the session cache or the API, requested only once `enabled`
 * (the repository is on screen). A README or its absence is kept for the session; a failure
 * is not, so reopening the repository asks again. Nothing retries on its own: only `retry`.
 * A change of repository or unmount aborts the request in flight.
 */
export function useReadme(
  owner: string,
  repo: string,
  enabled: boolean,
): { result: ReadmeResult; retry: () => void } {
  const { state, dispatch } = useGitHub()
  const [attempt, setAttempt] = useState(0)
  const key = repositoryKey(owner, repo)
  const cached = state.readmes[key]
  const isCached = cached !== undefined

  useEffect(() => {
    if (!enabled || isCached) return
    const controller = new AbortController()
    dispatch({ type: 'readme/requested', key })
    getReadme(owner, repo, controller.signal).then(
      (html) => {
        if (!controller.signal.aborted) dispatch({ type: 'readme/loaded', key, html })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        dispatch({
          type: 'readme/failed',
          key,
          error: error instanceof GitHubApiError ? error.error : { kind: 'unexpected' },
        })
      },
    )
    return () => {
      controller.abort()
      dispatch({ type: 'readme/cancelled', key })
    }
  }, [owner, repo, key, enabled, isCached, attempt, dispatch])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])

  if (!enabled) return { result: { status: 'idle' }, retry }
  if (cached !== undefined) {
    return { result: cached === null ? { status: 'absent' } : { status: 'success', html: cached }, retry }
  }
  const request = state.readmeRequest
  if (request?.key === key && request.status === 'error') {
    return { result: { status: 'error', error: request.error }, retry }
  }
  return { result: { status: 'loading' }, retry }
}
