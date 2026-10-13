import { createContext, useContext } from 'react'

/** State shared between routes. T2 provides the real value; until then nothing is loading. */
export interface GitHubState {
  /** True while the profile of the current route is being fetched. */
  isProfileLoading: boolean
}

export const GitHubContext = createContext<GitHubState>({ isProfileLoading: false })

export function useGitHub(): GitHubState {
  return useContext(GitHubContext)
}
