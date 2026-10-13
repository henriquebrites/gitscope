import { createContext, useContext, type Dispatch } from 'react'
import type { GitHubAction, GitHubState } from './githubReducer'

/** State shared between routes: the session cache and the current profile request. */
export interface GitHubContextValue {
  state: GitHubState
  dispatch: Dispatch<GitHubAction>
}

export const GitHubContext = createContext<GitHubContextValue | null>(null)

export function useGitHub(): GitHubContextValue {
  const value = useContext(GitHubContext)
  if (!value) throw new Error('useGitHub must be used inside GitHubProvider')
  return value
}
