// Visual placeholder only; the loading announcement lives in RepositoryDetailSection's live region.
function RepositoryDetailSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-testid="repository-skeleton"
      className="flex flex-col gap-4 rounded-md border border-hairline bg-canvas-elevated p-6 motion-safe:animate-pulse"
    >
      <div className="h-10 w-2/3 rounded-sm bg-hairline" />
      <div className="h-4 w-full rounded-sm bg-hairline" />
      <div className="h-4 w-1/2 rounded-sm bg-hairline" />
      <div className="h-4 w-1/3 rounded-sm bg-hairline" />
    </div>
  )
}

export default RepositoryDetailSkeleton
