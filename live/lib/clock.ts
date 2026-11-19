// Synthetic demo code for Nexus Intelligence. Not a real system.

/** UTC stamps. Log lines use the evidence time-of-day form; `iso` is for since filters. */
export function clockParts(date = new Date()): { iso: string; lineTime: string; lineTimeSeconds: string } {
  const iso = date.toISOString();
  return {
    iso,
    lineTime: `${iso.slice(11, 23)}Z`,
    lineTimeSeconds: `${iso.slice(11, 19)}Z`,
  };
}
