import { Markup, Scenes } from 'telegraf';

import { editOrReply } from '../../core/nav';
import { logger } from '../../core/observability';

import { memberHubKeyboard, pendingStatusKeyboard, startMenuForNewbie } from './menus';
import { normalizeTale, submit, type SubmitResult } from './service';

export const ONBOARDING_SCENE_ID = 'onboarding:apply';

export const onboardingScene = new Scenes.BaseScene<Scenes.SceneContext>(ONBOARDING_SCENE_ID);

interface ApplyState {
  tale?: string;
}

const TALE_MAX_LENGTH = 4096;

const INTRO_TEXT = `📜 <b>Обряд допуска</b>

Не молчи, чужак. Совет не впускает безликих. Напиши о себе — кто ты, чего ищешь в логове и как набрёл на наши тропы.

Пиши сообщениями, хоть несколькими — я всё подошью в одно прошение. Закончил — жми «Подать прошение», и я отнесу его наверх, старейшинам. Передумал — «Уйти прочь».`;

function applyKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Подать прошение', 'onboarding:submit')],
    [Markup.button.callback('❌ Уйти прочь', 'onboarding:cancel')],
  ]);
}

onboardingScene.enter(async (ctx) => {
  await ctx.reply(INTRO_TEXT, { parse_mode: 'HTML', ...applyKeyboard() });
});

onboardingScene.action('onboarding:cancel', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.editMessageText('🌑 Решил уйти — твоё право. Передумаешь — жми кнопку.', {
    ...startMenuForNewbie(),
  });
});

onboardingScene.action('onboarding:submit', async (ctx) => {
  await ctx.answerCbQuery();
  if (!ctx.from) {
    await ctx.scene.leave();
    return;
  }
  const tale = normalizeTale((ctx.scene.state as ApplyState).tale);
  if (tale === null) {
    await ctx.reply(
      '🕯 Пусто. С пустым прошением к совету я не пойду — засмеют. Сперва напиши о себе сообщением, потом жми «Подать прошение».',
    );
    return;
  }
  let result: SubmitResult;
  try {
    result = await submit({
      userId: ctx.from.id,
      username: ctx.from.username ?? null,
      firstName: ctx.from.first_name ?? null,
      lastName: ctx.from.last_name ?? null,
      tale,
    });
  } catch (err) {
    logger.error({ err, userId: ctx.from.id }, 'onboarding submit failed');
    await editOrReply(
      ctx,
      '💀 Что-то сорвалось — прошение до совета НЕ дошло. Слова твои я придержал, не пропали. Жми «Подать прошение» ещё раз. Если опять рухнет — зови старейшин.',
      { ...applyKeyboard() },
    );
    return;
  }
  ctx.scene.state = {};
  await ctx.scene.leave();
  switch (result.status) {
    case 'submitted':
      await ctx.editMessageText(
        '📜 Прошение твоё записано и унесено совету. Терпеливо жди вердикта — старейшины не любят, когда их подгоняют.',
        { ...pendingStatusKeyboard() },
      );
      break;
    case 'already_pending':
      await ctx.editMessageText('⏳ Твоё прошение уже наверху. Одного достаточно. Жди.', {
        ...pendingStatusKeyboard(),
      });
      break;
    case 'already_approved':
      await ctx.editMessageText(
        '🪙 Да ты ж свой уже, совет тебя впустил. Бери архив кнопкой ниже.',
        { ...memberHubKeyboard() },
      );
      break;
  }
});

onboardingScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('🌑 Обряд прерван.', startMenuForNewbie());
});

onboardingScene.on('text', async (ctx) => {
  const tale = normalizeTale(ctx.message.text);
  if (tale === null) {
    await ctx.reply('🕯 Пусто. Напиши о себе словами, потом жми «Подать прошение».');
    return;
  }
  const state = ctx.scene.state as ApplyState;
  const combined = state.tale ? `${state.tale}\n\n${tale}` : tale;
  if (combined.length > TALE_MAX_LENGTH) {
    await ctx.reply(
      '🕯 Хорош, прошение не резиновое — больше не влезет. Да и совет длинное читать не любит. Жми «Подать прошение».',
      applyKeyboard(),
    );
    return;
  }
  state.tale = combined;
  await ctx.reply(
    '🕯 Подшил к прошению. Хочешь — добавь ещё сообщение. Закончил — жми «Подать прошение», передумал — жми «Уйти прочь».',
    applyKeyboard(),
  );
});

onboardingScene.on('message', async (ctx) => {
  await ctx.reply(
    '🕯 Прошение пишут словами, чужак. Напиши о себе текстом, потом жми «Подать прошение».',
  );
});
