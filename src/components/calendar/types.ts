export interface EventOccurrence {
  key: string
  eventId: string
  title: string
  start: Date
  end: Date
  color: string
  ownerId: string
  courseName: string | null
}
