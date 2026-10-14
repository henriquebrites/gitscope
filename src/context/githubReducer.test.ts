import { describe, expect, it } from 'vitest'
import { octocat, repositoryOf } from '../test/github'
import {
  githubReducer,
  initialGitHubState,
  isProfileLoading,
  repositoryKey,
  userKey,
  type GitHubAction,
  type GitHubState,
} from './githubReducer'

const loadingA: GitHubState = {
  ...initialGitHubState,
  profileRequest: { key: 'a', status: 'loading' },
}
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
      reposRequest: null,
      readmes: {},
      readmeRequest: null,
    })
  })

  it('failed keeps the error for the key', () => {
    expect(githubReducer(loadingA, { type: 'profile/failed', key: 'a', error: network })).toEqual({
      users: {},
      profileRequest: { key: 'a', status: 'error', error: network },
      reposRequest: null,
      readmes: {},
      readmeRequest: null,
    })
  })

  it('cancelled ends the request of the key', () => {
    expect(githubReducer(loadingA, { type: 'profile/cancelled', key: 'a' })).toEqual({
      users: {},
      profileRequest: null,
      reposRequest: null,
      readmes: {},
      readmeRequest: null,
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
    const errorA: GitHubState = {
      ...initialGitHubState,
      users: {},
      profileRequest: { key: 'a', status: 'error', error: network },
      reposRequest: null,
    }
    expect(githubReducer(errorA, { type: 'profile/requested', key: 'b' }).profileRequest).toEqual({
      key: 'b',
      status: 'loading',
    })
  })

  it('isProfileLoading is true only while loading', () => {
    expect(isProfileLoading(loadingA)).toBe(true)
    expect(isProfileLoading(initialGitHubState)).toBe(false)
    expect(
      isProfileLoading({
        ...initialGitHubState,
        users: {},
        profileRequest: { key: 'a', status: 'error', error: network },
        reposRequest: null,
      }),
    ).toBe(false)
  })

  it('keys users by the lowercase login', () => {
    expect(userKey('OctoCat')).toBe('octocat')
  })

  describe('repos', () => {
    const repositories = [repositoryOf('hello-world')]
    const cachedA: GitHubState = { ...initialGitHubState, users: { a: { profile: octocat } } }
    const reposLoadingA: GitHubState = { ...cachedA, reposRequest: { key: 'a', status: 'loading', page: 1 } }

    it('requested starts at page 1, replacing any other request', () => {
      expect(githubReducer(cachedA, { type: 'repos/requested', key: 'a' })).toEqual(reposLoadingA)
      const errorB: GitHubState = { ...cachedA, reposRequest: { key: 'b', status: 'error', error: network } }
      expect(githubReducer(errorB, { type: 'repos/requested', key: 'a' }).reposRequest).toEqual({
        key: 'a',
        status: 'loading',
        page: 1,
      })
    })

    it('page moves the progress of the key', () => {
      expect(githubReducer(reposLoadingA, { type: 'repos/page', key: 'a', page: 3 }).reposRequest).toEqual({
        key: 'a',
        status: 'loading',
        page: 3,
      })
    })

    it('loaded caches the repositories next to the profile and ends the request', () => {
      expect(githubReducer(reposLoadingA, { type: 'repos/loaded', key: 'a', repositories })).toEqual({
        users: { a: { profile: octocat, repositories } },
        profileRequest: null,
        reposRequest: null,
        readmes: {},
        readmeRequest: null,
      })
    })

    it('loaded without a cached profile is ignored', () => {
      const orphan: GitHubState = { ...initialGitHubState, reposRequest: { key: 'a', status: 'loading', page: 1 } }
      expect(githubReducer(orphan, { type: 'repos/loaded', key: 'a', repositories })).toBe(orphan)
    })

    it('failed keeps the error for the key', () => {
      expect(githubReducer(reposLoadingA, { type: 'repos/failed', key: 'a', error: network }).reposRequest).toEqual({
        key: 'a',
        status: 'error',
        error: network,
      })
    })

    it('cancelled ends the request of the key', () => {
      expect(githubReducer(reposLoadingA, { type: 'repos/cancelled', key: 'a' })).toEqual(cachedA)
    })

    it.each<GitHubAction>([
      { type: 'repos/page', key: 'b', page: 2 },
      { type: 'repos/loaded', key: 'b', repositories },
      { type: 'repos/failed', key: 'b', error: network },
      { type: 'repos/cancelled', key: 'b' },
    ])('drops a stale $type for another key', (action) => {
      expect(githubReducer(reposLoadingA, action)).toBe(reposLoadingA)
    })

    it('profile loaded keeps repositories already cached', () => {
      const withRepos: GitHubState = {
        ...initialGitHubState,
        users: { a: { profile: octocat, repositories } },
        profileRequest: { key: 'a', status: 'loading' },
        reposRequest: null,
      }
      const next = githubReducer(withRepos, { type: 'profile/loaded', key: 'a', profile: { ...octocat, name: 'New' } })
      expect(next.users.a).toEqual({ profile: { ...octocat, name: 'New' }, repositories })
    })

    it('repository actions leave the profile request alone', () => {
      const profileLoading: GitHubState = { ...reposLoadingA, profileRequest: { key: 'b', status: 'loading' } }
      expect(githubReducer(profileLoading, { type: 'repos/page', key: 'a', page: 2 }).profileRequest).toEqual({
        key: 'b',
        status: 'loading',
      })
    })
  })
})

describe('githubReducer: readme', () => {
  const requested = (key: string, state: GitHubState = initialGitHubState) =>
    githubReducer(state, { type: 'readme/requested', key })

  it('readme: repositoryKey lowercases owner and name', () => {
    expect(repositoryKey('OctoCat', 'Hello-World')).toBe('octocat/hello-world')
  })

  it('readme: loaded keeps the HTML or the absence (null) under the key and ends the request', () => {
    const withHtml = githubReducer(requested('o/a'), { type: 'readme/loaded', key: 'o/a', html: '<p>A</p>' })
    expect(withHtml.readmes).toEqual({ 'o/a': '<p>A</p>' })
    expect(withHtml.readmeRequest).toBeNull()

    const withAbsence = githubReducer(requested('o/b', withHtml), { type: 'readme/loaded', key: 'o/b', html: null })
    expect(withAbsence.readmes).toEqual({ 'o/a': '<p>A</p>', 'o/b': null })
  })

  it('readme: failed keeps the error on the request only, never in the cache', () => {
    const failed = githubReducer(requested('o/a'), { type: 'readme/failed', key: 'o/a', error: network })

    expect(failed.readmeRequest).toEqual({ key: 'o/a', status: 'error', error: network })
    expect(failed.readmes).toEqual({})
    // A new request replaces the failure.
    expect(requested('o/a', failed).readmeRequest).toEqual({ key: 'o/a', status: 'loading' })
  })

  it.each<GitHubAction>([
    { type: 'readme/loaded', key: 'o/old', html: '<p>late</p>' },
    { type: 'readme/failed', key: 'o/old', error: network },
    { type: 'readme/cancelled', key: 'o/old' },
  ])('readme: an answer for another key is stale and dropped ($type)', (action) => {
    const current = requested('o/new')

    expect(githubReducer(current, action)).toBe(current)
  })

  it('readme: cancelled ends the request of the key', () => {
    expect(githubReducer(requested('o/a'), { type: 'readme/cancelled', key: 'o/a' }).readmeRequest).toBeNull()
  })
})
