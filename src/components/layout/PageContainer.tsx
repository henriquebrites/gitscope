import type { ReactNode } from 'react'

function PageContainer({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      {children}
    </main>
  )
}

export default PageContainer
