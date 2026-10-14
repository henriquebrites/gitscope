import { useId, useMemo } from 'react'
import type { ReadmeResult } from '../../hooks/useReadme'
import { sanitizeReadme } from '../../utils/sanitizeReadme'
import { RequestErrorBox, RequestErrorContent } from '../feedback/RequestError'

interface RepositoryReadmeProps {
  result: Exclude<ReadmeResult, { status: 'idle' }>
  onRetry: () => void
}

function ReadmeSkeleton() {
  return (
    <div aria-hidden="true" data-testid="readme-skeleton" className="flex flex-col gap-3 motion-safe:animate-pulse">
      <div className="h-8 w-1/2 rounded-sm bg-hairline" />
      <div className="h-4 w-full rounded-sm bg-hairline" />
      <div className="h-4 w-2/3 rounded-sm bg-hairline" />
      <div className="h-16 w-full rounded-sm bg-hairline" />
    </div>
  )
}

/** The README in a section of its own, below the repository; its failure never hides the card. */
function RepositoryReadme({ result, onRetry }: RepositoryReadmeProps) {
  const headingId = useId()
  const html = result.status === 'success' ? result.html : null
  // Nothing from the README reaches the DOM without passing through the sanitizer.
  const safeHtml = useMemo(() => (html === null ? null : sanitizeReadme(html)), [html])

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-4 rounded-lg border border-hairline bg-canvas-elevated p-4 sm:p-8"
    >
      <h2 id={headingId} className="font-mono text-mono-eyebrow text-mute uppercase">
        README
      </h2>
      {/* Always mounted, so screen readers announce the change into loading. */}
      <p aria-live="polite" className="sr-only">
        {result.status === 'loading' ? 'Carregando README…' : ''}
      </p>
      {result.status === 'loading' && <ReadmeSkeleton />}
      {safeHtml !== null && (
        <div data-testid="readme-content" className="readme-content" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      )}
      {result.status === 'absent' && <p className="text-body-md text-mute">Este repositório não tem README.</p>}
      {result.status === 'error' && (
        <RequestErrorBox>
          <RequestErrorContent
            // A missing README is `absent`, never an error; anything else reads as unexpected.
            error={result.error.kind === 'not-found' ? { kind: 'unexpected' } : result.error}
            scale="section"
            unexpectedMessage="Não foi possível carregar o README."
            onRetry={onRetry}
          />
        </RequestErrorBox>
      )}
    </section>
  )
}

export default RepositoryReadme
