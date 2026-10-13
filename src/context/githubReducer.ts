import type { GitHubError } from '../services/githubApi'
import type { Profile } from '../types/github'

/** Session cache entry of one user; T3 adds the repositories. */
export interface CachedUser {
  profile: Profile
}

export type ProfileRequest =
  | { key: string; status: 'loading' }
  | { key: string; status: 'error'; error: GitHubError }

export interface GitHubState {
  /** Keyed by the lowercase login. */
  users: Record<string, CachedUser>
  /** The profile request of the current route, if any is loading or failed. */
  profileRequest: ProfileRequest | null
}

export type GitHubAction =
  | { type: 'profile/requested'; key: string }
  | { type: 'profile/loaded'; key: string; profile: Profile }
  | { type: 'profile/failed'; key: string; error: GitHubError }
  | { type: 'profile/cancelled'; key: string }

export const initialGitHubState: GitHubState = { users: {}, profileRequest: null }

/** Cache key of a login: GitHub logins are case-insensitive. */
export function userKey(login: string): string {
  return login.toLowerCase()
}

export function isProfileLoading(state: GitHubState): boolean {
  return state.profileRequest?.status === 'loading'
}

export function githubReducer(state: GitHubState, action: GitHubAction): GitHubState {
  if (action.type === 'profile/requested') {
    return { ...state, profileRequest: { key: action.key, status: 'loading' } }
  }
  // Anything else answers a request; an answer for another key is stale and dropped.
  if (state.profileRequest?.key !== action.key) return state

  switch (action.type) {
    case 'profile/loaded':
      return {
        users: { ...state.users, [action.key]: { profile: action.profile } },
        profileRequest: null,
      }
    case 'profile/failed':
      return { ...state, profileRequest: { key: action.key, status: 'error', error: action.error } }
    case 'profile/cancelled':
      return { ...state, profileRequest: null }
  }
}
