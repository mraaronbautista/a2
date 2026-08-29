export function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-navy">{title}</h1>
      <p className="mt-2 text-sm text-ink-muted">Coming soon.</p>
    </div>
  )
}
