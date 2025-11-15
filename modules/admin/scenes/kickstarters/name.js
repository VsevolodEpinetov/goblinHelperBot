const { Scenes, Markup } = require("telegraf");
const util = require('../../../util');

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_NAME'
const nextStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_CREATOR'

const adminAddKickstarterName = new Scenes.BaseScene(currentStageName);

adminAddKickstarterName.enter(async (ctx) => {
  // Check for super user and DM
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  const message = await ctx.replyWithHTML(
    `Пришли <b>название</b> проекта`,
    Markup.inlineKeyboard([
      [Markup.button.callback('❌ Отмена', 'cancelKickstarterAdd')]
    ])
  );
  ctx.session.toEdit = message.message_id;
  ctx.session.chatID = message.chat.id;
});

adminAddKickstarterName.action('cancelKickstarterAdd', async (ctx) => {
  ctx.session.kickstarter = null;
  await ctx.answerCbQuery('Отменено');
  await ctx.scene.leave();
  await ctx.reply('❌ Добавление кикстартера отменено');
});

adminAddKickstarterName.on('text', async (ctx) => {
  // Check for super user and DM
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  const data = ctx.message.text;
  await ctx.deleteMessage(ctx.message.message_id);

  ctx.session.kickstarter.name = data;
  ctx.scene.enter(nextStageName);
});

module.exports = adminAddKickstarterName;
 