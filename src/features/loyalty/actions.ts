import type { Context } from 'telegraf';

import { ensureApprovedMember } from '../../core/permissions';
import { router } from '../../core/router';

import { renderLeaderboard, renderProfile } from './routes';
import { loyaltyCallback } from './schemas';

export function registerLoyaltyActions(): void {
  router.on(loyaltyCallback, async (ctx, payload) => {
    if (!(await ensureApprovedMember(ctx as unknown as Context))) return;
    switch (payload.a) {
      case 'profile':
        await renderProfile(ctx as unknown as Context);
        await ctx.answerCbQuery?.();
        break;
      case 'leaders':
        await renderLeaderboard(ctx as unknown as Context);
        await ctx.answerCbQuery?.();
        break;
    }
  });
}
