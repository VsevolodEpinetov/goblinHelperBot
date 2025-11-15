const { Scenes, Markup } = require("telegraf");
const util = require('../../../util');

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_COST'
const nextStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_PICTURES'

const adminAddKickstarterCost = new Scenes.BaseScene(currentStageName);

adminAddKickstarterCost.enter(async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  await ctx.telegram.editMessageText(
    ctx.session.chatID,
    ctx.session.toEdit,
    undefined,
    `Пришли <b>стоимость покупки</b> проекта в <b>Telegram Stars</b>`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'cancelKickstarterAdd')]
      ])
    }
  );
});

adminAddKickstarterCost.action('cancelKickstarterAdd', async (ctx) => {
  ctx.session.kickstarter = null;
  await ctx.answerCbQuery('Отменено');
  await ctx.scene.leave();
  await ctx.reply('❌ Добавление кикстартера отменено');
});

adminAddKickstarterCost.on('text', async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  const data = parseInt(ctx.message.text);
  if (isNaN(data) || data <= 0) {
    await ctx.reply('❌ Пожалуйста, введи корректное число (стоимость в Telegram Stars)');
    return;
  }

  await ctx.deleteMessage(ctx.message.message_id);
  ctx.session.kickstarter.cost = data;
  ctx.scene.enter(nextStageName);
});

module.exports = adminAddKickstarterCost;
 