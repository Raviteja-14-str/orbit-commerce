// Synthetic demo code for Nexus Intelligence. Not a real system.

export function searchTitles(titles: string[], query: string): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }
  return titles.filter((title) => title.toLowerCase().includes(needle));
}
