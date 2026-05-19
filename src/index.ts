import 'dotenv/config';

import { bot } from './core/bot';
import { getConfig } from './core/config';
import { bannedMiddleware } from './core/middleware/banned';
import { errorMiddleware } from './core/middleware/error';
import { loggerMiddleware } from './core/middleware/logger';
import { rbacMiddleware } from './core/middleware/rbac';
import { userTrackerMiddleware } from './core/middleware/user-tracker';
import { logger } from './core/observability';
import { connectRedis, disconnectRedis } from './core/redis';
import { sessionMiddleware } from './core/sessions';

async function main(): Promise<void> {
  const cfg = getConfig();
  logger.info({ nodeEnv: cfg.nodeEnv, logLevel: cfg.logLevel }, 'goblin-helper-bot v2 starting');

  if (cfg.useRedisSessions) {
    await connectRedis();
  }

  bot.use(errorMiddleware);
  bot.use(loggerMiddleware);
  bot.use(sessionMiddleware);
  bot.use(bannedMiddleware);
  bot.use(userTrackerMiddleware);
  bot.use(rbacMiddleware);

  // Features are registered here in Plans 04+. For now, no commands or actions.

  await bot.launch({ dropPendingUpdates: true });
  logger.info({ username: bot.botInfo?.username }, 'Bot online');

  const stop = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info({ signal }, 'Stopping bot');
    bot.stop(signal);
    await disconnectRedis();
    process.exit(0);
  };
  process.once('SIGINT', () => void stop('SIGINT'));
  process.once('SIGTERM', () => void stop('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to launch bot');
  process.exit(1);
});
