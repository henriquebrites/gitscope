/**
 * Query string (`?sort=…&page=…`) of the list the user came from, as the list item put it in
 * the history state. The state is untrusted, so anything that is not a query gives `''`,
 * which is the list's default order and first page.
 */
export function listSearchFrom(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('listSearch' in state)) return ''
  const { listSearch } = state
  return typeof listSearch === 'string' && listSearch.startsWith('?') ? listSearch : ''
}
