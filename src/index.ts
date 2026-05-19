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
import { router } from './core/router';
import { sessionMiddleware } from './core/sessions';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as _achievementsFeature from './features/achievements';
import * as commonFeature from './features/common';
import * as loyaltyFeature from './features/loyalty';
import * as pollsFeature from './features/polls';
import * as promoFeature from './features/promo';
import { createRaidStage, register as registerRaids } from './features/raids';
// scrolls and achievements expose services only; no routes to register here
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as _scrollsFeature from './features/scrolls';

async function main(): Promise<void> {
  const cfg = getConfig();
  logger.info({ nodeEnv: cfg.nodeEnv, logLevel: cfg.logLevel }, 'goblin-helper-bot v2 starting');

  if (cfg.useRedisSessions) {
    await connectRedis();
  }

  bot.use(errorMiddleware);
  bot.use(loggerMiddleware);
  bot.use(sessionMiddleware);
  const raidStage = createRaidStage();
  bot.use(raidStage.middleware() as Parameters<typeof bot.use>[0]);
  bot.use(bannedMiddleware);
  bot.use(userTrackerMiddleware);
  bot.use(rbacMiddleware);
  bot.use(router.middleware());

  commonFeature.register(bot);
  pollsFeature.register(bot);
  promoFeature.register(bot);
  loyaltyFeature.register(bot);
  registerRaids(bot);

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
