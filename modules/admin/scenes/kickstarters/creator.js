const { Scenes, Markup } = require("telegraf");
const util = require('../../../util');

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_CREATOR'
const nextStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_PLEDGE_NAME'

const adminAddKickstarterCreator = new Scenes.BaseScene(currentStageName);

adminAddKickstarterCreator.enter(async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  await ctx.telegram.editMessageText(
    ctx.session.chatID,
    ctx.session.toEdit,
    undefined,
    `Пришли <b>автора</b> проекта`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'cancelKickstarterAdd')]
      ])
    }
  );
});

adminAddKickstarterCreator.action('cancelKickstarterAdd', async (ctx) => {
  ctx.session.kickstarter = null;
  await ctx.answerCbQuery('Отменено');
  await ctx.scene.leave();
  await ctx.reply('❌ Добавление кикстартера отменено');
});

adminAddKickstarterCreator.on('text', async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  const data = ctx.message.text;
  await ctx.deleteMessage(ctx.message.message_id);
  ctx.session.kickstarter.creator = data;
  ctx.scene.enter(nextStageName);
});

module.exports = adminAddKickstarterCreator;
 