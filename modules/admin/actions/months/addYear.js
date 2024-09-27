const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action('monthsAddYear', async (ctx) => {
  ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  ctx.scene.enter('ADMIN_SCENE_ADD_YEAR');
});