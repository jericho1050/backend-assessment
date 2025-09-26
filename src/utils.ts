export const toIso = (d?: string | Date | null): string | null => {
  if (d === null || d === undefined) return null;
  if (d instanceof Date) return d.toISOString();
  if (typeof d === 'string') return new Date(d).toISOString();
  return null;
};
