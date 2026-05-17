export function snakeKey(camel: string): string {
  return camel.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

export function camelKey(snake: string): string {
  return snake.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function fromDbRow<T extends Record<string, unknown>>(
  row: T | null | undefined,
): Record<string, unknown> | T | null | undefined {
  if (row === null || row === undefined) return row;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[camelKey(key)] = value;
  }
  return out;
}

export function toDbRow<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    out[snakeKey(key)] = value;
  }
  return out;
}
