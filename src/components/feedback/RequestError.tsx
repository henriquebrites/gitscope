import type { ReactNode } from 'react'
import type { GitHubError } from '../../services/githubApi'
import { formatTime } from '../../utils/formatters'

/** `page` fills the main area (h1); `section` sits under a page heading (h3). */
export type ErrorScale = 'page' | 'section'

const headingClass = { page: 'text-heading-lg text-ink', section: 'text-heading-md text-ink' }
const textClass = { page: 'text-body-lg text-body', section: 'text-body-md text-body' }

function Heading({ scale, children }: { scale: ErrorScale; children: ReactNode }) {
  const Tag = scale === 'page' ? 'h1' : 'h3'
  return <Tag className={headingClass[scale]}>{children}</Tag>
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="h-10 self-start rounded-sm bg-primary px-4 text-button-md text-on-primary"
    >
      Tentar novamente
    </button>
  )
}

interface RequestErrorContentProps {
  error: Exclude<GitHubError, { kind: 'not-found' }>
  scale: ErrorScale
  /** What could not be loaded, for the `unexpected` message. */
  unexpectedMessage: string
  onRetry: () => void
}

/** The failures every screen words the same way; `not-found` stays with each screen. */
export function RequestErrorContent({ error, scale, unexpectedMessage, onRetry }: RequestErrorContentProps) {
  switch (error.kind) {
    case 'network':
      return (
        <>
          <Heading scale={scale}>Sem conexão</Heading>
          <p className={textClass[scale]}>Não foi possível conectar ao GitHub.</p>
          <RetryButton onRetry={onRetry} />
        </>
      )
    case 'rate-limited':
      return (
        <>
          <Heading scale={scale}>Limite de consultas atingido</Heading>
          <p className={textClass[scale]}>
            O GitHub limitou temporariamente as consultas feitas a partir desta rede.
          </p>
          <p className={textClass[scale]}>
            {error.resetAt
              ? `As consultas voltam a ser liberadas às ${formatTime(error.resetAt)}.`
              : 'Tente de novo mais tarde.'}
          </p>
        </>
      )
    case 'unexpected':
      return (
        <>
          <Heading scale={scale}>Algo deu errado</Heading>
          <p className={textClass[scale]}>{unexpectedMessage}</p>
          <RetryButton onRetry={onRetry} />
        </>
      )
  }
}

export function RequestErrorBox({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-md border border-hairline bg-canvas-elevated p-6"
    >
      {children}
    </div>
  )
}
