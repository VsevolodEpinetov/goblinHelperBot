import { Markup, Scenes } from 'telegraf';

import { RAID_CHAIN, type RaidDraft } from '../scene-chain';
import { parseRaidDate } from '../service';

import { attachWizardCancel, wizardCancelRow } from './_cancel';

const DATE_SKIP = 'raid:date:skip';

const dateControlsKb = Markup.inlineKeyboard([
  [Markup.button.callback('Пропустить »', DATE_SKIP)],
  wizardCancelRow(),
]);

export const dateScene = new Scenes.BaseScene<Scenes.SceneContext>('raid:date');
attachWizardCancel(dateScene);

dateScene.enter(async (ctx) => {
  await ctx.reply(
    'До какого дня собираем? Пиши ДД.ММ или ДД.ММ.ГГГГ. Без срока — жми «Пропустить».',
    dateControlsKb,
  );
});

async function advanceFromDate(ctx: Scenes.SceneContext, endDate: string | null): Promise<void> {
  const draft = ctx.scene.state as RaidDraft;
  draft.endDate = endDate;
  const next = RAID_CHAIN.nextOf('raid:date');
  if (next) await ctx.scene.enter(next, draft as object);
  else await ctx.scene.leave();
}

dateScene.action(DATE_SKIP, async (ctx) => {
  await ctx.answerCbQuery?.();
  await advanceFromDate(ctx, null);
});

dateScene.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  if (/^пропустить$/i.test(text)) {
    await advanceFromDate(ctx, null);
    return;
  }
  const parsed = parseRaidDate(text);
  if (!parsed) {
    await ctx.reply(
      'Каракули какие-то, не разберу. Пиши ДД.ММ или ДД.ММ.ГГГГ — или жми «Пропустить».',
      dateControlsKb,
    );
    return;
  }
  await advanceFromDate(ctx, parsed.toISOString());
});
