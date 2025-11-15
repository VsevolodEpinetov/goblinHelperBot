const { Composer, Markup } = require("telegraf");
const util = require('../../../util');

module.exports = Composer.action('adminAddKickstarter', async (ctx) => {
  // Check for super user
  if (!util.isSuperUser(ctx.callbackQuery.from.id)) {
    await ctx.answerCbQuery('❌ Только супер-пользователи могут добавлять кикстартеры');
    return;
  }

  // Check for DM context
  if (ctx.chat.type !== 'private') {
    await ctx.answerCbQuery('❌ Добавление кикстартеров доступно только в личных сообщениях');
    return;
  }

  ctx.session.kickstarter = {
    name: '',
    creator: '',
    link: '',
    files: [],
    pledgeCost: 0,
    cost: 0,
    photos: [],
    pledgeName: ''
  };

  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    await ctx.replyWithHTML(`Из-за ограничений телеграма тебе нужно использовать /start ещё раз. Старое сообщение останется, можешь его удалить вручную, если мешает.`);
    return;
  }

  ctx.scene.enter('ADMIN_SCENE_ADD_KICKSTARTER_LINK');
});