import 'dotenv/config';
import { Scenes } from 'telegraf';

import { bot } from './core/bot';
import { getConfig } from './core/config';
import { bannedMiddleware } from './core/middleware/banned';
import { errorMiddleware } from './core/middleware/error';
import { loggerMiddleware } from './core/middleware/logger';
import { rbacMiddleware } from './core/middleware/rbac';
import { userTrackerMiddleware } from './core/middleware/user-tracker';
import { createXpOnMessage } from './core/middleware/xp-on-message';
import { logger } from './core/observability';
import { connectRedis, disconnectRedis, redis } from './core/redis';
import { router } from './core/router';
import { sessionMiddleware } from './core/sessions';
import * as adminFeature from './features/admin';
import * as commonFeature from './features/common';
import * as invitationsFeature from './features/invitations';
import { getKickstarterScenes, register as registerKickstarters } from './features/kickstarters';
import { grantXp } from './features/loyalty';
import * as loyaltyFeature from './features/loyalty';
import * as onboardingFeature from './features/onboarding';
import * as paymentsFeature from './features/payments';
import * as pollsFeature from './features/polls';
import * as promoFeature from './features/promo';
import { createRaidStage, register as registerRaids } from './features/raids';
import * as subscriptionsFeature from './features/subscriptions';

async function main(): Promise<void> {
  const cfg = getConfig();
  logger.info({ nodeEnv: cfg.nodeEnv, logLevel: cfg.logLevel }, 'goblin-helper-bot v2 starting');

  if (cfg.useRedisSessions) {
    await connectRedis();
  }

  bot.use(errorMiddleware);
  bot.use(loggerMiddleware);
  bot.use(sessionMiddleware);
  // Banned/tracker/RBAC must run BEFORE the scene stage so:
  // (1) banned users with an active scene can't keep operating inside it,
  // (2) ctx.state.roles is populated when scene handlers fire.
  bot.use(bannedMiddleware);
  bot.use(userTrackerMiddleware);
  bot.use(rbacMiddleware);
  // Per-message XP grant, rate-limited via Redis sliding window. Allowed group
  // ids come from MAIN_GROUP_ID; empty list disables the feature.
  const mainGroupId = process.env.MAIN_GROUP_ID;
  bot.use(
    createXpOnMessage({
      redis,
      grant: async (userId, amount) => {
        await grantXp({ userId, amount, source: 'message_activity' });
      },
      dailyLimit: 7,
      weeklyLimit: 52,
      allowedChatIds: mainGroupId ? [Number(mainGroupId)] : [],
    }),
  );
  const combinedStage = new Scenes.Stage<Scenes.SceneContext>([
    ...Array.from(createRaidStage().scenes.values()),
    ...getKickstarterScenes(),
    ...adminFeature.getAdminScenes(),
    paymentsFeature.sbpScene,
    onboardingFeature.onboardingScene,
  ]);
  bot.use(combinedStage.middleware() as Parameters<typeof bot.use>[0]);
  bot.use(router.middleware());

  commonFeature.register(bot);
  pollsFeature.register(bot);
  promoFeature.register(bot);
  loyaltyFeature.register(bot);
  registerRaids(bot);
  registerKickstarters(bot);
  paymentsFeature.register(bot);
  subscriptionsFeature.register(bot);
  onboardingFeature.register(bot);
  invitationsFeature.register(bot);
  adminFeature.register(bot);

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
