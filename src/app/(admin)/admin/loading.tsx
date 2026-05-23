export default function AdminLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Topbar skeleton */}
      <div className="h-[50px] border-b border-border bg-background-secondary flex items-center px-6 gap-4">
        <div className="h-4 w-32 bg-background-muted rounded animate-pulse" />
        <div className="h-3 w-24 bg-background-muted rounded animate-pulse opacity-60" />
      </div>

      {/* Content skeleton */}
      <div className="p-6 space-y-6 flex-1">
        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-background-secondary border border-border rounded-xl p-5 space-y-3">
              <div className="h-2.5 w-16 bg-background-muted rounded animate-pulse" />
              <div className="h-7 w-28 bg-background-muted rounded animate-pulse" />
              <div className="h-2 w-20 bg-background-muted rounded animate-pulse opacity-60" />
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="bg-background-secondary border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="h-4 w-32 bg-background-muted rounded animate-pulse" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-7 h-7 rounded-full bg-background-muted animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 bg-background-muted rounded animate-pulse" />
                  <div className="h-2.5 w-20 bg-background-muted rounded animate-pulse opacity-60" />
                </div>
                <div className="h-3 w-16 bg-background-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
