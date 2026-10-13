import { useMemo, useReducer, type ReactNode } from 'react'
import { GitHubContext } from './GitHubContext'
import { githubReducer, initialGitHubState } from './githubReducer'

function GitHubProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(githubReducer, initialGitHubState)
  const value = useMemo(() => ({ state, dispatch }), [state])

  return <GitHubContext value={value}>{children}</GitHubContext>
}

export default GitHubProvider
