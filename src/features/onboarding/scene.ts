import { Markup, Scenes } from 'telegraf';

import { logger } from '../../core/observability';

import { submit } from './service';

export const ONBOARDING_SCENE_ID = 'onboarding:apply';

export const onboardingScene = new Scenes.BaseScene<Scenes.SceneContext>(ONBOARDING_SCENE_ID);

const INTRO_TEXT = `<b>Подача заявки</b>

Расскажи коротко о себе: где работаешь, чем увлекаешься, как нашёл нас. Это поможет нам тебя одобрить.

Когда будешь готов — нажми «Отправить». Или «Отмена», чтобы выйти.`;

onboardingScene.enter(async (ctx) => {
  await ctx.reply(INTRO_TEXT, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✅ Отправить', 'onboarding:submit')],
      [Markup.button.callback('❌ Отмена', 'onboarding:cancel')],
    ]),
  });
});

onboardingScene.action('onboarding:cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.editMessageText('Отменено. Можешь вернуться позже.');
});

onboardingScene.action('onboarding:submit', async (ctx) => {
  if (!ctx.from) {
    await ctx.scene.leave();
    return;
  }
  try {
    const result = await submit({
      userId: ctx.from.id,
      username: ctx.from.username ?? null,
      firstName: ctx.from.first_name ?? null,
      lastName: ctx.from.last_name ?? null,
    });
    switch (result.status) {
      case 'submitted':
        await ctx.editMessageText('✅ Заявка отправлена. Жди ответа админа.');
        break;
      case 'already_pending':
        await ctx.editMessageText('Заявка уже на рассмотрении.');
        break;
      case 'already_approved':
        await ctx.editMessageText('Ты уже одобрен. Используй /buy для покупки доступа.');
        break;
    }
  } catch (err) {
    logger.error({ err, userId: ctx.from.id }, 'onboarding submit failed');
    await ctx.editMessageText('Что-то сломалось. Попробуй позже.');
  } finally {
    ctx.scene.state = {};
    await ctx.scene.leave();
  }
});

onboardingScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

onboardingScene.on('message', async (ctx) => {
  await ctx.reply('Используй кнопки «Отправить» или «Отмена».');
});
