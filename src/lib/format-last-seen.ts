/**
 * Format last seen timestamp into a human-readable string
 * @param lastSeenAt ISO timestamp string or null
 * @returns Formatted string like "5m ago", "2h ago", "3d ago", or "Not available"
 */
export function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) {
    return "Not available";
  }

  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 60) {
    return "Just now";
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours}h ago`;
  } else if (seconds < 604800) {
    const days = Math.floor(seconds / 86400);
    return `${days}d ago`;
  } else if (seconds < 2592000) {
    const weeks = Math.floor(seconds / 604800);
    return `${weeks}w ago`;
  } else if (seconds < 31536000) {
    const months = Math.floor(seconds / 2592000);
    return `${months}mo ago`;
  } else {
    const years = Math.floor(seconds / 31536000);
    return `${years}y ago`;
  }
}
