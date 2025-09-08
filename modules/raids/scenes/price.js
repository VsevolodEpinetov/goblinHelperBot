const { Scenes, Markup } = require('telegraf');
const { generateProgressBar, RAID_CREATION_STEPS } = require('../utils');

const priceScene = new Scenes.BaseScene('RAID_SCENE_PRICE_STAGE');

priceScene.enter(async (ctx) => {
  const progressBar = generateProgressBar(3);
  
  const message = `💰 <b>Цена рейда</b>\n\n` +
    `📊 <b>Прогресс:</b> ${progressBar}\n\n` +
    `💵 <b>Укажите общую стоимость товара</b>\n\n` +
    `💡 <b>Формат:</b> число + валюта\n` +
    `• 1500 RUB\n` +
    `• 25 USD\n` +
    `• 20 EUR\n\n` +
    `⚠️ <b>Важно:</b> Укажите полную стоимость, которая будет разделена между участниками`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Назад', 'raid_prev_step')],
    [Markup.button.callback('❌ Отмена', 'raid_cancel')]
  ]);

  await ctx.reply(message, {
    parse_mode: 'HTML',
    ...keyboard
  });
});

priceScene.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  
  // Parse price and currency
  const priceMatch = text.match(/^(\d+(?:\.\d+)?)\s*([A-Z]{3})$/i);
  if (!priceMatch) {
    await ctx.reply('❌ Неверный формат! Используйте формат: "1500 RUB" или "25 USD"');
    return;
  }

  const price = parseFloat(priceMatch[1]);
  const currency = priceMatch[2].toUpperCase();
  
  if (price <= 0) {
    await ctx.reply('❌ Цена должна быть больше нуля!');
    return;
  }

  ctx.session.raid.price = price;
  ctx.session.raid.currency = currency;
  
  const progressBar = generateProgressBar(3);
  
  const message = `✅ <b>Цена сохранена!</b>\n\n` +
    `📊 <b>Прогресс:</b> ${progressBar}\n\n` +
    `💰 <b>Цена:</b> ${price} ${currency}\n\n` +
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

priceScene.action('raid_next_step', async (ctx) => {
  if (!ctx.session.raid.price || !ctx.session.raid.currency) {
    await ctx.answerCbQuery('❌ Сначала укажите цену!');
    return;
  }
  
  await ctx.answerCbQuery();
  ctx.scene.enter('RAID_SCENE_DESCRIPTION_STAGE');
});

priceScene.action('raid_prev_step', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.enter('RAID_SCENE_LINK_STAGE');
});

priceScene.action('raid_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  delete ctx.session.raid;
  await ctx.reply('❌ Создание рейда отменено');
  ctx.scene.leave();
});

priceScene.on('message', async (ctx, next) => {
  // Only handle messages if user is in this scene
  if (ctx.scene.session && ctx.scene.session.current === 'RAID_SCENE_PRICE_STAGE') {
    await ctx.reply('💰 Пожалуйста, укажите цену в формате "1500 RUB" или используйте кнопки ниже');
  } else {
    return next();
  }
});

module.exports = priceScene;
