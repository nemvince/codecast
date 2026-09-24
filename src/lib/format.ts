export const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${Math.round(ms)} ms`
  }

  return `${(ms / 1000).toFixed(1)} s`
}

export const formatClock = (iso: string): string => new Date(iso).toLocaleTimeString()

export const formatExpiry = (iso: string, now: number): string => {
  const remaining = Date.parse(iso) - now
  if (remaining <= 0) {
    return 'expired'
  }

  const totalMinutes = Math.ceil(remaining / 60_000)

  return `in ${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} m`
}
