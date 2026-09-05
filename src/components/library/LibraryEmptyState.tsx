export function LibraryEmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center"><p className="text-sm font-semibold text-ink">{title}</p><p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{body}</p>{action && <div className="mt-4">{action}</div>}</div>
}
