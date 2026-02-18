export function sanitizePayeeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizePayee(value: string): string {
  return sanitizePayeeName(value).toLowerCase();
}
