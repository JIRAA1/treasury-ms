export default function StudentLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Topbar skeleton */}
      <div className="h-[50px] border-b border-border bg-background-secondary flex items-center px-6 gap-4">
        <div className="h-4 w-28 bg-background-muted rounded animate-pulse" />
        <div className="h-3 w-20 bg-background-muted rounded animate-pulse opacity-60" />
      </div>

      {/* Content skeleton */}
      <div className="p-6 space-y-5">
        {/* Hero card */}
        <div className="bg-background-secondary border border-border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-2.5 w-20 bg-background-muted rounded animate-pulse" />
              <div className="h-6 w-24 bg-background-muted rounded animate-pulse" />
              <div className="h-2.5 w-36 bg-background-muted rounded animate-pulse opacity-60" />
            </div>
            <div className="space-y-2 text-right">
              <div className="h-2.5 w-16 bg-background-muted rounded animate-pulse" />
              <div className="h-8 w-20 bg-background-muted rounded animate-pulse" />
              <div className="h-8 w-28 bg-background-muted rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Week grid skeleton */}
        <div className="bg-background-secondary border border-border rounded-xl p-5">
          <div className="h-4 w-36 bg-background-muted rounded animate-pulse mb-4" />
          <div className="grid grid-cols-6 gap-1.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-14 bg-background-muted rounded-md animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
