const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]
export const MAX_PDF_BYTES = 52_428_800

export async function isPdfFile(file: File): Promise<boolean> {
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return false
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  return PDF_MAGIC.every((byte, index) => head[index] === byte)
}

export function sanitizePdfFilename(name: string): string {
  const base = Array.from(name.replace(/\.pdf$/i, ''))
    .map((character) => character === '/' || character === '\\' || character.charCodeAt(0) < 32 ? '-' : character)
    .join('').replace(/\s+/g, '-').trim()
  return `${base || 'reading'}.pdf`
}
