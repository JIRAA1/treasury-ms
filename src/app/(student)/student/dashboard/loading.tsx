import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="animate-in fade-in duration-500">
      {/* Topbar Skeleton */}
      <div className="h-[60px] border-b bg-background-secondary flex items-center justify-between px-6">
        <div className="space-y-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      <div className="p-6 space-y-6">
        {/* Hero Status Card Skeleton */}
        <div className="bg-background-secondary border border-border rounded-xl p-5">
          <div className="flex items-center gap-6">
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="w-px h-16 bg-border" />
            <div className="text-right space-y-2">
              <Skeleton className="h-3 w-12 ml-auto" />
              <Skeleton className="h-8 w-20 ml-auto" />
              <Skeleton className="h-8 w-24 ml-auto rounded-lg" />
            </div>
          </div>
        </div>

        {/* KPI Row Skeleton */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-background-secondary border border-border rounded-xl p-5 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="bg-background-secondary border border-border rounded-xl p-5 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="bg-background-secondary border border-border rounded-xl p-5 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* Week Grid Skeleton */}
        <div className="bg-background-secondary border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>

        {/* Bottom Grid Skeleton */}
        <div className="grid grid-cols-2 gap-4">
          {/* History Skeleton */}
          <div className="bg-background-secondary border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0 border-border/50">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-2 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>

          {/* Expenses Skeleton */}
          <div className="bg-background-secondary border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0 border-border/50">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-2 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
