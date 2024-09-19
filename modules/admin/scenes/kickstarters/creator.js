const { Scenes, Markup } = require("telegraf");

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_CREATOR'
const nextStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_PLEDGE_NAME'

const adminAddKickstarterCreator = new Scenes.BaseScene(currentStageName);

adminAddKickstarterCreator.enter(async (ctx) => {
  await ctx.telegram.editMessageText(ctx.session.chatID, ctx.session.toEdit, undefined, `Пришли <b>автора</b> проекта`, {
    parse_mode: "HTML"
  });
});

adminAddKickstarterCreator.on('text', async (ctx) => {
  const data = ctx.message.text;

  await ctx.deleteMessage(ctx.message.message_id);

  ctx.session.kickstarter.creator = data;

  ctx.scene.enter(nextStageName)
});

module.exports = adminAddKickstarterCreator;
 