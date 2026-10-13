const countFormat = new Intl.NumberFormat('pt-BR')
const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** `12345` -> `12.345`. */
export function formatCount(value: number): string {
  return countFormat.format(value)
}

/** Local time as `HH:mm`. */
export function formatTime(date: Date): string {
  return timeFormat.format(date)
}
