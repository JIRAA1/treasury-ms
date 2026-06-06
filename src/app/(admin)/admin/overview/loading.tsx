function Shimmer({ className }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className ?? ''}`} aria-hidden="true" />
}

export default function AdminOverviewLoading() {
  return (
    <div className="animate-in fade-in duration-500">
      {/* Topbar Skeleton */}
      <div className="h-[64px] bg-background-secondary/90 border-b flex items-center justify-between px-8 sticky top-0">
        <div className="space-y-1.5">
          <Shimmer className="h-5 w-28" />
          <Shimmer className="h-3 w-40" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-8 w-28 rounded-lg" />
          <Shimmer className="h-8 w-28 rounded-lg" />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-background-secondary border border-border rounded-2xl p-5 space-y-3 overflow-hidden">
              <Shimmer className="h-[3px] w-full rounded-none -mx-5 -mt-5 mb-0" />
              <Shimmer className="h-3 w-20" />
              <Shimmer className="h-8 w-28" />
              <Shimmer className="h-3 w-24" />
            </div>
          ))}
        </div>

        {/* Tier / Credit / Reserve Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-background-secondary border border-border rounded-xl p-5 space-y-3">
              <Shimmer className="h-3 w-32" />
              <Shimmer className="h-8 w-24" />
              <Shimmer className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Middle grid */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '3fr 2fr' }}>
          <div className="bg-background-secondary border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex justify-between">
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-3 w-16" />
            </div>
            <div className="divide-y divide-border">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3">
                  <Shimmer className="w-7 h-7 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Shimmer className="h-3 w-32" />
                    <Shimmer className="h-2.5 w-24" />
                  </div>
                  <Shimmer className="h-4 w-16" />
                  <Shimmer className="h-7 w-16 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-background-secondary border border-border rounded-xl p-5 space-y-3">
                <Shimmer className="h-3.5 w-28" />
                <Shimmer className="h-16 w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-background-secondary border border-border rounded-xl p-4 flex items-center gap-3">
              <Shimmer className="w-9 h-9 rounded-lg flex-shrink-0" />
              <div className="space-y-1.5">
                <Shimmer className="h-3.5 w-20" />
                <Shimmer className="h-2.5 w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

