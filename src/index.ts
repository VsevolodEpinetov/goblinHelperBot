import 'dotenv/config';
import { Scenes } from 'telegraf';

import { bot } from './core/bot';
import { assertProductionConfig, featureConfig, featureReport, getConfig } from './core/config';
import { reportConfigHealthOnBoot } from './core/health';
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
import { db } from './db/client';
import * as adminFeature from './features/admin';
import * as commonFeature from './features/common';
import * as invitationsFeature from './features/invitations';
import { getKickstarterScenes, register as registerKickstarters } from './features/kickstarters';
import { dispatchNotifications, grantXp } from './features/loyalty';
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

  // Parse + validate the feature env once at boot: a malformed chat/topic id
  // throws here, and production refuses to start without the group/admin chat —
  // a bot that silently posts nothing anywhere is worse than a crashed deploy.
  const fc = featureConfig();
  assertProductionConfig(fc, cfg.nodeEnv);
  for (const line of featureReport(fc)) logger.info(`feature: ${line}`);

  // Allowed group ids for the per-message XP grant come from MAIN_GROUP_ID;
  // empty list disables the feature.
  const mainGroupId = fc.mainGroupId;

  // node-redis v4 does not connect lazily — connect up front for every consumer
  // (sessions and/or the XP rate limiter).
  if (cfg.useRedisSessions || mainGroupId) {
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
  // Per-message XP grant, rate-limited via Redis sliding window.
  bot.use(
    createXpOnMessage({
      redis,
      grant: async (userId, amount) => {
        const result = await grantXp({ userId, amount, source: 'message_activity' });
        // 1-XP gains stay below the notify threshold; this only surfaces
        // level-ups, which used to pass silently for chat activity.
        dispatchNotifications(userId, result, 'message_activity');
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

  const stop = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info({ signal }, 'Stopping bot');
    try {
      bot.stop(signal);
    } catch {
      /* not launched yet */
    }
    await disconnectRedis().catch(() => undefined);
    await db.destroy().catch(() => undefined);
    process.exit(0);
  };
  // launch() only resolves once polling stops, so signal handlers must be
  // registered BEFORE it and the online log goes through the onLaunch callback.
  process.once('SIGINT', () => void stop('SIGINT'));
  process.once('SIGTERM', () => void stop('SIGTERM'));

  await bot.launch(() => {
    logger.info({ username: bot.botInfo?.username }, 'Bot online');
    // Active probe AFTER launch (needs the API + botInfo): verifies the
    // configured chats/topics actually exist and the bot is admin where it
    // must be, alerting the admin chat on failures.
    const botId = bot.botInfo?.id;
    if (botId) {
      void reportConfigHealthOnBoot(bot.telegram, fc, botId).catch((err) =>
        logger.error({ err }, 'boot config health report failed'),
      );
    }
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to launch bot');
  process.exit(1);
});
