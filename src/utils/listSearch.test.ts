import { describe, expect, it } from 'vitest'
import { listSearchFrom } from './listSearch'

describe('listSearchFrom', () => {
  it('keeps the query the list was showing', () => {
    expect(listSearchFrom({ listSearch: '?sort=name-asc&page=2' })).toBe('?sort=name-asc&page=2')
  })

  it.each([
    ['no state', null],
    ['undefined state', undefined],
    ['state without listSearch', { other: '?sort=name-asc' }],
  ])('%s gives the default list', (_case, state) => {
    expect(listSearchFrom(state)).toBe('')
  })

  it.each([
    ['a number', { listSearch: 2 }],
    ['an object', { listSearch: { sort: 'name-asc' } }],
    ['a string state', '?sort=name-asc'],
  ])('a non-string listSearch (%s) gives the default list', (_case, state) => {
    expect(listSearchFrom(state)).toBe('')
  })

  it.each(['//evil.example', 'sort=name-asc', '/users/other', '#top'])(
    'a string not starting with ? (%s) gives the default list',
    (listSearch) => {
      expect(listSearchFrom({ listSearch })).toBe('')
    },
  )
})
