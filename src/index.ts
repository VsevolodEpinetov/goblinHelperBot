import 'dotenv/config';

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('goblin-helper-bot v2 — skeleton boot. Features and bot launch arrive in Plan 03.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal boot error:', err);
  process.exit(1);
});
