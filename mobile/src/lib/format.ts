export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function shortHash(hash: string | null): string {
  return hash ? `#${hash.slice(0, 10)}…` : '—';
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}
