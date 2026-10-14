import type { GitHubError } from '../services/githubApi'
import type { Profile, Repository } from '../types/github'

/** Session cache entry of one user; repositories arrive only after the profile. */
export interface CachedUser {
  profile: Profile
  repositories?: Repository[]
}

export type ProfileRequest =
  | { key: string; status: 'loading' }
  | { key: string; status: 'error'; error: GitHubError }

export type RepositoriesRequest =
  | { key: string; status: 'loading'; page: number }
  | { key: string; status: 'error'; error: GitHubError }

export type ReadmeRequest =
  | { key: string; status: 'loading' }
  | { key: string; status: 'error'; error: GitHubError }

export interface GitHubState {
  /** Keyed by the lowercase login. */
  users: Record<string, CachedUser>
  /** The profile request of the current route, if any is loading or failed. */
  profileRequest: ProfileRequest | null
  /** The repositories request of the current route, if any is loading or failed. */
  reposRequest: RepositoriesRequest | null
  /** README HTML by lowercase `owner/repo`; `null` when the repository has none. Errors are never kept here. */
  readmes: Record<string, string | null>
  /** The README request of the current route, if one is loading or failed. */
  readmeRequest: ReadmeRequest | null
}

export type GitHubAction =
  | { type: 'profile/requested'; key: string }
  | { type: 'profile/loaded'; key: string; profile: Profile }
  | { type: 'profile/failed'; key: string; error: GitHubError }
  | { type: 'profile/cancelled'; key: string }
  | { type: 'repos/requested'; key: string }
  | { type: 'repos/page'; key: string; page: number }
  | { type: 'repos/loaded'; key: string; repositories: Repository[] }
  | { type: 'repos/failed'; key: string; error: GitHubError }
  | { type: 'repos/cancelled'; key: string }
  | { type: 'readme/requested'; key: string }
  | { type: 'readme/loaded'; key: string; html: string | null }
  | { type: 'readme/failed'; key: string; error: GitHubError }
  | { type: 'readme/cancelled'; key: string }

export const initialGitHubState: GitHubState = {
  users: {},
  profileRequest: null,
  reposRequest: null,
  readmes: {},
  readmeRequest: null,
}

/** Cache key of a repository: owners and repository names are case-insensitive. */
export function repositoryKey(owner: string, repo: string): string {
  return `${owner}/${repo}`.toLowerCase()
}

/** Cache key of a login: GitHub logins are case-insensitive. */
export function userKey(login: string): string {
  return login.toLowerCase()
}

export function isProfileLoading(state: GitHubState): boolean {
  return state.profileRequest?.status === 'loading'
}

function profileReducer(state: GitHubState, action: GitHubAction): GitHubState {
  if (action.type === 'profile/requested') {
    return { ...state, profileRequest: { key: action.key, status: 'loading' } }
  }
  // Anything else answers a request; an answer for another key is stale and dropped.
  if (state.profileRequest?.key !== action.key) return state

  switch (action.type) {
    case 'profile/loaded':
      return {
        ...state,
        users: { ...state.users, [action.key]: { ...state.users[action.key], profile: action.profile } },
        profileRequest: null,
      }
    case 'profile/failed':
      return { ...state, profileRequest: { key: action.key, status: 'error', error: action.error } }
    case 'profile/cancelled':
      return { ...state, profileRequest: null }
    default:
      return state
  }
}

function reposReducer(state: GitHubState, action: GitHubAction): GitHubState {
  if (action.type === 'repos/requested') {
    return { ...state, reposRequest: { key: action.key, status: 'loading', page: 1 } }
  }
  if (state.reposRequest?.key !== action.key) return state

  switch (action.type) {
    case 'repos/page':
      return { ...state, reposRequest: { key: action.key, status: 'loading', page: action.page } }
    case 'repos/loaded': {
      const cached = state.users[action.key]
      // Repositories hang off a cached profile; without one there is nothing to attach to.
      if (!cached) return state
      return {
        ...state,
        users: { ...state.users, [action.key]: { ...cached, repositories: action.repositories } },
        reposRequest: null,
      }
    }
    case 'repos/failed':
      return { ...state, reposRequest: { key: action.key, status: 'error', error: action.error } }
    case 'repos/cancelled':
      return { ...state, reposRequest: null }
    default:
      return state
  }
}

function readmeReducer(state: GitHubState, action: GitHubAction): GitHubState {
  if (action.type === 'readme/requested') {
    return { ...state, readmeRequest: { key: action.key, status: 'loading' } }
  }
  if (state.readmeRequest?.key !== action.key) return state

  switch (action.type) {
    case 'readme/loaded':
      return { ...state, readmes: { ...state.readmes, [action.key]: action.html }, readmeRequest: null }
    case 'readme/failed':
      return { ...state, readmeRequest: { key: action.key, status: 'error', error: action.error } }
    case 'readme/cancelled':
      return { ...state, readmeRequest: null }
    default:
      return state
  }
}

export function githubReducer(state: GitHubState, action: GitHubAction): GitHubState {
  if (action.type.startsWith('profile/')) return profileReducer(state, action)
  if (action.type.startsWith('readme/')) return readmeReducer(state, action)
  return reposReducer(state, action)
}
