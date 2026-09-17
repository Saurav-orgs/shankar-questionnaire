export function Done({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">
        🙏
      </div>
      <h1 className="text-xl font-semibold text-slate-900">{heading}</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">{body}</p>
    </div>
  )
}
