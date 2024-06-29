const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util');

module.exports = Composer.action('actionAddMonth', async ctx => {
  try {
    await ctx.reply('Введи название месяца (С ГОДОМ!)');
    ctx.scene.enter('PAYMENT_SCENE_ADD_MONTH_NAME_STAGE');
  } catch (error) {
    console.error('Failed to add a month:', error);
  }
});
