const { Scenes, Markup } = require("telegraf");
const util = require('../../../util');

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_PLEDGE_NAME'
const nextStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_PLEDGE_COST'

const adminAddKickstarterPledgeName = new Scenes.BaseScene(currentStageName);

adminAddKickstarterPledgeName.enter(async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  await ctx.telegram.editMessageText(
    ctx.session.chatID,
    ctx.session.toEdit,
    undefined,
    `Пришли <b>название пледжа</b> проекта`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'cancelKickstarterAdd')]
      ])
    }
  );
});

adminAddKickstarterPledgeName.action('cancelKickstarterAdd', async (ctx) => {
  ctx.session.kickstarter = null;
  await ctx.answerCbQuery('Отменено');
  await ctx.scene.leave();
  await ctx.reply('❌ Добавление кикстартера отменено');
});

adminAddKickstarterPledgeName.on('text', async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  const data = ctx.message.text;
  await ctx.deleteMessage(ctx.message.message_id);
  ctx.session.kickstarter.pledgeName = data;
  ctx.scene.enter(nextStageName);
});

module.exports = adminAddKickstarterPledgeName;
 