import { Markup, Scenes } from 'telegraf';

import { logger } from '../../core/observability';

import { normalizeTale, submit } from './service';

export const ONBOARDING_SCENE_ID = 'onboarding:apply';

export const onboardingScene = new Scenes.BaseScene<Scenes.SceneContext>(ONBOARDING_SCENE_ID);

interface ApplyState {
  tale?: string;
}

const INTRO_TEXT = `📜 <b>Обряд допуска</b>

Не молчи, чужак. Совет не впускает безымянных. Напиши о себе своими словами — кто ты, чего ищешь в логове и как набрёл на наши тропы.

Набери всё это одним сообщением и пришли мне. Я отнесу твой свиток наверх, старейшинам. Готов — жми «Подать свиток». Передумал — «Уйти прочь».`;

function applyKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Подать свиток', 'onboarding:submit')],
    [Markup.button.callback('❌ Уйти прочь', 'onboarding:cancel')],
  ]);
}

onboardingScene.enter(async (ctx) => {
  await ctx.reply(INTRO_TEXT, { parse_mode: 'HTML', ...applyKeyboard() });
});

onboardingScene.action('onboarding:cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.editMessageText(
    '🌑 Отвернулся от совета — твоё право. Надумаешь вернуться — найдёшь меня через /start.',
  );
});

onboardingScene.action('onboarding:submit', async (ctx) => {
  if (!ctx.from) {
    await ctx.scene.leave();
    return;
  }
  const tale = normalizeTale((ctx.scene.state as ApplyState).tale);
  if (tale === null) {
    await ctx.answerCbQuery();
    await ctx.reply(
      '🕯 Пусто. С пустым свитком к совету я не пойду — засмеют. Сперва напиши о себе сообщением, потом жми «Подать свиток».',
    );
    return;
  }
  try {
    const result = await submit({
      userId: ctx.from.id,
      username: ctx.from.username ?? null,
      firstName: ctx.from.first_name ?? null,
      lastName: ctx.from.last_name ?? null,
      tale,
    });
    switch (result.status) {
      case 'submitted':
        await ctx.editMessageText(
          '📜 Свиток твой записан и унесён совету. Теперь жди вердикта — старейшины не любят, когда их торопят.',
        );
        break;
      case 'already_pending':
        await ctx.editMessageText('⏳ Твой свиток уже наверху. Один на брата — хватит. Жди.');
        break;
      case 'already_approved':
        await ctx.editMessageText(
          '🪙 Да ты ж свой уже, совет тебя впустил. Открой /start — оттуда возьмёшь месячный архив.',
        );
        break;
    }
  } catch (err) {
    logger.error({ err, userId: ctx.from.id }, 'onboarding submit failed');
    await ctx.editMessageText(
      '💀 Что-то сорвалось — свиток до совета НЕ дошёл. Попробуй подать его ещё раз. Если опять рухнет — зови старейшин.',
    );
  } finally {
    ctx.scene.state = {};
    await ctx.scene.leave();
  }
});

onboardingScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('🌑 Обряд прерван.');
});

onboardingScene.on('text', async (ctx) => {
  const tale = normalizeTale(ctx.message.text);
  if (tale === null) {
    await ctx.reply('🕯 Пусто. Напиши о себе словами, потом жми «Подать свиток».');
    return;
  }
  (ctx.scene.state as ApplyState).tale = tale;
  await ctx.reply('🕯 Свиток твой я придержал. Готов — жми «Подать свиток», или «Уйти прочь».');
});

onboardingScene.on('message', async (ctx) => {
  await ctx.reply(
    '🕯 Свиток пишут словами, чужак. Напиши о себе текстом, потом жми «Подать свиток».',
  );
});
