export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-9 w-64 rounded bg-slate-200 animate-pulse" />
      <div className="h-11 rounded-lg bg-slate-200 animate-pulse" />
      <div className="rounded-lg border border-slate-200 bg-white p-8">
        <div className="space-y-4">
          <div className="h-5 w-1/3 rounded bg-slate-200 animate-pulse" />
          <div className="h-5 w-2/3 rounded bg-slate-200 animate-pulse" />
          <div className="h-5 w-1/2 rounded bg-slate-200 animate-pulse" />
        </div>
      </div>
    </div>
  )
}
