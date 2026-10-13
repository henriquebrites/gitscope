import { describe, expect, it } from 'vitest'
import { octocat } from '../test/github'
import {
  githubReducer,
  initialGitHubState,
  isProfileLoading,
  userKey,
  type GitHubAction,
  type GitHubState,
} from './githubReducer'

const loadingA: GitHubState = { users: {}, profileRequest: { key: 'a', status: 'loading' } }
const network = { kind: 'network' } as const

describe('githubReducer', () => {
  it('requested starts loading the key, replacing any other request', () => {
    expect(githubReducer(initialGitHubState, { type: 'profile/requested', key: 'a' })).toEqual(loadingA)
    expect(githubReducer(loadingA, { type: 'profile/requested', key: 'b' }).profileRequest).toEqual({
      key: 'b',
      status: 'loading',
    })
  })

  it('loaded caches the profile under the key and ends the request', () => {
    expect(githubReducer(loadingA, { type: 'profile/loaded', key: 'a', profile: octocat })).toEqual({
      users: { a: { profile: octocat } },
      profileRequest: null,
    })
  })

  it('failed keeps the error for the key', () => {
    expect(githubReducer(loadingA, { type: 'profile/failed', key: 'a', error: network })).toEqual({
      users: {},
      profileRequest: { key: 'a', status: 'error', error: network },
    })
  })

  it('cancelled ends the request of the key', () => {
    expect(githubReducer(loadingA, { type: 'profile/cancelled', key: 'a' })).toEqual({
      users: {},
      profileRequest: null,
    })
  })

  it.each<GitHubAction>([
    { type: 'profile/loaded', key: 'b', profile: octocat },
    { type: 'profile/failed', key: 'b', error: network },
    { type: 'profile/cancelled', key: 'b' },
  ])('drops a stale $type for another key', (action) => {
    expect(githubReducer(loadingA, action)).toBe(loadingA)
  })

  it('requested takes over from a failed request of another key', () => {
    const errorA: GitHubState = { users: {}, profileRequest: { key: 'a', status: 'error', error: network } }
    expect(githubReducer(errorA, { type: 'profile/requested', key: 'b' }).profileRequest).toEqual({
      key: 'b',
      status: 'loading',
    })
  })

  it('isProfileLoading is true only while loading', () => {
    expect(isProfileLoading(loadingA)).toBe(true)
    expect(isProfileLoading(initialGitHubState)).toBe(false)
    expect(
      isProfileLoading({ users: {}, profileRequest: { key: 'a', status: 'error', error: network } }),
    ).toBe(false)
  })

  it('keys users by the lowercase login', () => {
    expect(userKey('OctoCat')).toBe('octocat')
  })
})
