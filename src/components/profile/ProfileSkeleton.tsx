// Visual placeholder only; the loading announcement lives in ProfileSection's live region.
// Same composition as ProfileCard (cover, avatar, three tiles), so nothing jumps on arrival.
function ProfileSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-testid="profile-skeleton"
      className="overflow-hidden rounded-lg border border-hairline bg-canvas-elevated motion-safe:animate-pulse"
    >
      <div data-testid="skeleton-cover" className="h-24 bg-hairline" />
      <div className="flex flex-col gap-4 px-3 pb-6 sm:px-6">
        <div
          data-testid="skeleton-avatar"
          className="-mt-10 size-24 shrink-0 rounded-full border-4 border-canvas-elevated bg-hairline"
        />
        <div className="h-10 w-1/2 rounded-sm bg-hairline" />
        <div className="h-4 w-2/3 rounded-sm bg-hairline" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((tile) => (
            <div key={tile} data-testid="skeleton-tile" className="h-16 rounded-md bg-hairline" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default ProfileSkeleton
