export function LibrarySearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="sr-only">Search library</span><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search notes, notebooks, sections, and courses…" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent" /></label>
}
