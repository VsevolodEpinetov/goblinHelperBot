const { Composer, Markup } = require('telegraf');
const util = require('../../util');
const { getUser } = require('../../db/helpers');
const { getUserMenu } = require('../menuSystem');
const knex = require('../../db/knex');

const startCommand = Composer.command('start', async (ctx) => {
  const userId = ctx.message.from.id;
  const username = ctx.message.from.username;

  if (ctx.message.chat.id < 0) {
    await ctx.replyWithHTML('🌑 Здесь говорят шёпотом. Приходи в личку, чужак — только там Главгоблин ведёт дела.')
    return;
  }

  if (!username || String(username).trim() === '') {
    await ctx.replyWithHTML('🔒 Главгоблин не торгует с безымянными. Поставь себе публичный <b>username</b> в настройках Telegram и вернись с /start.');
    return;
  }

  const userData = await getUser(userId);
  
  try {
    const menu = await getUserMenu(ctx, userData);
    await ctx.replyWithHTML(menu.message, {
      ...Markup.inlineKeyboard(menu.keyboard)
    });
  } catch (error) {
    console.error(`❌ /start failed for ${userId} (@${username}):`, error.message);
  }
});

module.exports = startCommand;