export default function Loading() {
  return (
    <div className="w-full space-y-4 animate-pulse">
      {/* Skeleton Topbar / Header Actions */}
      <div className="flex items-center justify-between mb-8">
        <div className="h-8 w-64 bg-slate-200 rounded-md"></div>
        <div className="flex gap-3">
          <div className="h-9 w-24 bg-slate-200 rounded-md"></div>
          <div className="h-9 w-32 bg-[#13b5ea]/20 rounded-md"></div>
        </div>
      </div>
      
      {/* Skeleton Stats / Widgets (Xero Style) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-white border border-slate-100 shadow-sm rounded-lg p-5 flex flex-col justify-between">
            <div className="h-3 w-24 bg-slate-200 rounded-md"></div>
            <div className="h-8 w-32 bg-slate-300 rounded-md mt-4"></div>
          </div>
        ))}
      </div>

      {/* Skeleton Clean Data Grid (Xero Style) */}
      <div className="bg-white border border-slate-100 shadow-sm rounded-lg overflow-hidden">
        <div className="h-12 bg-slate-50 border-b border-slate-100 flex items-center px-6 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-3 bg-slate-200 rounded-md flex-1"></div>
          ))}
        </div>
        <div className="divide-y divide-slate-50">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 flex items-center px-6 gap-6">
              {[...Array(6)].map((_, j) => (
                <div key={j} className="h-2.5 bg-slate-100 rounded-md flex-1"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
