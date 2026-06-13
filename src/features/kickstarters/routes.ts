import type { Telegraf } from 'telegraf';

import { requireApprovedMember } from '../../core/permissions';

import { renderKsCatalog, renderMyKickstarters } from './actions';

export function registerKickstarterCommands(bot: Telegraf): void {
  bot.command('kickstarters', requireApprovedMember(), (ctx) => renderKsCatalog(ctx));
  bot.command('mykickstarters', requireApprovedMember(), (ctx) => renderMyKickstarters(ctx));
}
