/**
 * Generic shimmering page skeleton used by every route's loading.tsx.
 * Gives instant visual feedback when a user clicks a nav tab, even before
 * the target page has finished rendering on the server.
 */

export function PageSkeleton({ rows = 6, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div className="space-y-6 animate-fade-in">
      {title && (
        <div className="space-y-2">
          <div className="h-7 w-64 rounded bg-muted animate-pulse" />
          <div className="h-4 w-80 rounded bg-muted/60 animate-pulse" />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ms-card p-4 space-y-3">
            <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            <div className="h-7 w-24 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
      <div className="ms-card p-6 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 w-full rounded bg-muted/60 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded bg-muted animate-pulse" />
          <div className="h-4 w-64 rounded bg-muted/60 animate-pulse" />
        </div>
        <div className="h-10 w-32 rounded bg-muted animate-pulse" />
      </div>
      <div className="ms-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="h-10 w-80 rounded bg-muted/60 animate-pulse" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <div className="h-4 w-24 rounded bg-muted/60 animate-pulse" />
              <div className="h-4 flex-1 rounded bg-muted/50 animate-pulse" />
              <div className="h-4 w-20 rounded bg-muted/60 animate-pulse" />
              <div className="h-4 w-16 rounded bg-muted/60 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-muted animate-pulse" />
        <div className="h-4 w-80 rounded bg-muted/60 animate-pulse" />
      </div>
      <div className="ms-card p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
            <div className="h-10 w-full rounded bg-muted/60 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
