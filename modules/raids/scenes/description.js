const { Scenes, Markup } = require('telegraf');
const { generateProgressBar, RAID_CREATION_STEPS } = require('../utils');

const descriptionScene = new Scenes.BaseScene('RAID_SCENE_DESCRIPTION_STAGE');

descriptionScene.enter(async (ctx) => {
  const progressBar = generateProgressBar(4);
  
  const message = `📝 <b>Описание рейда</b>\n\n` +
    `📊 <b>Прогресс:</b> ${progressBar}\n\n` +
    `📄 <b>Расскажите о товаре и рейде</b>\n\n` +
    `💡 <b>Что можно указать:</b>\n` +
    `• Название и характеристики товара\n` +
    `• Размеры, цвет, материал\n` +
    `• Особенности доставки\n` +
    `• Условия участия в рейде\n` +
    `• Контактная информация\n\n` +
    `⚠️ <b>Важно:</b> Чем подробнее описание, тем больше заинтересованных участников`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('⏭ Пропустить', 'raid_skip_description')],
    [Markup.button.callback('🔙 Назад', 'raid_prev_step')],
    [Markup.button.callback('❌ Отмена', 'raid_cancel')]
  ]);

  await ctx.reply(message, {
    parse_mode: 'HTML',
    ...keyboard
  });
});

descriptionScene.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  
  if (text.length < 10) {
    await ctx.reply('❌ Описание слишком короткое! Минимум 10 символов');
    return;
  }

  if (text.length > 2000) {
    await ctx.reply('❌ Описание слишком длинное! Максимум 2000 символов');
    return;
  }

  ctx.session.raid.description = text;
  
  const progressBar = generateProgressBar(4);
  
  const message = `✅ <b>Описание сохранено!</b>\n\n` +
    `📊 <b>Прогресс:</b> ${progressBar}\n\n` +
    `📄 <b>Описание:</b>\n${text.substring(0, 100)}${text.length > 100 ? '...' : ''}\n\n` +
    `⏭ <b>Переходим к следующему шагу</b>`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('⏭ Далее', 'raid_next_step')],
    [Markup.button.callback('🔙 Назад', 'raid_prev_step')],
    [Markup.button.callback('❌ Отмена', 'raid_cancel')]
  ]);

  await ctx.reply(message, {
    parse_mode: 'HTML',
    ...keyboard
  });
});

descriptionScene.action('raid_skip_description', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.raid.description = '';
  
  const progressBar = generateProgressBar(4);
  
  const message = `⏭ <b>Описание пропущено</b>\n\n` +
    `📊 <b>Прогресс:</b> ${progressBar}\n\n` +
    `⏭ <b>Переходим к следующему шагу</b>`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('⏭ Далее', 'raid_next_step')],
    [Markup.button.callback('🔙 Назад', 'raid_prev_step')],
    [Markup.button.callback('❌ Отмена', 'raid_cancel')]
  ]);

  await ctx.reply(message, {
    parse_mode: 'HTML',
    ...keyboard
  });
});

descriptionScene.action('raid_next_step', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.enter('RAID_SCENE_DATE_STAGE');
});

descriptionScene.action('raid_prev_step', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.enter('RAID_SCENE_PRICE_STAGE');
});

descriptionScene.action('raid_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  delete ctx.session.raid;
  await ctx.reply('❌ Создание рейда отменено');
  ctx.scene.leave();
});

descriptionScene.on('message', async (ctx, next) => {
  // Only handle messages if user is in this scene
  if (ctx.scene.session && ctx.scene.session.current === 'RAID_SCENE_DESCRIPTION_STAGE') {
    await ctx.reply('📝 Пожалуйста, отправьте описание рейда или используйте кнопки ниже');
  } else {
    return next();
  }
});

module.exports = descriptionScene;
