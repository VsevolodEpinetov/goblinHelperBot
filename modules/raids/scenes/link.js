const { Scenes, Markup } = require('telegraf');
const { generateProgressBar, RAID_CREATION_STEPS } = require('../utils');

const linkScene = new Scenes.BaseScene('RAID_SCENE_LINK_STAGE');

linkScene.enter(async (ctx) => {
  const progressBar = generateProgressBar(2);
  
  const message = `🔗 <b>Ссылка на товар</b>\n\n` +
    `📊 <b>Прогресс:</b> ${progressBar}\n\n` +
    `🌐 <b>Отправьте ссылку на товар</b>\n\n` +
    `💡 <b>Примеры:</b>\n` +
    `• https://aliexpress.com/item/...\n` +
    `• https://amazon.com/dp/...\n` +
    `• https://wildberries.ru/catalog/...\n\n` +
    `⚠️ <b>Важно:</b> Убедитесь, что ссылка работает и товар доступен`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('⏭ Пропустить', 'raid_skip_link')],
    [Markup.button.callback('🔙 Назад', 'raid_prev_step')],
    [Markup.button.callback('❌ Отмена', 'raid_cancel')]
  ]);

  await ctx.reply(message, {
    parse_mode: 'HTML',
    ...keyboard
  });
});

linkScene.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  
  // Basic URL validation
  const urlPattern = /^https?:\/\/.+/;
  if (!urlPattern.test(text)) {
    await ctx.reply('❌ Пожалуйста, отправьте корректную ссылку (начинающуюся с http:// или https://)');
    return;
  }

  ctx.session.raid.link = text;
  
  const progressBar = generateProgressBar(2);
  
  const message = `✅ <b>Ссылка сохранена!</b>\n\n` +
    `📊 <b>Прогресс:</b> ${progressBar}\n\n` +
    `🔗 <b>Ссылка:</b> ${text}\n\n` +
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

linkScene.action('raid_skip_link', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.raid.link = '';
  
  const progressBar = generateProgressBar(2);
  
  const message = `⏭ <b>Ссылка пропущена</b>\n\n` +
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

linkScene.action('raid_next_step', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.enter('RAID_SCENE_PRICE_STAGE');
});

linkScene.action('raid_prev_step', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.enter('RAID_SCENE_PHOTO_STAGE');
});

linkScene.action('raid_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  delete ctx.session.raid;
  await ctx.reply('❌ Создание рейда отменено');
  ctx.scene.leave();
});

linkScene.on('message', async (ctx, next) => {
  // Only handle messages if user is in this scene
  if (ctx.scene.session && ctx.scene.session.current === 'RAID_SCENE_LINK_STAGE') {
    await ctx.reply('🔗 Пожалуйста, отправьте ссылку на товар или используйте кнопки ниже');
  } else {
    return next();
  }
});

module.exports = linkScene;
