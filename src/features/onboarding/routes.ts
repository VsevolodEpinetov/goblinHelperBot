import type { Scenes, Telegraf } from 'telegraf';

import { router } from '../../core/router';
import { db } from '../../db/client';
import { getRolesForUser } from '../../db/repos/user-roles';
import { getStatusDisplay } from '../../shared/user-status';

import { aboutMenu, pendingMenu, startMenuForNewbie } from './menus';
import { ONBOARDING_SCENE_ID } from './scene';
import { onboardingCallback } from './schemas';

const ABOUT_TEXT = `Этот бот раздаёт доступ к закрытым месяцам и принимает заявки на вступление. После одобрения админом ты сможешь оплатить доступ к текущему месяцу.`;

export function registerOnboardingCommands(bot: Telegraf): void {
  bot.command('start', async (ctx) => {
    if (!ctx.from) return;
    const roles = ctx.state.roles ?? (await getRolesForUser(db, ctx.from.id));
    const status = getStatusDisplay(roles);

    switch (status.code) {
      case 'preapproved':
      case 'admin':
      case 'super':
      case 'alumni':
        await ctx.reply(`${status.emoji} ${status.text}. Используй /buy для покупки доступа.`);
        return;
      case 'pending':
        await ctx.reply('⏳ Твоя заявка на рассмотрении.', { ...pendingMenu() });
        return;
      case 'rejected':
        await ctx.reply('🙅 Твоя предыдущая заявка отклонена. Можешь подать заново.', {
          ...startMenuForNewbie(),
        });
        return;
      case 'banned':
      case 'selfBanned':
        // No menu; quietly refuse.
        return;
      case 'newbie':
      default:
        await ctx.reply('👋 Привет! Это закрытый бот.', { ...startMenuForNewbie() });
    }
  });

  router.on(onboardingCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    switch (payload.a) {
      case 'onAbout':
        await ctx.editMessageText(ABOUT_TEXT, { ...aboutMenu() });
        await ctx.answerCbQuery?.();
        break;
      case 'onCancel':
        await ctx.editMessageText('Главный экран.', { ...startMenuForNewbie() });
        await ctx.answerCbQuery?.();
        break;
      case 'onApplyStart':
        await ctx.answerCbQuery?.();
        await (ctx as unknown as Scenes.SceneContext).scene.enter(ONBOARDING_SCENE_ID);
        break;
    }
  });
}
