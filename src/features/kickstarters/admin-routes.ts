import type { Scenes, Telegraf } from 'telegraf';

import { requireAdmin } from '../../core/permissions';

import { KS_ADD_CHAIN } from './scenes/add-chain';

export function registerKickstarterAdminCommands(bot: Telegraf): void {
  bot.command('ks_add', requireAdmin(), async (ctx) => {
    await (ctx as unknown as Scenes.SceneContext).scene.enter(KS_ADD_CHAIN.steps[0]!, {});
  });
}
