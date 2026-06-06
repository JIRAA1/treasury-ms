function Shimmer({ className }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className ?? ''}`} aria-hidden="true" />
}

export default function UploadPageLoading() {
  return (
    <div className="animate-in fade-in duration-500">
      {/* Topbar Skeleton */}
      <div className="h-[64px] border-b bg-background-secondary flex items-center justify-between px-6 sticky top-0">
        <div className="space-y-1.5">
          <Shimmer className="h-5 w-36" />
          <Shimmer className="h-3 w-48" />
        </div>
        <Shimmer className="h-8 w-8 rounded-xl" />
      </div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="p-4 md:p-6 max-w-xl space-y-5">
        {/* Step Indicator Skeleton */}
        <div className="flex items-center gap-3">
          {/* Step 1 */}
          <div className="flex items-center gap-2">
            <Shimmer className="w-6 h-6 rounded-full" />
            <Shimmer className="h-3 w-20" />
          </div>
          {/* Connector */}
          <Shimmer className="flex-1 h-px" />
          {/* Step 2 */}
          <div className="flex items-center gap-2">
            <Shimmer className="w-6 h-6 rounded-full" />
            <Shimmer className="h-3 w-16" />
          </div>
        </div>

        {/* Period selector skeleton */}
        <div className="bg-background-secondary border border-border rounded-xl p-5 space-y-4">
          <div className="space-y-1">
            <Shimmer className="h-4 w-48" />
            <Shimmer className="h-3 w-32" />
          </div>
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border rounded-xl p-4 flex items-center gap-3">
                <Shimmer className="w-9 h-9 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Shimmer className="h-4 w-32" />
                    <Shimmer className="h-5 w-16 rounded-full" />
                  </div>
                  <Shimmer className="h-3 w-48" />
                  <Shimmer className="h-3 w-24" />
                </div>
                <Shimmer className="h-4 w-4 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* QR + Upload skeleton (step 2 preview) */}
        <div className="bg-background-secondary border border-border rounded-xl p-5 space-y-4 opacity-50">
          <div className="pb-4 border-b border-border space-y-1">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-5 w-36" />
          </div>
          {/* QR Code placeholder */}
          <div className="flex flex-col items-center gap-3 p-4 bg-background-tertiary rounded-xl">
            <Shimmer className="h-3 w-16" />
            <Shimmer className="w-40 h-40 rounded-xl" />
            <Shimmer className="h-3 w-40" />
          </div>
          {/* Upload area placeholder */}
          <Shimmer className="h-28 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

