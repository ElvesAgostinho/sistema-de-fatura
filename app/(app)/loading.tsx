export default function Loading() {
  return (
    <div className="w-full space-y-4 animate-pulse">
      {/* Skeleton Topbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-48 bg-slate-200 rounded-sm"></div>
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-slate-200 rounded-sm"></div>
          <div className="h-8 w-32 bg-[#0078D4]/20 rounded-sm"></div>
        </div>
      </div>
      
      {/* Skeleton Stats / Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-white border border-slate-200 rounded-sm p-4 flex flex-col justify-between">
            <div className="h-3 w-20 bg-slate-200 rounded-sm"></div>
            <div className="h-6 w-32 bg-slate-300 rounded-sm"></div>
          </div>
        ))}
      </div>

      {/* Skeleton Data Grid */}
      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="h-10 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-3 bg-slate-200 rounded-sm flex-1"></div>
          ))}
        </div>
        <div className="divide-y divide-slate-100">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 flex items-center px-4 gap-4">
              {[...Array(6)].map((_, j) => (
                <div key={j} className="h-2.5 bg-slate-100 rounded-sm flex-1"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
