function Shimmer({ className }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className ?? ''}`} aria-hidden="true" />
}

export default function DashboardLoading() {
  return (
    <div className="animate-in fade-in duration-500">
      {/* Topbar Skeleton */}
      <div className="h-[64px] border-b bg-background-secondary flex items-center justify-between px-6 sticky top-0">
        <div className="space-y-1.5">
          <Shimmer className="h-5 w-40" />
          <Shimmer className="h-3 w-24" />
        </div>
        <Shimmer className="h-8 w-8 rounded-xl" />
      </div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Hero Card Skeleton */}
        <div className="relative overflow-hidden rounded-[2rem] bg-brand/90 shadow-2xl">
          <div className="p-6 md:p-10 space-y-5">
            {/* Badges row */}
            <div className="flex items-center gap-2">
              <Shimmer className="h-5 w-20 rounded-lg opacity-30" />
              <Shimmer className="h-5 w-28 rounded-lg opacity-30" />
            </div>
            {/* Period title + amount */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-2">
                <Shimmer className="h-8 w-48 opacity-30" />
                <Shimmer className="h-4 w-36 opacity-20" />
              </div>
              <div className="flex flex-col items-end gap-3">
                <Shimmer className="h-12 w-32 opacity-30" />
                <Shimmer className="h-7 w-24 rounded-full opacity-30" />
                <div className="flex gap-2">
                  <Shimmer className="h-9 w-16 rounded-xl opacity-20" />
                  <Shimmer className="h-9 w-28 rounded-xl opacity-40" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Row Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-background-secondary border border-border rounded-xl p-5 space-y-2.5">
              <Shimmer className="h-3 w-16" />
              <Shimmer className="h-7 w-20" />
              <Shimmer className="h-3 w-24" />
            </div>
          ))}
        </div>

        {/* Period Grid Skeleton */}
        <div className="bg-background-secondary border border-border rounded-[2rem] p-6 md:p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1.5">
              <Shimmer className="h-4 w-36" />
              <Shimmer className="h-3 w-28" />
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <Shimmer key={i} className="h-5 w-14 rounded-full" />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Shimmer key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>

        {/* Bottom Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {/* History Skeleton */}
          <div className="bg-background-secondary border border-border rounded-[2rem] p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <Shimmer className="h-4 w-24" />
              <Shimmer className="h-3 w-16" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b last:border-0 border-border/40">
                  <div className="flex items-center gap-3">
                    <Shimmer className="w-8 h-8 rounded-full flex-shrink-0" />
                    <div className="space-y-1.5">
                      <Shimmer className="h-3 w-24" />
                      <Shimmer className="h-2.5 w-16" />
                    </div>
                  </div>
                  <Shimmer className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Expenses Skeleton */}
          <div className="bg-background-secondary border border-border rounded-[2rem] p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <Shimmer className="h-4 w-28" />
              <Shimmer className="h-3 w-16" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b last:border-0 border-border/40">
                  <div className="flex items-center gap-3">
                    <Shimmer className="w-8 h-8 rounded-lg flex-shrink-0" />
                    <div className="space-y-1.5">
                      <Shimmer className="h-3 w-32" />
                      <Shimmer className="h-2.5 w-20" />
                    </div>
                  </div>
                  <Shimmer className="h-3 w-14" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
