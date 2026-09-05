export function computeMidpointOrderIndex(before: number | null, after: number | null): number | null {
  if (before === null && after === null) return 1024
  if (before === null) return Math.floor(after! / 2)
  if (after === null) return before + 1024
  return after - before > 1 ? before + Math.floor((after - before) / 2) : null
}
