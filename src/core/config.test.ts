import { describe, expect, it } from 'vitest';

import { loadConfig } from './config';

describe('config', () => {
  it('loads valid env vars into a typed config object', () => {
    const cfg = loadConfig({
      TOKEN: 't',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_NAME: 'goblin_bot',
      DB_USER: 'goblin',
      DB_PASSWORD: 's',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      LOG_LEVEL: 'info',
    });
    expect(cfg.botToken).toBe('t');
    expect(cfg.dbPort).toBe(5432);
    expect(cfg.redisPort).toBe(6379);
    expect(cfg.logLevel).toBe('info');
  });

  it('throws when TOKEN is missing', () => {
    expect(() => loadConfig({})).toThrow(/TOKEN/);
  });

  it('defaults LOG_LEVEL to info', () => {
    const cfg = loadConfig({ TOKEN: 't' });
    expect(cfg.logLevel).toBe('info');
  });

  it('accepts optional SENTRY_DSN', () => {
    const cfg = loadConfig({ TOKEN: 't', SENTRY_DSN: 'https://x@sentry.io/1' });
    expect(cfg.sentryDsn).toBe('https://x@sentry.io/1');
  });

  it('omits sentryDsn when not set', () => {
    const cfg = loadConfig({ TOKEN: 't' });
    expect(cfg.sentryDsn).toBeUndefined();
  });

  it('parses USE_REDIS_SESSIONS as a boolean (default true)', () => {
    expect(loadConfig({ TOKEN: 't' }).useRedisSessions).toBe(true);
    expect(loadConfig({ TOKEN: 't', USE_REDIS_SESSIONS: 'false' }).useRedisSessions).toBe(false);
    expect(loadConfig({ TOKEN: 't', USE_REDIS_SESSIONS: 'true' }).useRedisSessions).toBe(true);
  });

  describe('DB_* / PG* libpq fallback', () => {
    it('falls back to PG* vars when DB_* are absent', () => {
      const cfg = loadConfig({
        TOKEN: 't',
        PGHOST: 'db.example.com',
        PGPORT: '6543',
        PGDATABASE: 'goblin_prod',
        PGUSER: 'glav',
        PGPASSWORD: 'secret',
      });
      expect(cfg.dbHost).toBe('db.example.com');
      expect(cfg.dbPort).toBe(6543);
      expect(cfg.dbName).toBe('goblin_prod');
      expect(cfg.dbUser).toBe('glav');
      expect(cfg.dbPassword).toBe('secret');
    });

    it('prefers DB_* over PG* when both are set', () => {
      const cfg = loadConfig({
        TOKEN: 't',
        DB_HOST: 'primary',
        PGHOST: 'fallback',
        DB_NAME: 'db_name',
        PGDATABASE: 'pg_name',
      });
      expect(cfg.dbHost).toBe('primary');
      expect(cfg.dbName).toBe('db_name');
    });

    it('falls back to built-in defaults when neither DB_* nor PG* are set', () => {
      const cfg = loadConfig({ TOKEN: 't' });
      expect(cfg.dbHost).toBe('localhost');
      expect(cfg.dbName).toBe('goblin_bot');
      expect(cfg.dbPort).toBe(5432);
    });
  });
});
