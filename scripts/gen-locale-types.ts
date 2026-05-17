import { promises as fs } from 'node:fs';
import path from 'node:path';

const LOCALE_PATH = path.join(process.cwd(), 'locales', 'ru.json');
const OUTPUT_PATH = path.join(process.cwd(), 'src', 'core', 'i18n-keys.generated.ts');

function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [];
  const result: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result.push(full);
    } else if (typeof value === 'object' && value !== null) {
      result.push(...flattenKeys(value, full));
    }
  }
  return result;
}

async function main(): Promise<void> {
  const raw = await fs.readFile(LOCALE_PATH, 'utf-8');
  const data = JSON.parse(raw) as unknown;
  const keys = flattenKeys(data).sort();

  const body = [
    '// THIS FILE IS GENERATED. Do not edit by hand.',
    '// Regenerate with: npm run gen:locale-types',
    '',
    'export type LocaleKey =',
    ...keys.map((k, i) => `  | '${k}'${i === keys.length - 1 ? ';' : ''}`),
    '',
    `export const LOCALE_KEYS: readonly LocaleKey[] = [`,
    ...keys.map((k) => `  '${k}',`),
    '] as const;',
    '',
  ].join('\n');

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, body, 'utf-8');

  // eslint-disable-next-line no-console
  console.log(`Wrote ${keys.length} locale keys to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
