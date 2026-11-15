export function parseJsonRecord<T>(value: unknown): T | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  const raw =
    typeof value === 'string'
      ? value
      : typeof value === 'object'
        ? JSON.stringify(value)
        : null;
  if (raw === null) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object') {
      return null;
    }
    return parsed as T;
  } catch {
    if (typeof value === 'object' && value !== null) {
      return value as T;
    }
    return null;
  }
}