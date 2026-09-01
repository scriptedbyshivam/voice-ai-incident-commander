export function formatDuration(createdAt: string | Date): string {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - created);

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMins}m`;
  }
  return `${minutes}m`;
}

export function formatReadableTime(timestamp: string | Date): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
