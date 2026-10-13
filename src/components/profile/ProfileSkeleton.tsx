// Visual placeholder only; the loading announcement lives in ProfileSection's live region.
function ProfileSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-testid="profile-skeleton"
      className="flex flex-col gap-6 rounded-md border border-hairline bg-canvas-elevated p-6 sm:flex-row sm:items-start motion-safe:animate-pulse"
    >
      <div className="size-24 shrink-0 rounded-full bg-hairline" />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="h-10 w-1/2 rounded-sm bg-hairline" />
        <div className="h-4 w-1/3 rounded-sm bg-hairline" />
        <div className="h-4 w-full rounded-sm bg-hairline" />
        <div className="h-4 w-2/3 rounded-sm bg-hairline" />
      </div>
    </div>
  )
}

export default ProfileSkeleton
