import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { LocaleKey } from './i18n-keys.generated';
import { logger } from './observability';

function flatten(node: unknown, prefix: string, out: Record<string, string>): void {
  if (typeof node === 'string') {
    out[prefix] = node;
    return;
  }
  if (typeof node === 'object' && node !== null) {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
}

const strings: Record<string, string> = (() => {
  const localePath = path.join(process.cwd(), 'locales', 'ru.json');
  const raw = readFileSync(localePath, 'utf-8');
  const tree = JSON.parse(raw) as unknown;
  const flat: Record<string, string> = {};
  flatten(tree, '', flat);
  return flat;
})();

function interpolate(
  template: string,
  params: Record<string, string | number> | undefined,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, key: string) => {
    const v = params[key];
    return v === undefined ? m : String(v);
  });
}

export function t(key: LocaleKey, params?: Record<string, string | number>): string {
  const value = strings[key];
  if (value === undefined) {
    logger.warn({ key }, 'Missing locale key');
    return key;
  }
  return interpolate(value, params);
}
