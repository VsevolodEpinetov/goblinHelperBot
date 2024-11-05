const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action('adminAddKickstarter', async (ctx) => {
  ctx.session.kickstarter = {
    name: '',
    creator: '',
    link: [],
    files: [],
    pledgeCost: 0,
    cost: 0,
    tags: [],
    photos: [],
    pledgeName: ''
  }
  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    await ctx.replyWithHTML(`Из-за ограничений телеграма тебе нужно использовать /start ещё раз. Старое сообщение останется, можешь его удалить вручную, если мешает.`)
    return;
  }
  ctx.scene.enter('ADMIN_SCENE_ADD_KICKSTARTER_LINK');
});