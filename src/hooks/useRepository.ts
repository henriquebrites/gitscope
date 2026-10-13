import { useCallback, useEffect, useState } from 'react'
import { getRepository, GitHubApiError, type GitHubError } from '../services/githubApi'
import type { Repository } from '../types/github'

export type RepositoryResult =
  | { status: 'loading' }
  | { status: 'success'; repository: Repository }
  | { status: 'error'; error: GitHubError }

interface Answer {
  key: string
  attempt: number
  result: RepositoryResult
}

/**
 * Repository `repoName` of `owner` from the API. Only the current route's answer is ever
 * shown: a change of repository or unmount aborts the request in flight.
 */
export function useRepository(
  owner: string,
  repoName: string,
): { result: RepositoryResult; retry: () => void } {
  const [attempt, setAttempt] = useState(0)
  const [answer, setAnswer] = useState<Answer | null>(null)
  // GitHub owners and repository names are case-insensitive.
  const key = `${owner}/${repoName}`.toLowerCase()

  useEffect(() => {
    const controller = new AbortController()
    const settle = (result: RepositoryResult) => {
      if (!controller.signal.aborted) setAnswer({ key, attempt, result })
    }
    getRepository(owner, repoName, controller.signal).then(
      (repository) => settle({ status: 'success', repository }),
      (error: unknown) =>
        settle({
          status: 'error',
          error: error instanceof GitHubApiError ? error.error : { kind: 'unexpected' },
        }),
    )
    return () => controller.abort()
  }, [owner, repoName, key, attempt])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])

  // An answer to another repository or to an earlier attempt is not this one's.
  const current = answer?.key === key && answer.attempt === attempt ? answer.result : null
  return { result: current ?? { status: 'loading' }, retry }
}
