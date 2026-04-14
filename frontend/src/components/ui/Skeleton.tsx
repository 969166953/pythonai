interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`rounded-[var(--radius-md)] bg-surface-secondary animate-shimmer ${className}`}
    />
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex-1 px-6 py-6">
      <div className="max-w-[720px] mx-auto space-y-6">
        {/* User message */}
        <div className="flex justify-end">
          <Skeleton className="h-10 w-[260px] rounded-[var(--radius-lg)]" />
        </div>
        {/* Assistant message */}
        <div className="flex justify-start">
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-[420px]" />
            <Skeleton className="h-4 w-[360px]" />
            <Skeleton className="h-4 w-[280px]" />
          </div>
        </div>
        {/* User message */}
        <div className="flex justify-end">
          <Skeleton className="h-10 w-[200px] rounded-[var(--radius-lg)]" />
        </div>
        {/* Assistant message */}
        <div className="flex justify-start">
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-[380px]" />
            <Skeleton className="h-4 w-[440px]" />
            <Skeleton className="h-4 w-[320px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DocumentSkeleton() {
  return (
    <div className="space-y-4">
      {/* Upload zone skeleton */}
      <Skeleton className="h-[120px] w-full rounded-[var(--radius-lg)]" />
      {/* Document items */}
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-surface-elevated border border-border-light"
          >
            <Skeleton className="w-[18px] h-[18px] rounded shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-[180px]" />
              <Skeleton className="h-2.5 w-[80px]" />
            </div>
            <Skeleton className="w-[14px] h-[14px] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="px-2 py-1 space-y-1">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
          <Skeleton className="w-4 h-4 rounded shrink-0" />
          <Skeleton className="h-3.5 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function KBHeaderSkeleton() {
  return (
    <div className="glass sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-6 w-[160px]" />
        <Skeleton className="h-3.5 w-[80px]" />
      </div>
      <Skeleton className="h-8 w-[160px] rounded-[var(--radius-md)]" />
    </div>
  );
}
