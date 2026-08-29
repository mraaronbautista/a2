export type AgendaItemKind = 'event' | 'task' | 'reading'

export interface AgendaItem {
  key: string
  kind: AgendaItemKind
  eventId: string
  title: string
  start: Date
  end: Date
  color: string
  ownerId: string
  courseName: string | null
  /** Only for kind 'task' | 'reading' — calendar events aren't checkable. */
  completed?: boolean
  onToggle?: () => void
}
